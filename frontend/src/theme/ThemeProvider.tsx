import { useEffect } from 'react'
import type { MantineProviderProps } from '@mantine/core'
import { MantineProvider } from '@mantine/core'

import { useThemeStore } from '../stores/themeStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useThemeStore((s) => s.colorScheme)

  useEffect(() => {
    // Tailwind
    document.documentElement.classList.toggle('dark', colorScheme === 'dark')
    // Mantine (helps components use correct variables)
    document.documentElement.setAttribute('data-mantine-color-scheme', colorScheme)
  }, [colorScheme])

  const props: MantineProviderProps = {
    forceColorScheme: colorScheme,
    children,
  }

  // Note: we intentionally wrap MantineProvider here so Tailwind + Mantine stay in sync.
  return <MantineProvider {...props} />
}


