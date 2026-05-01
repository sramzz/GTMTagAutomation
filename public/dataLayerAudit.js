// dataLayerAudit.js — Paste into a DevTools Snippet and run on every page of a full site
// journey. Captures every dataLayer event + variable path into sessionStorage under
// 'dlEventMap'. After the journey, dump it from the console:
//   copy(sessionStorage.getItem('dlEventMap'))
// then paste the result into Step 3 (Custom JSON tab) of the GTM Automation Tool.

(function () {
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

  if (window.dataLayer) {
    dataLayer.forEach((entry) => processEntry(entry));

    const original = dataLayer.push;
    dataLayer.push = function () {
      for (let i = 0; i < arguments.length; i++) {
        processEntry(arguments[i]);
      }
      return original.apply(dataLayer, arguments);
    };
  }

  save();
  console.log(
    '%cPage captured. Events so far: ' + Object.keys(eventMap).length,
    'color: #4CAF50; font-weight: bold;',
  );
})();
