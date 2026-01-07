import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { decodeJwt } from './jwt'

type AuthState = {
  accessToken: string | null
  expiresAtUtc: string | null
  email: string | null
  setToken: (token: string, expiresAtUtc: string) => void
  setEmail: (email: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      expiresAtUtc: null,
      email: null,
      setToken: (accessToken, expiresAtUtc) => {
        const claims = decodeJwt(accessToken)
        set({ accessToken, expiresAtUtc, email: claims?.email ?? null })
      },
      setEmail: (email) => set({ email }),
      logout: () => set({ accessToken: null, expiresAtUtc: null, email: null }),
    }),
    { name: 'biapp-auth' },
  ),
)


