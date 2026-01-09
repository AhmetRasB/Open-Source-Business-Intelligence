import React from 'react'
import { Alert, Code, Stack, Text } from '@mantine/core'

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; title?: string },
  { error?: Error }
> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('UI crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    const title = this.props.title ?? 'Something went wrong'
    return (
      <Stack>
        <Alert color="red" title={title}>
          <Text size="sm">
            The UI crashed with an error. Please send this message/stack trace so we can fix it.
          </Text>
        </Alert>
        <Code block>{String(this.state.error?.stack ?? this.state.error?.message ?? this.state.error)}</Code>
      </Stack>
    )
  }
}

