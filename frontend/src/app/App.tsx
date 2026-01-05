import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ActionIcon, AppShell, Avatar, Button, Group, Menu, Text, UnstyledButton } from '@mantine/core'
import { IconGridDots } from '@tabler/icons-react'

import { DesignerPage } from '../pages/DesignerPage'
import { PreviewPage } from '../pages/PreviewPage'
import { SqlPage } from '../pages/SqlPage'
import { AiInsightsPage } from '../pages/AiInsightsPage'
import { ImportPage } from '../pages/ImportPage'
import { AiChatWidget } from '../components/ai/AiChatWidget'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { useThemeStore } from '../stores/themeStore'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { RequireAuth } from '../auth/RequireAuth'
import { useAuthStore } from '../auth/authStore'

function initialsFromEmail(email: string | null) {
  if (!email) return '?'
  const name = email.split('@')[0] ?? ''
  const parts = name.split(/[._-]+/).filter(Boolean)
  const a = (parts[0]?.[0] ?? name[0] ?? '?').toUpperCase()
  const b = (parts[1]?.[0] ?? '').toUpperCase()
  return (a + b).trim() || '?'
}

export function App() {
  const location = useLocation()
  const nav = useNavigate()
  const isPreview = location.pathname.startsWith('/preview')
  const isDesigner = location.pathname.startsWith('/designer')
  const isSql = location.pathname.startsWith('/sql')
  const isAi = location.pathname.startsWith('/ai')
  const isImport = location.pathname.startsWith('/import')
  const isAuthRoute =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register') ||
    location.pathname.startsWith('/forgot')
  const colorScheme = useThemeStore((s) => s.colorScheme)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const token = useAuthStore((s) => s.accessToken)
  const email = useAuthStore((s) => s.email)
  const logout = useAuthStore((s) => s.logout)
  const isFullBleed = isDesigner || isPreview
  return (
    <>
      {isAuthRoute ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot" element={<ForgotPasswordPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <AppShell header={{ height: 48 }} padding={isFullBleed ? 0 : 'md'}>
          <AppShell.Header>
            <Group
              h="100%"
              px="md"
              justify="space-between"
              className="bg-white/70 dark:bg-zinc-950/70 backdrop-blur border-b border-zinc-200/60 dark:border-zinc-800/60"
            >
              <Group gap="sm">
                <Menu position="bottom-start" shadow="md" width={260}>
                  <Menu.Target>
                    <ActionIcon variant="subtle" aria-label="App launcher">
                      <IconGridDots size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Apps</Menu.Label>
                    <Menu.Item component={Link} to="/designer" fw={isDesigner ? 700 : undefined}>
                      Dashboard Designer
                    </Menu.Item>
                    <Menu.Item component={Link} to="/preview" fw={isPreview ? 700 : undefined}>
                      Preview
                    </Menu.Item>
                    <Menu.Item component={Link} to="/sql" fw={isSql ? 700 : undefined}>
                      SQL Connections & Query
                    </Menu.Item>
                    <Menu.Item component={Link} to="/import" fw={isImport ? 700 : undefined}>
                      Import (CSV/Excel)
                    </Menu.Item>
                    <Menu.Item component={Link} to="/ai" fw={isAi ? 700 : undefined}>
                      AI Insights
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
                <Text fw={700}>Business Intelligence App</Text>
              </Group>
              {/* Office-like tabs (may get squeezed on very small widths) */}
              <Group gap={6} wrap="nowrap" style={{ flex: 1, justifyContent: 'center', minWidth: 0 }}>
                <Button size="xs" variant={isDesigner ? 'filled' : 'subtle'} component={Link} to="/designer">
                  Designer
                </Button>
                <Button size="xs" variant={isPreview ? 'filled' : 'subtle'} component={Link} to="/preview">
                  Preview
                </Button>
                <Button size="xs" variant={isSql ? 'filled' : 'subtle'} component={Link} to="/sql">
                  SQL
                </Button>
                <Button size="xs" variant={isImport ? 'filled' : 'subtle'} onClick={() => nav('/import')}>
                  Import
                </Button>
                <Button size="xs" variant={isAi ? 'filled' : 'subtle'} component={Link} to="/ai">
                  AI
                </Button>
              </Group>

              <Group gap="xs" wrap="nowrap">
                <Button size="xs" variant="light" onClick={toggleTheme} className="rounded-full">
                  {colorScheme === 'dark' ? 'Light' : 'Dark'}
                </Button>
                <Button size="xs" variant={isPreview ? 'filled' : 'light'} component={Link} to={isPreview ? '/designer' : '/preview'}>
                  {isPreview ? 'Back to Designer' : 'Preview'}
                </Button>
                <Menu position="bottom-end" shadow="md" width={220}>
                  <Menu.Target>
                    <UnstyledButton className="rounded-full">
                      <Avatar radius="xl" color="blue" variant="filled">
                        {initialsFromEmail(email)}
                      </Avatar>
                    </UnstyledButton>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>{email ?? 'Signed in'}</Menu.Label>
                    <Menu.Item disabled>Profile (soon)</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item color="red" onClick={logout}>
                      Logout
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </AppShell.Header>

          <AppShell.Main style={isFullBleed ? { overflow: 'hidden' } : undefined}>
            <ErrorBoundary title="App crashed">
              <Routes>
                <Route path="/" element={<Navigate to={token ? '/designer' : '/login'} replace />} />

                <Route
                  path="/designer"
                  element={
                    <RequireAuth>
                      <DesignerPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/preview"
                  element={
                    <RequireAuth>
                      <PreviewPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/sql"
                  element={
                    <RequireAuth>
                      <SqlPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/ai"
                  element={
                    <RequireAuth>
                      <AiInsightsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/import"
                  element={
                    <RequireAuth>
                      <ImportPage />
                    </RequireAuth>
                  }
                />

                <Route path="/login" element={<Navigate to="/designer" replace />} />
                <Route path="/register" element={<Navigate to="/designer" replace />} />
                <Route path="/forgot" element={<Navigate to="/designer" replace />} />
              </Routes>

              {/* Floating support-style AI chat (only after login) */}
              <AiChatWidget />
            </ErrorBoundary>
          </AppShell.Main>
        </AppShell>
      )}
    </>
  )
}


