import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { notifications } from '@mantine/notifications'

import { api } from '../api/client'
import { useAuthStore } from '../auth/authStore'
import type { AuthTokenResponse, LoginRequest, VerifyLoginCodeRequest } from '../auth/authTypes'
import { AuthLayout } from '../components/auth/AuthLayout'

export function LoginPage() {
  const nav = useNavigate()
  const loc = useLocation() as any
  const token = useAuthStore((s) => s.accessToken)
  const setToken = useAuthStore((s) => s.setToken)

  const [step, setStep] = useState<'password' | 'code'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const redirectTo = useMemo(() => String(loc?.state?.from ?? '/designer'), [loc])

  if (token) return <Navigate to="/designer" replace />

  async function sendLoginCode() {
    setBusy(true)
    try {
      const req: LoginRequest = { email, password }
      const res = await api.post('/auth/login', req)
      const devCode = (res.data as any)?.devCode as string | undefined
      const emailFailed = Boolean((res.data as any)?.emailFailed)
      notifications.show({
        color: emailFailed ? 'yellow' : 'green',
        title: 'Code sent',
        message: devCode ? `Mail sending failed in dev. Use this code: ${devCode}` : 'Check your email for the login code.',
      })
      setStep('code')
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Login failed', message: String(err?.response?.data?.message ?? err?.message ?? err) })
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode() {
    setBusy(true)
    try {
      const req: VerifyLoginCodeRequest = { email, code }
      const res = await api.post<AuthTokenResponse>('/auth/login/verify', req)
      setToken(res.data.accessToken, res.data.expiresAtUtc)
      nav(redirectTo, { replace: true })
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Invalid code', message: String(err?.response?.data?.message ?? err?.message ?? err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in with email + password, then verify the code sent to your inbox.">
      {/* Stepper */}
      <div className="mb-5 flex items-center gap-2">
        <div className={`h-2 flex-1 rounded-full ${step === 'password' ? 'bg-blue-600' : 'bg-blue-600/30'}`} />
        <div className={`h-2 flex-1 rounded-full ${step === 'code' ? 'bg-blue-600' : 'bg-blue-600/30'}`} />
      </div>

      {step === 'password' ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@teklas.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendLoginCode()
              }}
            />
          </div>

          <button
            className="w-full rounded-xl bg-blue-600 text-white py-2.5 font-semibold disabled:opacity-60 hover:bg-blue-700 transition"
            onClick={sendLoginCode}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Send login code'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <Link className="text-blue-600 hover:underline" to="/forgot">
              Forgot password?
            </Link>
            <Link className="text-zinc-700 dark:text-zinc-200 hover:underline" to="/register">
              Create account
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            We sent a 6‑digit code to <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>.
          </div>

          <div>
            <label className="text-sm font-medium">Code</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 tracking-[0.35em] text-center text-lg font-semibold"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              onKeyDown={(e) => {
                if (e.key === 'Enter') verifyCode()
              }}
            />
          </div>

          <button
            className="w-full rounded-xl bg-blue-600 text-white py-2.5 font-semibold disabled:opacity-60 hover:bg-blue-700 transition"
            onClick={verifyCode}
            disabled={busy || code.length !== 6}
          >
            {busy ? 'Verifying…' : 'Verify & sign in'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 py-2.5 font-medium hover:bg-white/70 dark:hover:bg-zinc-900/40 transition"
              onClick={() => setStep('password')}
              disabled={busy}
            >
              Back
            </button>
            <button
              className="w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 py-2.5 font-medium hover:bg-white/70 dark:hover:bg-zinc-900/40 transition"
              onClick={sendLoginCode}
              disabled={busy}
            >
              Resend
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  )
}


