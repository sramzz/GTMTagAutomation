// Step1Auth.tsx — Step 1 of the wizard: Google OAuth authentication.
// Shows a sign-in button. On return from Google, parses the access token from the URL hash.

import { useEffect, useState } from 'react'
import { buildOAuthUrl, parseTokenFromHash } from '../services/auth'
import { useLog } from '../logging/LogContext'
import './Step1Auth.css'

interface Step1AuthProps {
  onAuthenticated: (token: string) => void
}

// The Google OAuth Client ID is set in .env — see .env.example
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export function Step1Auth({ onAuthenticated }: Step1AuthProps) {
  const { logger } = useLog()
  const [error, setError] = useState<string | null>(null)

  // On mount, check if we're returning from an OAuth redirect with a token in the hash.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return

    const token = parseTokenFromHash(hash)
    if (token) {
      // Clear the hash so the token isn't visible in the URL bar
      window.location.hash = ''
      logger.success('AUTH', 'User authenticated successfully')
      onAuthenticated(token)
    } else {
      // Hash exists but no token — likely an error from Google
      logger.error('AUTH', 'Authentication failed. No access token in redirect.')
      setError('Authentication failed. Ensure you have edit access to the GTM container and that you are using an @solutions4delivery.com account.')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSignIn() {
    const redirectUri = window.location.origin + window.location.pathname
    const url = buildOAuthUrl(CLIENT_ID, redirectUri)
    logger.info('AUTH', 'Redirecting to Google OAuth...')
    window.location.href = url
  }

  return (
    <div className="step1-auth">
      <h2>Step 1 of 5</h2>
      <p>Sign in with your Google account to access GTM containers.</p>

      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}

      <button className="btn-primary" onClick={handleSignIn}>
        Sign in with Google
      </button>

      <p className="auth-note">
        You need Editor access to the target GTM container. The app will request permission to read and edit your GTM configuration.
      </p>
    </div>
  )
}
