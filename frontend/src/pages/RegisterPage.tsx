import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { notifications } from '@mantine/notifications'

import { api } from '../api/client'
import { useAuthStore } from '../auth/authStore'
import type { AuthTokenResponse, RegisterRequest, VerifyEmailRequest } from '../auth/authTypes'
import { AuthLayout } from '../components/auth/AuthLayout'

export function RegisterPage() {
  const nav = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)

  const [step, setStep] = useState<'register' | 'verify'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function register() {
    setBusy(true)
    try {
      const req: RegisterRequest = { email, password }
      const res = await api.post('/auth/register', req)
      const devCode = (res.data as any)?.devCode as string | undefined
      const emailFailed = Boolean((res.data as any)?.emailFailed)
      notifications.show({
        color: emailFailed ? 'yellow' : 'green',
        title: 'Code sent',
        message: devCode
          ? `Mail sending failed in dev. Use this code: ${devCode}`
          : 'Check your email for verification code.',
      })
      setStep('verify')
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Register failed', message: String(err?.response?.data?.message ?? err?.message ?? err) })
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    try {
      const req: VerifyEmailRequest = { email, code }
      const res = await api.post<AuthTokenResponse>('/auth/verify-email', req)
      setToken(res.data.accessToken, res.data.expiresAtUtc)
      nav('/designer', { replace: true })
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Verify failed', message: String(err?.response?.data?.message ?? err?.message ?? err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Create account" subtitle="We’ll send a verification code to your email.">
      {step === 'register' ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@teklas.com.tr"
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
              placeholder="Min 8 characters"
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') register()
              }}
            />
          </div>
          <button
            className="w-full rounded-xl bg-blue-600 text-white py-2.5 font-semibold disabled:opacity-60 hover:bg-blue-700 transition"
            onClick={register}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Register & send code'}
          </button>
          <div className="text-sm">
            <Link className="text-blue-600 hover:underline" to="/login">
              Back to login
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter the 6‑digit verification code sent to{' '}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>.
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
                if (e.key === 'Enter') verify()
              }}
            />
          </div>
          <button
            className="w-full rounded-xl bg-blue-600 text-white py-2.5 font-semibold disabled:opacity-60 hover:bg-blue-700 transition"
            onClick={verify}
            disabled={busy || code.length !== 6}
          >
            {busy ? 'Verifying…' : 'Verify & enter app'}
          </button>
          <button
            className="w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 py-2.5 font-medium hover:bg-white/70 dark:hover:bg-zinc-900/40 transition"
            onClick={() => setStep('register')}
            disabled={busy}
          >
            Back
          </button>
        </div>
      )}
    </AuthLayout>
  )
}


