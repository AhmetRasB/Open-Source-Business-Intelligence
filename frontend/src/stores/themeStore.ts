import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ColorScheme = 'light' | 'dark'

type ThemeState = {
  colorScheme: ColorScheme
  setColorScheme: (s: ColorScheme) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      colorScheme: 'light',
      setColorScheme: (colorScheme) => set({ colorScheme }),
      toggle: () =>
        set({
          colorScheme: get().colorScheme === 'dark' ? 'light' : 'dark',
        }),
    }),
    { name: 'biapp-theme' },
  ),
)


