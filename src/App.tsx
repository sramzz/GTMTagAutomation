// App.tsx — Wizard shell. Manages the current step, authentication state, and provides
// the LogProvider context to all child components.

import { useState } from 'react'
import { LogProvider } from './logging/LogContext'
import type { GtmContainer, GtmWorkspace, ConflictResult, SessionInfo } from './types'
import type { EntityLists } from './services/inputParser'
import './App.css'

const STEP_LABELS = [
  '1. Authenticate',
  '2. Select Container',
  '3. Provide Input',
  '4. Preview',
  '5. Execute',
]

function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<GtmContainer | null>(null)
  const [workspace, setWorkspace] = useState<GtmWorkspace | null>(null)
  const [measurementId, setMeasurementId] = useState('')
  const [entityLists, setEntityLists] = useState<EntityLists | null>(null)
  const [conflictResults, setConflictResults] = useState<ConflictResult[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)

  return (
    <LogProvider>
      <div className="app">
        <header className="app-header">
          <h1>GTM Automation Tool</h1>
          <div className="step-indicator">
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={`step-label ${i + 1 === currentStep ? 'active' : ''} ${i + 1 < currentStep ? 'completed' : ''}`}
              >
                {label}
              </span>
            ))}
          </div>
        </header>

        <main className="app-main">
          {currentStep === 1 && (
            <div className="step-content">
              <h2>Step 1 of 5</h2>
              <p>Sign in with your Google account to access GTM containers.</p>
              <button className="btn-primary">Sign in with Google</button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-content">
              <h2>Step 2 of 5</h2>
              <p>Select container placeholder</p>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-content">
              <h2>Step 3 of 5</h2>
              <p>Input placeholder</p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-content">
              <h2>Step 4 of 5</h2>
              <p>Preview placeholder</p>
            </div>
          )}

          {currentStep === 5 && (
            <div className="step-content">
              <h2>Step 5 of 5</h2>
              <p>Execute placeholder</p>
            </div>
          )}
        </main>
      </div>
    </LogProvider>
  )
}

export default App
