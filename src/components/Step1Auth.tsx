// Step1Auth.tsx — Step 1 of the wizard: Google OAuth authentication.
// Shows prerequisites, a sign-in button, and on return from Google parses the access
// token from the URL hash.

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
      <p className="step1-tagline">
        GTM Automation Tool: creates variables, triggers, and tags in your GTM workspace.
      </p>

      <section className="step1-prereqs" aria-labelledby="step1-prereqs-heading">
        <h3 id="step1-prereqs-heading">Before you start</h3>
        <ul>
          <li>
            Sign in with a <strong>@solutions4delivery.com</strong> Google account.
          </li>
          <li>
            That account needs <strong>Editor access</strong> on the target GTM container.
          </li>
          <li>
            Have the container's <strong>GA4 Measurement ID</strong> ready (e.g. <code>G-XXXXXXX</code>).
          </li>
          <li>
            The container must have <strong>fewer than 3 workspaces</strong>, or an existing workspace you can reuse.
          </li>
          <li>
            Pick a data layer source (you'll choose in Step 3):
            <ul>
              <li>
                <strong>S4D Standard</strong> — the default mapping from the April 2026 audit. No prep needed.
              </li>
              <li>
                <strong>Custom audit</strong> — run the audit script across every page of the site, then upload the resulting JSON. Step 3 has the script and instructions.
              </li>
            </ul>
          </li>
        </ul>
      </section>

      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}

      <button className="btn-primary" onClick={handleSignIn}>
        Sign in with Google
      </button>
    </div>
  )
}
