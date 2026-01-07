import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './authStore'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  const loc = useLocation()

  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  return <>{children}</>
}


