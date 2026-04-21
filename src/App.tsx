// App.tsx — Wizard shell. Manages the current step, authentication state, and provides
// the LogProvider context to all child components.

import { useState } from 'react'
import { LogProvider } from './logging/LogContext'
import { Step1Auth } from './components/Step1Auth'
import { Step2Container } from './components/Step2Container'
import { Step3Input } from './components/Step3Input'
import { Step4Preview } from './components/Step4Preview'
import { Step5Execute } from './components/Step5Execute'
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
            <Step1Auth onAuthenticated={(token) => {
              setAccessToken(token)
              setCurrentStep(2)
            }} />
          )}

          {currentStep === 2 && (
            <Step2Container
              accessToken={accessToken!}
              onContainerSelected={(container, ws, measId) => {
                setSelectedContainer(container)
                setWorkspace(ws)
                setMeasurementId(measId)
                setSessionInfo({
                  userEmail: '', // Not available from implicit OAuth flow
                  accountName: '', // Can be derived later
                  containerName: container.name,
                  containerPublicId: container.publicId,
                  workspaceName: ws.name,
                  measurementId: measId,
                })
                setCurrentStep(3)
              }}
            />
          )}

          {currentStep === 3 && (
            <Step3Input
              measurementId={measurementId}
              onEntitiesReady={(entities) => {
                setEntityLists(entities)
                setCurrentStep(4)
              }}
            />
          )}

          {currentStep === 4 && (
            <Step4Preview
              accessToken={accessToken!}
              workspacePath={workspace!.path}
              entityLists={entityLists!}
              onConflictsResolved={(results) => {
                setConflictResults(results)
                setCurrentStep(5)
              }}
            />
          )}

          {currentStep === 5 && (
            <Step5Execute
              accessToken={accessToken!}
              workspacePath={workspace!.path}
              containerPublicId={selectedContainer!.publicId}
              measurementId={measurementId}
              conflictResults={conflictResults}
              sessionInfo={sessionInfo!}
              onStartNewOnboarding={() => {
                // Reset to Step 2 — keep the access token, clear everything else
                setSelectedContainer(null)
                setWorkspace(null)
                setMeasurementId('')
                setEntityLists(null)
                setConflictResults([])
                setSessionInfo(null)
                setCurrentStep(2)
              }}
            />
          )}
        </main>
      </div>
    </LogProvider>
  )
}

export default App
