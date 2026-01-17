import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent, DragCancelEvent } from '@dnd-kit/core'
import { ActionIcon, Badge, Button, Group, Modal, Paper, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { useViewportSize } from '@mantine/hooks'
import { ResizableBox } from 'react-resizable'
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconChevronLeft,
  IconChevronRight,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react'

import { Palette } from '../components/designer/Palette'
import { PropertiesPanel } from '../components/designer/PropertiesPanel'
import { DashboardFrame } from '../components/dashboard/DashboardFrame'
import { api } from '../api/client'
import type { ChartQueryRequest, ExecuteQueryResponse } from '../api/types'
import { useDashboardStore } from '../stores/dashboardStore'
import { useDesignerUiStore } from '../stores/designerUiStore'
import { useFilterStore } from '../stores/filterStore'
import type { WidgetType } from '../stores/dashboardStore'
import { useDatasetsStore } from '../stores/datasetsStore'
import { runDatasetChart } from '../lib/datasetChart'

export function DesignerPage() {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const addWidget = useDashboardStore((s) => s.addWidget)
  const addChromeItem = useDashboardStore((s) => s.addChromeItem)
  const enableRibbon = useDashboardStore((s) => s.enableRibbon)
  const enableSidebar = useDashboardStore((s) => s.enableSidebar)
  const updateWidgetConfig = useDashboardStore((s) => s.updateWidgetConfig)
  const setWidgetTitle = useDashboardStore((s) => s.setWidgetTitle)
  const setWidgetData = useDashboardStore((s) => s.setWidgetData)
  const setWidgetStatus = useDashboardStore((s) => s.setWidgetStatus)
  const undo = useDashboardStore((s) => s.undo)
  const redo = useDashboardStore((s) => s.redo)
  const canUndo = useDashboardStore((s) => s.historyPast.length > 0)
  const canRedo = useDashboardStore((s) => s.historyFuture.length > 0)
  const { height: viewportH } = useViewportSize()
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [buttonModal, setButtonModal] = useState<
    | { target: { kind: 'ribbon' | 'sidebar' } }
    | { target: { kind: 'canvas'; x: number; y: number } }
    | null
  >(null)
  const leftWidth = useDesignerUiStore((s) => s.leftWidth)
  const rightWidth = useDesignerUiStore((s) => s.rightWidth)
  const leftCollapsed = useDesignerUiStore((s) => s.leftCollapsed)
  const rightCollapsed = useDesignerUiStore((s) => s.rightCollapsed)
  const setLeftWidth = useDesignerUiStore((s) => s.setLeftWidth)
  const setRightWidth = useDesignerUiStore((s) => s.setRightWidth)
  const toggleLeft = useDesignerUiStore((s) => s.toggleLeft)
  const toggleRight = useDesignerUiStore((s) => s.toggleRight)
  const activeFilter = useFilterStore((s) => s.active)
  const clearFilter = useFilterStore((s) => s.clear)
  const getDatasetById = useDatasetsStore((s) => s.getById)

  // AppShell.Main is full-bleed (no padding) for Designer/Preview routes.
  // Keep everything contained to avoid outer-page scrolling.
  const panelHeight = Math.max(360, viewportH - 48)

  const gridSettings = useMemo(
    () => ({
      cols: 12,
      rowHeight: 30,
      margin: [10, 10] as const,
      containerPadding: [10, 10] as const,
    }),
    [],
  )

  function computeCanvasDropXY(e: DragEndEvent, defaultW = 4) {
    const rect = canvasRef.current?.getBoundingClientRect()
    const activeRect = e.active.rect.current.translated
    if (!rect || !activeRect) return null

    const centerX = activeRect.left + activeRect.width / 2 - rect.left
    const centerY = activeRect.top + activeRect.height / 2 - rect.top

    const { cols, margin, containerPadding, rowHeight } = gridSettings
    const containerWidth = rect.width
    const colWidth =
      (containerWidth - containerPadding[0] * 2 - margin[0] * (cols - 1)) / cols

    const w = Math.max(1, Math.min(cols, defaultW))
    const x = Math.max(
      0,
      Math.min(cols - w, Math.floor((centerX - containerPadding[0]) / (colWidth + margin[0]))),
    )
    const y = Math.max(0, Math.floor((centerY - containerPadding[1]) / (rowHeight + margin[1])))

    return { x, y }
  }

  function handleDragEnd(e: DragEndEvent) {
    const paletteId = String(e.active.id)
    if (!paletteId.startsWith('palette:')) return

    const kind = paletteId.replace('palette:', '')

    // Chrome enablement
    if (kind === 'ribbon') {
      enableRibbon(true)
      return
    }
    if (kind === 'sidebar') {
      enableSidebar(true)
      return
    }

    const overId = e.over?.id ? String(e.over.id) : null
    if (!overId) return

    // KPI / FilterPane: can be dropped to ribbon/sidebar OR canvas
    if (kind === 'kpi' || kind === 'filterPane') {
      if (overId === 'ribbon-drop') {
        addChromeItem('ribbon', kind as Extract<WidgetType, 'kpi' | 'filterPane'>)
        return
      }
      if (overId === 'sidebar-drop') {
        addChromeItem('sidebar', kind as Extract<WidgetType, 'kpi' | 'filterPane'>)
        return
      }
      if (overId === 'canvas') {
        const xy = computeCanvasDropXY(e, kind === 'kpi' ? 3 : 4)
        if (!xy) return
        addWidget(kind as any, xy.x, xy.y)
        return
      }
      return
    }

    if (kind === 'button') {
      if (overId === 'ribbon-drop') setButtonModal({ target: { kind: 'ribbon' } })
      else if (overId === 'sidebar-drop') setButtonModal({ target: { kind: 'sidebar' } })
      else if (overId === 'canvas') {
        const xy = computeCanvasDropXY(e, 3)
        if (!xy) return
        setButtonModal({ target: { kind: 'canvas', x: xy.x, y: xy.y } })
      }
      return
    }

    // Charts (drop to canvas)
    if (overId !== 'canvas') return
    const type: WidgetType | null =
      kind === 'bar' ? 'bar' : kind === 'line' ? 'line' : kind === 'area' ? 'area' : kind === 'pie' ? 'pie' : null
    if (!type) return

    const xy = computeCanvasDropXY(e, 4)
    if (!xy) return
    addWidget(type as any, xy.x, xy.y)
  }

  const filterKey = useMemo(() => JSON.stringify(activeFilter ?? null), [activeFilter])
  useEffect(() => {
    ;(async () => {
      const state = useDashboardStore.getState()
      const widgets = Object.values(state.widgets).filter(
        (w) => w.region === 'canvas' && (w.type === 'bar' || w.type === 'line' || w.type === 'area' || w.type === 'pie'),
      )
      for (const w of widgets) {
        if (w.type !== 'bar' && w.type !== 'line' && w.type !== 'area' && w.type !== 'pie') continue
        const measures = w.config.measures?.length ? w.config.measures : w.config.measure ? [w.config.measure] : []
        if (!w.config.dimension || measures.length === 0) continue

        if (w.config.dataSource === 'dataset' && w.config.datasetId) {
          const ds = getDatasetById(w.config.datasetId)
          if (!ds) continue
          try {
            setWidgetStatus(w.id, 'loading')
            const rows = runDatasetChart({
              dataset: ds,
              dimension: w.config.dimension,
              measures,
              aggregation: w.config.aggregation ?? 'SUM',
              limit: 50,
              activeFilter,
            })
            setWidgetData(w.id, rows)
            setWidgetStatus(w.id, 'idle')
          } catch (err: any) {
            setWidgetStatus(w.id, 'error', String(err?.message ?? err))
          }
          continue
        }

        if (!w.config.connectionId || !w.config.sourceTable) continue
        const filters =
          activeFilter?.kind === 'db' &&
          w.config.connectionId === activeFilter.connectionId &&
          w.config.sourceTable === activeFilter.sourceTable
            ? [{ column: activeFilter.column, values: activeFilter.values }]
            : undefined

        const req: ChartQueryRequest = {
          connectionId: w.config.connectionId,
          chartType: w.type,
          sourceTable: w.config.sourceTable,
          dimension: w.config.dimension,
          measure: measures[0]!,
          measures: measures.length > 1 ? measures : undefined,
          aggregation: w.config.aggregation ?? 'SUM',
          limit: 50,
          filters,
        }

        try {
          setWidgetStatus(w.id, 'loading')
          const res = await api.post<ExecuteQueryResponse>('/query/chart', req)
          setWidgetData(w.id, res.data.rows)
          setWidgetStatus(w.id, 'idle')
        } catch (err: any) {
          setWidgetStatus(w.id, 'error', String(err?.response?.data?.message ?? err?.message ?? err))
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  // Undo/Redo shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey
      if (!isMod) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  return (
    <DndContext
      onDragStart={(e: DragStartEvent) => setActiveDragId(String(e.active.id))}
      onDragCancel={(_e: DragCancelEvent) => setActiveDragId(null)}
      onDragEnd={(e) => {
        handleDragEnd(e)
        setActiveDragId(null)
      }}
    >
      <Modal
        opened={buttonModal !== null}
        onClose={() => setButtonModal(null)}
        title="Choose button design"
        size="lg"
      >
        <Text size="sm" c="dimmed" mb="sm">
          Pick a template. You can fine-tune in Properties later.
        </Text>

        <SimpleGrid cols={2} spacing="sm">
          {buttonTemplates.map((t) => (
            <Paper
              key={t.id}
              withBorder
              p="sm"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (!buttonModal) return
                const target = buttonModal.target
                if (target.kind === 'canvas') {
                  const id = addWidget('button', target.x, target.y)
                  setWidgetTitle(id, t.title)
                  updateWidgetConfig(id, {
                    buttonLabel: t.label,
                    buttonVariant: t.variant,
                    buttonColor: t.color,
                    buttonSize: t.size,
                    buttonAction: t.action,
                  })
                } else {
                  addChromeItem(target.kind, 'button', {
                    title: t.title,
                    buttonLabel: t.label,
                    buttonVariant: t.variant,
                    buttonColor: t.color,
                    buttonSize: t.size,
                    buttonAction: t.action,
                  })
                }
                setButtonModal(null)
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Text fw={700} size="sm">
                  {t.title}
                </Text>
                <Button variant={t.variant as any} color={t.color} size="xs">
                  {t.label}
                </Button>
              </Group>
              <Text size="xs" c="dimmed" mt={6}>
                {t.hint}
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Modal>

      <div className="h-[calc(100vh-48px)] w-full flex gap-3">
        {/* Left panel (Palette) */}
        {leftCollapsed ? (
          <Paper withBorder className="w-10 h-full flex flex-col items-center justify-start py-2">
            <Tooltip label="Open Palette" position="right">
              <ActionIcon variant="subtle" onClick={toggleLeft} aria-label="Open palette">
                <IconChevronRight size={16} />
              </ActionIcon>
            </Tooltip>
          </Paper>
        ) : (
          <ResizableBox
            width={leftWidth}
            height={panelHeight}
            axis="x"
            minConstraints={[220, 0]}
            maxConstraints={[520, 0]}
            onResizeStop={(_e, data: { size: { width: number } }) => setLeftWidth(data.size.width)}
            resizeHandles={['e']}
            handle={<span className="react-resizable-handle react-resizable-handle-e !w-2 !right-[-6px] !top-0 !h-full cursor-col-resize opacity-40 hover:opacity-100" />}
          >
            <Paper withBorder className="h-full overflow-hidden">
              <div className="h-full flex flex-col">
                <div className="h-10 px-3 flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/60">
                  <Text fw={700} size="sm">
                    Palette
                  </Text>
                  <Tooltip label="Collapse Palette" position="bottom">
                    <ActionIcon variant="subtle" onClick={toggleLeft} aria-label="Collapse palette">
                      <IconLayoutSidebarLeftCollapse size={18} />
                    </ActionIcon>
                  </Tooltip>
                </div>
                <div className="p-3 overflow-auto">
                  <Stack gap="sm">
                    <Palette />
                  </Stack>
                </div>
              </div>
            </Paper>
          </ResizableBox>
        )}

        {/* Center canvas */}
        <Paper withBorder className="flex-1 min-w-0 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="h-10 px-3 flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/60">
              <Group gap="xs" wrap="nowrap">
                <Text fw={700} size="sm">
                  Canvas
                </Text>
                <Tooltip label="Undo (Ctrl+Z)">
                  <ActionIcon variant="subtle" onClick={undo} disabled={!canUndo} aria-label="Undo">
                    <IconArrowBackUp size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Redo (Ctrl+Y)">
                  <ActionIcon variant="subtle" onClick={redo} disabled={!canRedo} aria-label="Redo">
                    <IconArrowForwardUp size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              {activeFilter ? (
                <Group gap="xs" wrap="nowrap">
                  <Badge variant="light">
                    {activeFilter.column}: {activeFilter.values.join(', ')}
                  </Badge>
                  <Button size="xs" variant="light" onClick={clearFilter}>
                    Clear
                  </Button>
                </Group>
              ) : (
                <Text size="xs" c="dimmed">
                  Tip: click a chart to filter others • Ctrl+click to multi-select
                </Text>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <DashboardFrame interactive gridSettings={gridSettings} canvasRef={(n) => (canvasRef.current = n)} />
            </div>
          </div>
        </Paper>

        {/* Right panel (Properties) */}
        {rightCollapsed ? (
          <Paper withBorder className="w-10 h-full flex flex-col items-center justify-start py-2">
            <Tooltip label="Open Properties" position="left">
              <ActionIcon variant="subtle" onClick={toggleRight} aria-label="Open properties">
                <IconChevronLeft size={16} />
              </ActionIcon>
            </Tooltip>
          </Paper>
        ) : (
          <ResizableBox
            width={rightWidth}
            height={panelHeight}
            axis="x"
            minConstraints={[300, 0]}
            maxConstraints={[720, 0]}
            onResizeStop={(_e, data: { size: { width: number } }) => setRightWidth(data.size.width)}
            resizeHandles={['w']}
            handle={<span className="react-resizable-handle react-resizable-handle-w !w-2 !left-[-6px] !top-0 !h-full cursor-col-resize opacity-40 hover:opacity-100" />}
          >
            <Paper withBorder className="h-full overflow-hidden">
              <div className="h-full flex flex-col">
                <div className="h-10 px-3 flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/60">
                  <Text fw={700} size="sm">
                    Properties
                  </Text>
                  <Tooltip label="Collapse Properties" position="bottom">
                    <ActionIcon variant="subtle" onClick={toggleRight} aria-label="Collapse properties">
                      <IconLayoutSidebarRightCollapse size={18} />
                    </ActionIcon>
                  </Tooltip>
                </div>
                <div className="p-3 overflow-auto">
                  <PropertiesPanel />
                </div>
              </div>
            </Paper>
          </ResizableBox>
        )}
      </div>

      {/* Drag preview should float ABOVE panels/canvas (avoid being clipped by overflow). */}
      <DragOverlay zIndex={5000}>
        {activeDragId?.startsWith('palette:') ? (
          <Paper
            withBorder
            shadow="lg"
            radius="md"
            p="sm"
            style={{
              width: 240,
              pointerEvents: 'none',
              opacity: 0.95,
            }}
          >
            <Text fw={700} size="sm">
              {activeDragId === 'palette:bar'
                ? 'Bar Chart'
                : activeDragId === 'palette:line'
                  ? 'Line Chart'
                  : activeDragId === 'palette:area'
                    ? 'Area Chart'
                    : activeDragId === 'palette:pie'
                      ? 'Pie Chart'
                      : activeDragId === 'palette:ribbon'
                        ? 'Ribbon'
                        : activeDragId === 'palette:sidebar'
                          ? 'Sidebar'
                          : activeDragId === 'palette:kpi'
                            ? 'KPI'
                      : activeDragId === 'palette:button'
                        ? 'Button'
                            : 'Filter pane'}
            </Text>
            <Text size="xs" c="dimmed">
              {activeDragId === 'palette:kpi' || activeDragId === 'palette:filterPane' || activeDragId === 'palette:button'
                ? 'Drop on ribbon or sidebar'
                : activeDragId === 'palette:ribbon' || activeDragId === 'palette:sidebar'
                  ? 'Drop anywhere'
                  : 'Drop on canvas'}
            </Text>
          </Paper>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

const buttonTemplates: {
  id: string
  title: string
  label: string
  variant: 'filled' | 'light' | 'outline' | 'default' | 'subtle'
  color: string
  size: 'xs' | 'sm' | 'md' | 'lg'
  action: 'none' | 'clearFilters'
  hint: string
}[] = [
  {
    id: 'primary',
    title: 'Primary action',
    label: 'Apply',
    variant: 'filled',
    color: 'blue',
    size: 'sm',
    action: 'none',
    hint: 'Standard primary button',
  },
  {
    id: 'secondary',
    title: 'Secondary',
    label: 'More',
    variant: 'light',
    color: 'gray',
    size: 'sm',
    action: 'none',
    hint: 'Low emphasis action',
  },
  {
    id: 'outline',
    title: 'Outline',
    label: 'Export',
    variant: 'outline',
    color: 'teal',
    size: 'sm',
    action: 'none',
    hint: 'Great for toolbar/ribbon',
  },
  {
    id: 'clearFilters',
    title: 'Clear filters',
    label: 'Clear',
    variant: 'light',
    color: 'red',
    size: 'sm',
    action: 'clearFilters',
    hint: 'One-click filter reset',
  },
]


