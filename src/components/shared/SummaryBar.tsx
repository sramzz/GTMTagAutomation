// SummaryBar.tsx — Shows a one-line summary of conflict detection results.
// "X to create, Y conflicts (N skipped / M to overwrite), Z already correct"

interface SummaryBarProps {
  toCreate: number
  conflicts: number
  skipped: number
  toOverwrite: number
  alreadyCorrect: number
}

export function SummaryBar({ toCreate, conflicts, skipped, toOverwrite, alreadyCorrect }: SummaryBarProps) {
  return (
    <div className="summary-bar" style={{
      padding: '0.75rem 1rem',
      background: '#f0f4f9',
      borderRadius: '4px',
      fontSize: '0.9rem',
      marginBottom: '1rem',
    }}>
      <span style={{ color: '#34a853', fontWeight: 600 }}>{toCreate} to create</span>
      {' — '}
      <span style={{ color: '#ea8600', fontWeight: 600 }}>{conflicts} conflicts</span>
      {conflicts > 0 && (
        <span style={{ color: '#666' }}> ({skipped} skipped / {toOverwrite} to overwrite)</span>
      )}
      {' — '}
      <span style={{ color: '#888' }}>{alreadyCorrect} already correct</span>
    </div>
  )
}
