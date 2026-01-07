import { useState } from 'react'
import { Link } from 'react-router-dom'
import { notifications } from '@mantine/notifications'

import { api } from '../api/client'
import type { ForgotPasswordRequest, ResetPasswordRequest } from '../auth/authTypes'
import { AuthLayout } from '../components/auth/AuthLayout'

export function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function request() {
    setBusy(true)
    try {
      const req: ForgotPasswordRequest = { email }
      const res = await api.post('/auth/forgot-password', req)
      const devCode = (res.data as any)?.devCode as string | undefined
      const emailFailed = Boolean((res.data as any)?.emailFailed)
      notifications.show({
        color: emailFailed ? 'yellow' : 'green',
        title: 'If account exists…',
        message: devCode ? `Mail sending failed in dev. Use this code: ${devCode}` : 'We sent a reset code to your email.',
      })
      setStep('reset')
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Failed', message: String(err?.response?.data?.message ?? err?.message ?? err) })
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    setBusy(true)
    try {
      const req: ResetPasswordRequest = { email, code, newPassword }
      await api.post('/auth/reset-password', req)
      notifications.show({ color: 'green', title: 'Password updated', message: 'You can sign in now.' })
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Reset failed', message: String(err?.response?.data?.message ?? err?.message ?? err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Forgot password" subtitle="We’ll send a reset code to your email.">
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

        {step === 'reset' ? (
          <>
            <div>
              <label className="text-sm font-medium">Code</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 tracking-[0.35em] text-center text-lg font-semibold"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-sm font-medium">New password</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
            </div>
            <button
              className="w-full rounded-xl bg-blue-600 text-white py-2.5 font-semibold disabled:opacity-60 hover:bg-blue-700 transition"
              onClick={reset}
              disabled={busy || code.length !== 6}
            >
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
          </>
        ) : (
          <button
            className="w-full rounded-xl bg-blue-600 text-white py-2.5 font-semibold disabled:opacity-60 hover:bg-blue-700 transition"
            onClick={request}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Send reset code'}
          </button>
        )}

        <div className="text-sm">
          <Link className="text-blue-600 hover:underline" to="/login">
            Back to login
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}


