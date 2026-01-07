export type AuthTokenResponse = {
  accessToken: string
  expiresAtUtc: string
}

export type RegisterRequest = { email: string; password: string }
export type VerifyEmailRequest = { email: string; code: string }
export type LoginRequest = { email: string; password: string }
export type VerifyLoginCodeRequest = { email: string; code: string }
export type ForgotPasswordRequest = { email: string }
export type ResetPasswordRequest = { email: string; code: string; newPassword: string }


