import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { api } from '../../api/client'
import type { AiChatResponse, ConnectionDto } from '../../api/types'
import { AiMessageMarkdown } from './AiMessageMarkdown'
import { useAiChatStore } from '../../stores/aiChatStore'

type TableDto = { name: string }

export function AiChatPanel({
  showHeader = true,
}: {
  showHeader?: boolean
}) {
  const [connections, setConnections] = useState<ConnectionDto[]>([])
  const [tables, setTables] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')

  const connectionId = useAiChatStore((s) => s.connectionId)
  const setConnectionId = useAiChatStore((s) => s.setConnectionId)
  const messages = useAiChatStore((s) => s.messages)
  const resetChat = useAiChatStore((s) => s.resetChat)
  const pushUser = useAiChatStore((s) => s.pushUser)
  const pushAssistantTyping = useAiChatStore((s) => s.pushAssistantTyping)
  const setMessageContent = useAiChatStore((s) => s.setMessageContent)
  const clearPending = useAiChatStore((s) => s.clearPending)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.get<ConnectionDto[]>('/connections')
        setConnections(res.data)
        if (!connectionId && res.data.length > 0) setConnectionId(res.data[0]!.id)
      } catch {
        setConnections([])
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!connectionId) {
      setTables([])
      return
    }
    ;(async () => {
      try {
        const res = await api.get<TableDto[]>('/schema/tables', { params: { connectionId } })
        setTables(res.data.map((t) => t.name))
      } catch {
        setTables([])
      }
    })()
  }, [connectionId])

  // Typewriter effect for any message that still has pendingFullContent
  useEffect(() => {
    const targets = messages.filter((m) => m.role === 'assistant' && m.pendingFullContent)
    if (targets.length === 0) return

    const msg = targets[targets.length - 1]!
    const full = msg.pendingFullContent!

    let idx = msg.content.length
    const timer = window.setInterval(() => {
      idx += Math.max(1, Math.ceil(full.length / 240))
      const next = full.slice(0, Math.min(full.length, idx))
      setMessageContent(msg.id, next)
      viewportRef.current?.scrollTo({ top: 999999 })
      if (next.length >= full.length) {
        clearPending(msg.id)
        window.clearInterval(timer)
      }
    }, 25)

    return () => window.clearInterval(timer)
  }, [messages, clearPending, setMessageContent])

  const connectionOptions = useMemo(
    () => connections.map((c) => ({ value: c.id, label: `${c.name} (${c.provider})` })),
    [connections],
  )

  const mentionQuery = useMemo(() => {
    const el = textareaRef.current
    const cursor = el?.selectionStart ?? input.length
    const left = input.slice(0, cursor)
    const m = left.match(/@([A-Za-z0-9_.]*)$/)
    if (!m) return null
    return m[1] ?? ''
  }, [input])

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return tables.filter((t) => t.toLowerCase().includes(q)).slice(0, 10)
  }, [mentionQuery, tables])

  function insertMention(tableName: string) {
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart ?? input.length
    const left = input.slice(0, cursor)
    const right = input.slice(cursor)
    const m = left.match(/@([A-Za-z0-9_.]*)$/)
    if (!m) return

    const startIdx = left.lastIndexOf('@')
    const next = `${left.slice(0, startIdx)}@${tableName} ${right}`
    setInput(next)
    requestAnimationFrame(() => {
      const pos = (left.slice(0, startIdx) + `@${tableName} `).length
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  function extractMentionedTables(text: string) {
    const hits = text.match(/@([A-Za-z0-9_.]+)/g) ?? []
    return hits.map((h) => h.slice(1))
  }

  async function send() {
    const trimmed = input.trim()
    if (!trimmed) return

    setBusy(true)
    pushUser(trimmed)
    setInput('')

    try {
      const mentionedTables = extractMentionedTables(trimmed)
      const res = await api.post<AiChatResponse>('/ai/chat', {
        message: trimmed,
        connectionId,
        mentionedTables,
      })

      pushAssistantTyping(res.data.content)
      requestAnimationFrame(() => viewportRef.current?.scrollTo({ top: 999999 }))
    } catch (err: any) {
      notifications.show({
        color: 'red',
        title: 'AI request failed',
        message: String(err?.message ?? err),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap="sm" style={{ height: '100%' }}>
      {showHeader ? (
        <Group justify="space-between" align="end">
          <div style={{ flex: 1 }}>
            <Select
              label="Connection (for schema @mentions)"
              data={connectionOptions}
              value={connectionId}
              onChange={setConnectionId}
              searchable
              placeholder="Pick a connection"
            />
          </div>
          <Group gap="xs">
            <Badge variant="light">AI</Badge>
            <Button size="xs" variant="light" onClick={resetChat}>
              Reset
            </Button>
          </Group>
        </Group>
      ) : null}

      <Paper
        withBorder
        p="md"
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <ScrollArea viewportRef={viewportRef} style={{ flex: 1 }}>
          <Stack gap="sm">
            {messages.map((m) => (
              <Paper
                key={m.id}
                p="sm"
                radius="md"
                withBorder
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '92%',
                }}
              >
                <Text size="xs" c="dimmed" mb={4}>
                  {m.role === 'user' ? 'You' : 'AI'}
                </Text>
                <div
                  style={{
                    // mention highlight
                    ['--mention-color' as any]: 'var(--mantine-color-green-7)',
                  }}
                >
                  <AiMessageMarkdown text={m.content} />
                </div>
              </Paper>
            ))}
          </Stack>
        </ScrollArea>

        <Stack gap="xs" mt="sm">
          {mentionQuery !== null && mentionSuggestions.length > 0 ? (
            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed" mb={6}>
                @table suggestions
              </Text>
              <Group gap="xs" wrap="wrap">
                {mentionSuggestions.map((t) => (
                  <Button
                    key={t}
                    size="xs"
                    variant="light"
                    color="green"
                    onClick={() => insertMention(t)}
                  >
                    @{t}
                  </Button>
                ))}
              </Group>
            </Paper>
          ) : null}

          <Group align="end" gap="xs" wrap="nowrap">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="Sorunu yaz… @ yazıp tablo seçebilirsin."
              autosize
              minRows={2}
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <ActionIcon
              variant="filled"
              size="lg"
              onClick={send}
              loading={busy}
              aria-label="Send"
            >
              →
            </ActionIcon>
          </Group>
          <Text size="xs" c="dimmed">
            Ctrl+Enter ile gönder. @mention’lar yeşil.
          </Text>
        </Stack>
      </Paper>
    </Stack>
  )
}


