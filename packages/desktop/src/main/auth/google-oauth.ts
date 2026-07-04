import { google } from 'googleapis'
import * as http from 'http'
import { AddressInfo } from 'net'
import { shell } from 'electron'
import { loadClientCredentials, getDefaultCredentialsPath, GoogleClientCredentials } from '../config/google'
import { saveTokens, loadTokens, clearTokens, GoogleTokenSet, isTokenExpired } from './token-store'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

let oAuth2Client: any = null
let credentials_: GoogleClientCredentials | null = null

export function getOAuth2Client(): any {
  if (!oAuth2Client) throw new Error('Google OAuth not initialized. Call initGoogleOAuth() first.')
  return oAuth2Client
}

export function isAuthenticated(): boolean {
  return oAuth2Client !== null && oAuth2Client.credentials !== null
}

export async function initGoogleOAuth(credentialsPath?: string): Promise<boolean> {
  credentials_ = await loadClientCredentials(credentialsPath || getDefaultCredentialsPath())

  const redirectUri =
    credentials_.redirectUris.find((u: string) => u.startsWith('http://localhost')) ||
    'http://localhost'

  oAuth2Client = new google.auth.OAuth2(
    credentials_.clientId,
    credentials_.clientSecret,
    redirectUri,
  )

  const stored = await loadTokens()
  if (stored) {
    oAuth2Client.setCredentials({
      access_token: stored.accessToken,
      refresh_token: stored.refreshToken,
      scope: stored.scope,
      token_type: stored.tokenType,
      expiry_date: stored.expiryDate,
      id_token: stored.idToken,
    })

    if (isTokenExpired(stored)) {
      try {
        const { credentials } = await oAuth2Client.refreshAccessToken()
        await saveTokens(mapCredentials(credentials))
      } catch {
        return false
      }
    }
    return true
  }
  return false
}

export async function authenticate(): Promise<boolean> {
  if (!oAuth2Client || !credentials_) throw new Error('initGoogleOAuth() must be called first')

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://localhost:${(server.address() as AddressInfo).port}`)
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`<html><body><h1>Auth failed: ${error}</h1><p>You can close this window.</p></body></html>`)
          server.close()
          reject(new Error(error))
          return
        }

        if (code) {
          const { tokens } = await oAuth2Client.getToken(code)
          oAuth2Client.setCredentials(tokens)
          await saveTokens(mapCredentials(tokens))

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`<html><body><h1>Authenticated!</h1><p>You can close this window and return to Eburon CodeBox.</p></body></html>`)
          server.close()
          resolve(true)
        }
      } catch (err) {
        server.close()
        reject(err)
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        redirect_uri: `http://localhost:${port}`,
      })
      shell.openExternal(authUrl)
    })

    server.on('error', reject)
  })
}

export async function refreshIfNeeded(): Promise<boolean> {
  if (!oAuth2Client) return false
  try {
    const { credentials } = await oAuth2Client.refreshAccessToken()
    await saveTokens(mapCredentials(credentials))
    return true
  } catch {
    await clearTokens()
    oAuth2Client = null
    return false
  }
}

export async function signOut(): Promise<void> {
  oAuth2Client = null
  credentials_ = null
  await clearTokens()
}

export function getUserClient(): any {
  return getOAuth2Client()
}

function mapCredentials(cred: any): GoogleTokenSet {
  return {
    accessToken: cred.access_token || cred.accessToken || '',
    refreshToken: cred.refresh_token || cred.refreshToken,
    scope: cred.scope || '',
    tokenType: cred.token_type || cred.tokenType || 'Bearer',
    expiryDate: cred.expiry_date || cred.expiryDate || 0,
    idToken: cred.id_token || cred.idToken,
  }
}
