import { useState } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { Box, Mail, Github } from 'lucide-react'

interface AuthPageProps {
  onAuthenticated: () => void
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const { user, loading, error, signIn, signUp, signInGoogle, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-codebox-bg">
        <div className="animate-spin w-8 h-8 border-2 border-codebox-blue border-t-transparent rounded-full" />
      </div>
    )
  }

  if (user) {
    onAuthenticated()
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'login') signIn(email, password)
    else signUp(email, password)
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-codebox-bg">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-codebox-blue/10 flex items-center justify-center mb-4">
            <Box size={28} className="text-codebox-blue" />
          </div>
          <h1 className="text-2xl font-semibold text-codebox-primary">Eburon CodeBox</h1>
          <p className="text-sm text-codebox-secondary mt-1">Sign in to continue</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={signInGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-codebox-border bg-codebox-input hover:bg-codebox-border transition-colors text-codebox-primary text-sm mb-4"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-codebox-border" />
          <span className="text-xs text-codebox-muted">OR</span>
          <div className="flex-1 h-px bg-codebox-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-codebox-input border border-codebox-border text-codebox-primary text-sm outline-none focus:border-codebox-blue transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-codebox-input border border-codebox-border text-codebox-primary text-sm outline-none focus:border-codebox-blue transition-colors"
            required
          />
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-codebox-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Mail size={16} />
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-codebox-muted mt-4">
          {mode === 'login' ? (
            <>No account?{' '}<button onClick={() => setMode('signup')} className="text-codebox-blue hover:underline">Sign up</button></>
          ) : (
            <>Already have an account?{' '}<button onClick={() => setMode('login')} className="text-codebox-blue hover:underline">Sign in</button></>
          )}
        </p>
      </div>
    </div>
  )
}
