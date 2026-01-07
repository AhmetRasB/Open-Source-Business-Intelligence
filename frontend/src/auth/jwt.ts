export type JwtClaims = {
  sub?: string
  email?: string
  exp?: number
  iat?: number
}

function base64UrlDecode(input: string) {
  // base64url -> base64
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  // pad
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const decoded = atob(padded)
  // handle UTF-8
  try {
    return decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
  } catch {
    return decoded
  }
}

export function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as JwtClaims
  } catch {
    return null
  }
}

