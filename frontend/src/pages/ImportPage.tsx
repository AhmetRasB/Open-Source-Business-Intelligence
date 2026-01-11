import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Button,
  Checkbox,
  FileButton,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconTrash } from '@tabler/icons-react'
import { read, utils } from 'xlsx'

import { useDatasetsStore } from '../stores/datasetsStore'

function toSafeString(v: unknown) {
  if (v === null || v === undefined) return ''
  return String(v)
}

export function ImportPage() {
  const datasets = useDatasetsStore((s) => s.datasets)
  const addDataset = useDatasetsStore((s) => s.addDataset)
  const deleteDataset = useDatasetsStore((s) => s.deleteDataset)

  const [pickedName, setPickedName] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [colSearch, setColSearch] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [selectedCols, setSelectedCols] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])

  const previewRows = useMemo(() => rows.slice(0, 20), [rows])
  const filteredCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase()
    if (!q) return columns
    return columns.filter((c) => c.toLowerCase().includes(q))
  }, [columns, colSearch])

  async function handlePickFile(f: File | null) {
    if (!f) return
    try {
      setPickedName(f.name)
      const buf = await f.arrayBuffer()
      const wb = read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]!]
      const json = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const cols = Array.from(
        json.reduce((set, r) => {
          Object.keys(r ?? {}).forEach((k) => set.add(k))
          return set
        }, new Set<string>()),
      )

      if (cols.length === 0) {
        notifications.show({ color: 'yellow', title: 'No columns', message: 'Could not detect columns in file.' })
        return
      }

      setName(f.name.replace(/\.(xlsx|xls|csv)$/i, ''))
      setRows(json.slice(0, 5000)) // avoid huge localStorage
      setColumns(cols)
      setSelectedCols(cols)
      setColSearch('')
      setOpen(true)
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Import failed', message: String(err?.message ?? err) })
    }
  }

  function save() {
    const cols = selectedCols.length ? selectedCols : columns
    const trimmed = rows.map((r) => {
      const out: Record<string, unknown> = {}
      for (const c of cols) out[c] = (r as any)?.[c]
      return out
    })
    addDataset({ name: name.trim() || 'Imported dataset', columns: cols, rows: trimmed })
    notifications.show({ color: 'green', title: 'Imported', message: `Saved dataset with ${trimmed.length} rows.` })
    setOpen(false)
  }

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="sm">
          <Text fw={700}>Import CSV / Excel</Text>
          <Group justify="space-between" align="center">
            <FileButton onChange={handlePickFile} accept=".csv,.xlsx,.xls">
              {(props) => (
                <Button {...props}>
                  Upload file
                </Button>
              )}
            </FileButton>
            <Text size="sm" c="dimmed">
              {pickedName ? `Selected: ${pickedName}` : 'No file selected'}
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            After selecting a file, you’ll see a preview popup to choose columns.
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap="sm">
          <Text fw={700}>Saved datasets</Text>
          {datasets.length === 0 ? (
            <Text size="sm" c="dimmed">
              No imported datasets yet.
            </Text>
          ) : (
            <Stack gap="xs">
              {datasets.map((d) => (
                <Group key={d.id} justify="space-between" wrap="nowrap">
                  <div className="min-w-0">
                    <Text fw={600} lineClamp={1}>
                      {d.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {d.rows.length} rows • {d.columns.length} cols
                    </Text>
                  </div>
                  <ActionIcon
                    color="red"
                    variant="light"
                    onClick={() => {
                      if (confirm('Delete this dataset?')) deleteDataset(d.id)
                    }}
                    aria-label="Delete dataset"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Modal opened={open} onClose={() => setOpen(false)} title="Preview import" size="xl">
        <div className="grid grid-cols-12 gap-4">
          {/* Left: column selection */}
          <Paper withBorder radius="md" className="col-span-12 md:col-span-4 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
              <Text fw={700} size="sm">
                Columns
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setSelectedCols(columns)}
                  disabled={columns.length === 0}
                >
                  Select all
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => setSelectedCols([])}
                  disabled={selectedCols.length === 0}
                >
                  Clear
                </Button>
              </Group>
            </div>

            <div className="p-3">
              <TextInput
                value={colSearch}
                onChange={(e) => setColSearch(e.currentTarget.value)}
                placeholder="Search columns…"
              />
            </div>

            <ScrollArea h={360}>
              <div className="px-3 pb-3">
                <Checkbox.Group value={selectedCols} onChange={setSelectedCols}>
                  <div className="grid grid-cols-1 gap-2">
                    {filteredCols.map((c) => (
                      <Checkbox key={c} value={c} label={c} />
                    ))}
                  </div>
                </Checkbox.Group>
              </div>
            </ScrollArea>
          </Paper>

          {/* Right: preview */}
          <Paper withBorder radius="md" className="col-span-12 md:col-span-8 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Text fw={700} size="sm" lineClamp={1}>
                  Data preview
                </Text>
                <Text size="xs" c="dimmed">
                  {rows.length} rows loaded • showing first {previewRows.length} • storing up to 5000
                </Text>
              </div>
              <Group gap="xs" wrap="nowrap">
                <Button variant="default" size="xs" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button size="xs" onClick={save} disabled={selectedCols.length === 0}>
                  Save dataset
                </Button>
              </Group>
            </div>

            <div className="p-3">
              <TextInput label="Dataset name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
            </div>

            <div className="px-3 pb-3">
              <ScrollArea h={320} type="always">
                <Table withTableBorder striped highlightOnHover stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      {selectedCols.map((c) => (
                        <Table.Th key={c}>{c}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {previewRows.map((r, idx) => (
                      <Table.Tr key={idx}>
                        {selectedCols.map((c) => (
                          <Table.Td key={c}>{toSafeString((r as any)?.[c])}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              {selectedCols.length === 0 ? (
                <Text mt="sm" size="sm" c="dimmed">
                  Select at least one column to preview.
                </Text>
              ) : null}
            </div>
          </Paper>
        </div>
      </Modal>
    </Stack>
  )
}

