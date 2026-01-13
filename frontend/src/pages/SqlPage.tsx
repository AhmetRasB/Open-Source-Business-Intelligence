import { useEffect, useMemo, useState } from 'react'
import { Button, Divider, Group, Paper, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'

import { api } from '../api/client'
import type {
  ConnectionDto,
  CreateConnectionRequest,
  DbProvider,
  ExecuteQueryRequest,
  ExecuteQueryResponse,
  TestConnectionRequest,
} from '../api/types'

export function SqlPage() {
  const [connections, setConnections] = useState<ConnectionDto[]>([])
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)

  const [name, setName] = useState('AdventureWorks2019 (ARB)')
  const [provider, setProvider] = useState<DbProvider>('sqlServer')
  const [connectionString, setConnectionString] = useState(
    'Data Source=ARB;Initial Catalog=AdventureWorks2019;Integrated Security=True;Connect Timeout=30;Encrypt=True;Trust Server Certificate=True;Application Intent=ReadWrite;Multi Subnet Failover=False',
  )

  const [sql, setSql] = useState('SELECT 1;')
  const [result, setResult] = useState<ExecuteQueryResponse | null>(null)
  const [busy, setBusy] = useState(false)

  async function refreshConnections() {
    try {
      const res = await api.get<ConnectionDto[]>('/connections')
      setConnections(res.data)
      if (!selectedConnectionId && res.data.length > 0) setSelectedConnectionId(res.data[0]!.id)
    } catch {
      setConnections([])
    }
  }

  useEffect(() => {
    refreshConnections()
  }, [])

  const connectionOptions = useMemo(
    () => connections.map((c) => ({ value: c.id, label: `${c.name} (${c.provider})` })),
    [connections],
  )

  async function testConnection() {
    setBusy(true)
    try {
      const req: TestConnectionRequest = { provider, connectionString }
      await api.post('/connections/test', req)
      notifications.show({ color: 'green', title: 'Connection OK', message: 'Successfully connected.' })
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Connection failed', message: String(err?.message ?? err) })
    } finally {
      setBusy(false)
    }
  }

  async function saveConnection() {
    setBusy(true)
    try {
      const req: CreateConnectionRequest = { name, provider, connectionString }
      await api.post('/connections', req)
      notifications.show({ color: 'green', title: 'Saved', message: 'Connection saved.' })
      await refreshConnections()
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Save failed', message: String(err?.message ?? err) })
    } finally {
      setBusy(false)
    }
  }

  async function runQuery() {
    if (!selectedConnectionId) {
      notifications.show({ color: 'yellow', title: 'Pick connection', message: 'Select a connection first.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const req: ExecuteQueryRequest = { connectionId: selectedConnectionId, sql }
      const res = await api.post<ExecuteQueryResponse>('/query/execute', req)
      setResult(res.data)
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Query failed', message: String(err?.message ?? err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="sm">
          <Text fw={700}>SQL Connections</Text>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
            <Select
              label="Provider"
              value={provider}
              onChange={(v) => setProvider((v as DbProvider) ?? 'postgres')}
              data={[
                { value: 'postgres', label: 'PostgreSQL' },
                { value: 'sqlServer', label: 'SQL Server' },
              ]}
            />
          </SimpleGrid>
          <Textarea
            label="Connection String"
            value={connectionString}
            onChange={(e) => setConnectionString(e.currentTarget.value)}
            minRows={2}
            autosize
            placeholder="Example (Postgres): Host=localhost;Port=5432;Database=mydb;Username=postgres;Password=..."
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={testConnection} loading={busy}>
              Test
            </Button>
            <Button onClick={saveConnection} loading={busy}>
              Save
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap="sm">
          <Text fw={700}>Query Runner</Text>
          <Select
            label="Connection"
            data={connectionOptions}
            value={selectedConnectionId}
            onChange={setSelectedConnectionId}
            placeholder="Pick a saved connection"
            searchable
          />

          <Textarea
            label="SQL (SELECT-only for now)"
            value={sql}
            onChange={(e) => setSql(e.currentTarget.value)}
            minRows={6}
            autosize
          />

          <Group justify="flex-end">
            <Button onClick={runQuery} loading={busy}>
              Run
            </Button>
          </Group>

          <Divider />

          {result ? (
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Rows: {result.rowCount}
              </Text>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    {result.columns.map((c) => (
                      <Table.Th key={c}>{c}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.rows.map((r, idx) => (
                    <Table.Tr key={idx}>
                      {result.columns.map((c) => (
                        <Table.Td key={c}>{String(r[c] ?? '')}</Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              Run a query to see results.
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}


