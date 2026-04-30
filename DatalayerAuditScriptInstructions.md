
Data layer Audit Script
```
(function() {
  // Load existing data from sessionStorage
  const stored = sessionStorage.getItem('dlEventMap');
  const eventMap = stored ? JSON.parse(stored) : {};
  
  function save() {
    sessionStorage.setItem('dlEventMap', JSON.stringify(eventMap));
  }
  
  function processEntry(entry) {
    if (entry && typeof entry === 'object') {
      const eventName = entry.event || '(no event name)';
      if (!eventMap[eventName]) eventMap[eventName] = { count: 0, variables: [] };
      eventMap[eventName].count++;
      
      const vars = new Set(eventMap[eventName].variables);
      (function extractKeys(obj, prefix) {
        for (let key in obj) {
          if (obj.hasOwnProperty(key)) {
            const path = prefix ? prefix + '.' + key : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
              extractKeys(obj[key], path);
            } else {
              vars.add(path);
            }
          }
        }
      })(entry, '');
      eventMap[eventName].variables = [...vars];
      save();
    }
  }
  
  // Scan what's already in dataLayer
  if (window.dataLayer) {
    dataLayer.forEach(entry => processEntry(entry));
    
    // Monitor future pushes
    const original = dataLayer.push;
    dataLayer.push = function() {
      for (let i = 0; i < arguments.length; i++) {
        processEntry(arguments[i]);
      }
      return original.apply(dataLayer, arguments);
    };
  }
  
  save();
  console.log('%cPage captured. Events so far: ' + Object.keys(eventMap).length, 'color: #4CAF50; font-weight: bold;');
})();
```
How to Use It
Step 1 — You need to paste this script on every page during your journey. To avoid doing that manually, the easiest approach is to use a DevTools Snippet:

Open DevTools (F12)
Go to Sources → Snippets (in the left sidebar, you may need to click the >> to find it)
Click New Snippet, name it dataLayerAudit
Paste the script above
Right-click the snippet → Run (or press Ctrl+Enter)

Now on every page you visit during the journey, just open the Snippets panel and run it again. It takes 2 seconds per page. Since the data accumulates in sessionStorage, nothing is lost between navigations.
Step 2 — Walk through the full journey, running the snippet on each page.
Step 3 — When you're done, paste this in the Console to see the full report:
```
javascriptconst data = JSON.parse(sessionStorage.getItem('dlEventMap'));
Object.keys(data).sort().forEach(e => {
  console.log('%c\n' + e + ' (fired ' + data[e].count + 'x)', 'color: #2196F3; font-weight: bold;');
  console.table(data[e].variables.filter(v => v !== 'event').sort().map(v => ({variable: v})));
});
// Copyable version
console.log(JSON.stringify(data, null, 2));
Step 4 — To reset and start fresh:
javascriptsessionStorage.removeItem('dlEventMap');
```