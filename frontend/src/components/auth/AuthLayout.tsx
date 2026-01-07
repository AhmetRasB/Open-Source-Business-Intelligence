import type { ReactNode } from 'react'
import { useThemeStore } from '../../stores/themeStore'

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const colorScheme = useThemeStore((s) => s.colorScheme)
  const toggle = useThemeStore((s) => s.toggle)

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-blue-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-indigo-950" />
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl dark:bg-indigo-500/20" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600 text-white grid place-items-center font-bold shadow-sm">
            T
          </div>
          <div className="leading-tight">
            <div className="font-semibold">Teklas BI</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">Secure analytics workspace</div>
          </div>
        </div>

        <button
          onClick={toggle}
          className="rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 backdrop-blur px-3 py-1.5 text-sm font-medium hover:bg-white dark:hover:bg-zinc-900 transition"
        >
          {colorScheme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 pb-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/70 backdrop-blur shadow-sm p-6">
            {children}
          </div>

          <p className="mt-5 text-xs text-zinc-500 dark:text-zinc-500">
            Only <span className="font-medium">@teklas.com</span> and{' '}
            <span className="font-medium">@teklas.com.tr</span> accounts are allowed.
          </p>
        </div>
      </div>
    </div>
  )
}


