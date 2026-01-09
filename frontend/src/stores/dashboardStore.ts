import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createDefaultEChartsOverridesJson } from '../lib/echartsTemplates'

export type WidgetType = 'bar' | 'line' | 'area' | 'pie' | 'kpi' | 'filterPane' | 'button'
export type WidgetRegion = 'canvas' | 'ribbon' | 'sidebar'

export type WidgetConfig = {
  dataSource?: 'db' | 'dataset'
  datasetId?: string
  connectionId?: string
  sourceTable?: string
  dimension?: string
  measure?: string
  measures?: string[]
  aggregation?: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX'

  // FilterPane
  filterMulti?: boolean
  filterSearch?: string
  filterLimit?: number

  // KPI
  kpiPrefix?: string
  kpiSuffix?: string
  kpiDecimals?: number

  // Button
  buttonLabel?: string
  buttonVariant?: 'filled' | 'light' | 'outline' | 'default' | 'subtle'
  buttonColor?: string
  buttonSize?: 'xs' | 'sm' | 'md' | 'lg'
  buttonAction?: 'none' | 'clearFilters'
  // ECharts power-user config: allows A-to-Z customization
  echartsOptionOverridesJson?: string
  palette?: string[]
  smooth?: boolean
  showGrid?: boolean
  showTooltip?: boolean
}

export type GridItem = {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export type Widget = {
  id: string
  type: WidgetType
  region: WidgetRegion
  title: string
  layout: GridItem
  config: WidgetConfig
  data?: Record<string, unknown>[]
  status: 'idle' | 'loading' | 'error'
  error?: string
}

export type DashboardChrome = {
  ribbon: { enabled: boolean; height: number; items: string[] }
  sidebar: { enabled: boolean; side: 'left' | 'right'; width: number; collapsed: boolean; items: string[] }
}

type DashboardState = {
  layout: GridItem[]
  widgets: Record<string, Widget>
  selectedWidgetId?: string
  chrome: DashboardChrome

  historyPast: Pick<DashboardState, 'layout' | 'widgets' | 'selectedWidgetId' | 'chrome'>[]
  historyFuture: Pick<DashboardState, 'layout' | 'widgets' | 'selectedWidgetId' | 'chrome'>[]
  undo: () => void
  redo: () => void

  addWidget: (type: WidgetType, x?: number, y?: number) => string
  addChromeItem: (
    region: Exclude<WidgetRegion, 'canvas'>,
    type: Extract<WidgetType, 'kpi' | 'filterPane' | 'button'>,
    initial?: Partial<WidgetConfig> & { title?: string },
  ) => string
  removeChromeItem: (id: string) => void
  enableRibbon: (enabled: boolean) => void
  enableSidebar: (enabled: boolean) => void
  toggleSidebarCollapsed: () => void
  setSidebarWidth: (w: number) => void
  setSidebarSide: (side: 'left' | 'right') => void
  setRibbonHeight: (h: number) => void
  deleteWidget: (id: string) => void
  duplicateWidget: (id: string) => string | null
  setLayout: (layout: GridItem[]) => void
  selectWidget: (id?: string) => void
  setWidgetTitle: (id: string, title: string) => void
  updateWidgetConfig: (id: string, patch: Partial<WidgetConfig>) => void
  setWidgetData: (id: string, data: Record<string, unknown>[]) => void
  setWidgetStatus: (id: string, status: Widget['status'], error?: string) => void
}

function newId(prefix: string) {
  const uuid =
    (globalThis.crypto as any)?.randomUUID?.() ??
    `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`
  return `${prefix}_${uuid}`
}

function cloneSnapshot(s: Pick<DashboardState, 'layout' | 'widgets' | 'selectedWidgetId' | 'chrome'>) {
  const sc = (globalThis as any).structuredClone as undefined | ((x: any) => any)
  if (typeof sc === 'function') return sc(s)
  return JSON.parse(JSON.stringify(s)) as typeof s
}

function pushHistory(set: any, get: any) {
  const snap = cloneSnapshot({
    layout: get().layout,
    widgets: get().widgets,
    selectedWidgetId: get().selectedWidgetId,
    chrome: get().chrome,
  })
  set((state: DashboardState) => ({
    historyPast: [...state.historyPast, snap].slice(-7),
    historyFuture: [],
  }))
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layout: [],
      widgets: {},
      selectedWidgetId: undefined,
      chrome: {
        ribbon: { enabled: false, height: 64, items: [] },
        sidebar: { enabled: false, side: 'left', width: 320, collapsed: false, items: [] },
      },

      historyPast: [],
      historyFuture: [],
      undo: () => {
        const past = get().historyPast
        if (past.length === 0) return
        const prev = past[past.length - 1]!
        const current = cloneSnapshot({
          layout: get().layout,
          widgets: get().widgets,
          selectedWidgetId: get().selectedWidgetId,
          chrome: get().chrome,
        })
        set((s) => ({
          layout: prev.layout,
          widgets: prev.widgets,
          selectedWidgetId: prev.selectedWidgetId,
          chrome: prev.chrome,
          historyPast: past.slice(0, -1),
          historyFuture: [current, ...s.historyFuture].slice(0, 7),
        }))
      },
      redo: () => {
        const future = get().historyFuture
        if (future.length === 0) return
        const next = future[0]!
        const current = cloneSnapshot({
          layout: get().layout,
          widgets: get().widgets,
          selectedWidgetId: get().selectedWidgetId,
          chrome: get().chrome,
        })
        set((s) => ({
          layout: next.layout,
          widgets: next.widgets,
          selectedWidgetId: next.selectedWidgetId,
          chrome: next.chrome,
          historyPast: [...s.historyPast, current].slice(-7),
          historyFuture: future.slice(1),
        }))
      },

  addWidget: (type, x, y) => {
    pushHistory(set, get)
    const id = newId(type)

    const size =
      type === 'kpi' || type === 'button'
        ? { w: 3, h: 3 }
        : type === 'filterPane'
          ? { w: 4, h: 10 }
          : { w: 4, h: 8 }
    const item: GridItem = {
      i: id,
      x: x ?? 0,
      y: y ?? 0,
      w: size.w,
      h: size.h,
    }

    const widget: Widget = {
      id,
      type,
      region: 'canvas',
      title:
        type === 'bar'
          ? 'Bar Chart'
          : type === 'line'
            ? 'Line Chart'
            : type === 'area'
              ? 'Area Chart'
              : type === 'pie'
                ? 'Pie Chart'
                : type === 'kpi'
                  ? 'KPI'
                  : type === 'filterPane'
                    ? 'Filter'
                    : 'Button',
      layout: item,
      config:
        type === 'kpi'
          ? {
              dataSource: 'db',
              aggregation: 'COUNT',
              measure: '*',
              kpiDecimals: 0,
              kpiPrefix: '',
              kpiSuffix: '',
            }
          : type === 'filterPane'
            ? {
                dataSource: 'db',
                filterMulti: false,
                filterLimit: 80,
                filterSearch: '',
              }
            : type === 'button'
              ? {
                  dataSource: 'db',
                  buttonLabel: 'Button',
                  buttonVariant: 'filled',
                  buttonColor: 'blue',
                  buttonSize: 'sm',
                  buttonAction: 'none',
                }
              : {
                  dataSource: 'db',
                  aggregation: 'SUM',
                  showGrid: true,
                  showTooltip: true,
                  smooth: true,
                  echartsOptionOverridesJson: createDefaultEChartsOverridesJson(type),
                },
      status: 'idle',
    }

    set((s) => ({
      layout: [...s.layout, item],
      widgets: { ...s.widgets, [id]: widget },
      // Don't steal selection on every add; keep user's current selection if any.
      selectedWidgetId: s.selectedWidgetId ?? id,
    }))

    return id
  },

  enableRibbon: (enabled) => {
    pushHistory(set, get)
    set((s) => ({ chrome: { ...s.chrome, ribbon: { ...s.chrome.ribbon, enabled } } }))
  },
  setRibbonHeight: (h) => {
    pushHistory(set, get)
    const next = Math.max(40, Math.min(140, h))
    set((s) => ({ chrome: { ...s.chrome, ribbon: { ...s.chrome.ribbon, height: next } } }))
  },

  enableSidebar: (enabled) => {
    pushHistory(set, get)
    set((s) => ({ chrome: { ...s.chrome, sidebar: { ...s.chrome.sidebar, enabled } } }))
  },
  toggleSidebarCollapsed: () => {
    pushHistory(set, get)
    set((s) => ({ chrome: { ...s.chrome, sidebar: { ...s.chrome.sidebar, collapsed: !s.chrome.sidebar.collapsed } } }))
  },
  setSidebarWidth: (w) => {
    pushHistory(set, get)
    const next = Math.max(220, Math.min(520, w))
    set((s) => ({ chrome: { ...s.chrome, sidebar: { ...s.chrome.sidebar, width: next } } }))
  },
  setSidebarSide: (side) => {
    pushHistory(set, get)
    set((s) => ({ chrome: { ...s.chrome, sidebar: { ...s.chrome.sidebar, side } } }))
  },

  addChromeItem: (region, type, initial) => {
    pushHistory(set, get)
    const id = newId(type)
    const widget: Widget = {
      id,
      type,
      region,
      title:
        initial?.title ??
        (type === 'kpi' ? 'KPI' : type === 'filterPane' ? 'Filter' : 'Button'),
      // not used in chrome regions, but required by type
      layout: { i: id, x: 0, y: 0, w: 4, h: 4 },
      config: {
        ...(type === 'kpi'
          ? {
              dataSource: 'db' as const,
              aggregation: 'SUM' as const,
              kpiDecimals: 0,
              kpiPrefix: '',
              kpiSuffix: '',
            }
          : type === 'filterPane'
            ? {
                dataSource: 'db' as const,
                filterMulti: false,
                filterLimit: 80,
                filterSearch: '',
              }
            : {
                dataSource: 'db' as const,
                buttonLabel: 'Button',
                buttonVariant: 'filled',
                buttonColor: 'blue',
                buttonSize: 'sm',
                buttonAction: 'none',
              }),
        ...(initial ?? {}),
      },
      status: 'idle',
    }

    set((s) => {
      const chrome = { ...s.chrome }
      if (region === 'ribbon') chrome.ribbon = { ...chrome.ribbon, enabled: true, items: [...chrome.ribbon.items, id] }
      else chrome.sidebar = { ...chrome.sidebar, enabled: true, items: [...chrome.sidebar.items, id] }

      return {
        widgets: { ...s.widgets, [id]: widget },
        chrome,
        selectedWidgetId: id,
      }
    })

    return id
  },

  removeChromeItem: (id) =>
    set((s) => {
      const snap = cloneSnapshot({ layout: s.layout, widgets: s.widgets, selectedWidgetId: s.selectedWidgetId, chrome: s.chrome })
      if (!s.widgets[id]) return s
      const nextWidgets = { ...s.widgets }
      delete nextWidgets[id]

      const nextChrome: DashboardChrome = {
        ribbon: { ...s.chrome.ribbon, items: s.chrome.ribbon.items.filter((x) => x !== id) },
        sidebar: { ...s.chrome.sidebar, items: s.chrome.sidebar.items.filter((x) => x !== id) },
      }

      const nextSelected = s.selectedWidgetId === id ? undefined : s.selectedWidgetId
      return {
        widgets: nextWidgets,
        chrome: nextChrome,
        selectedWidgetId: nextSelected,
        historyPast: [...s.historyPast, snap].slice(-7),
        historyFuture: [],
      }
    }),

  deleteWidget: (id) =>
    set((s) => {
      // history inside set to avoid extra get() reads
      const snap = cloneSnapshot({ layout: s.layout, widgets: s.widgets, selectedWidgetId: s.selectedWidgetId, chrome: s.chrome })
      if (!s.widgets[id]) return s

      // if it's a chrome item, route to removeChromeItem behavior
      if (s.widgets[id]?.region !== 'canvas') {
        const nextWidgets = { ...s.widgets }
        delete nextWidgets[id]
        const nextChrome: DashboardChrome = {
          ribbon: { ...s.chrome.ribbon, items: s.chrome.ribbon.items.filter((x) => x !== id) },
          sidebar: { ...s.chrome.sidebar, items: s.chrome.sidebar.items.filter((x) => x !== id) },
        }
        const nextSelected = s.selectedWidgetId === id ? undefined : s.selectedWidgetId
        return {
          widgets: nextWidgets,
          chrome: nextChrome,
          selectedWidgetId: nextSelected,
          historyPast: [...s.historyPast, snap].slice(-7),
          historyFuture: [],
        }
      }

      const nextWidgets = { ...s.widgets }
      delete nextWidgets[id]
      const nextLayout = s.layout.filter((l) => l.i !== id)
      const nextSelected = s.selectedWidgetId === id ? undefined : s.selectedWidgetId
      return {
        widgets: nextWidgets,
        layout: nextLayout,
        selectedWidgetId: nextSelected,
        chrome: s.chrome,
        historyPast: [...s.historyPast, snap].slice(-7),
        historyFuture: [],
      }
    }),

  duplicateWidget: (id) => {
    const src = get().widgets[id]
    if (!src) return null
    pushHistory(set, get)
    const nextId = newId(src.type)
    const nextLayout: GridItem = {
      ...src.layout,
      i: nextId,
      // place it below to avoid overlap
      y: (src.layout.y ?? 0) + (src.layout.h ?? 8),
    }
    const nextWidget: Widget = {
      ...src,
      id: nextId,
      title: `${src.title} (copy)`,
      layout: nextLayout,
      // keep data/status as-is for instant visual feedback
    }

    set((s) => ({
      layout: [...s.layout, nextLayout],
      widgets: { ...s.widgets, [nextId]: nextWidget },
      selectedWidgetId: nextId,
    }))

    return nextId
  },

  setLayout: (layout) => {
    pushHistory(set, get)
    const widgets = { ...get().widgets }
    for (const item of layout) {
      if (widgets[item.i]) {
        widgets[item.i] = { ...widgets[item.i], layout: item }
      }
    }
    set({ layout, widgets })
  },

  selectWidget: (id) => set({ selectedWidgetId: id }),

  setWidgetTitle: (id, title) =>
    set((s) => {
      const snap = cloneSnapshot({ layout: s.layout, widgets: s.widgets, selectedWidgetId: s.selectedWidgetId, chrome: s.chrome })
      const widget = s.widgets[id]
      if (!widget) return s
      return {
        widgets: { ...s.widgets, [id]: { ...widget, title } },
        historyPast: [...s.historyPast, snap].slice(-7),
        historyFuture: [],
      }
    }),

  updateWidgetConfig: (id, patch) =>
    set((s) => {
      const snap = cloneSnapshot({ layout: s.layout, widgets: s.widgets, selectedWidgetId: s.selectedWidgetId, chrome: s.chrome })
      const widget = s.widgets[id]
      if (!widget) return s
      return {
        widgets: {
          ...s.widgets,
          [id]: { ...widget, config: { ...widget.config, ...patch } },
        },
        historyPast: [...s.historyPast, snap].slice(-7),
        historyFuture: [],
      }
    }),

  setWidgetData: (id, data) =>
    set((s) => {
      const widget = s.widgets[id]
      if (!widget) return s
      return { widgets: { ...s.widgets, [id]: { ...widget, data } } }
    }),

  setWidgetStatus: (id, status, error) =>
    set((s) => {
      const widget = s.widgets[id]
      if (!widget) return s
      return {
        widgets: {
          ...s.widgets,
          [id]: { ...widget, status, error },
        },
      }
    }),
    }),
    {
      name: 'biapp-dashboard-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        layout: s.layout,
        widgets: s.widgets,
        selectedWidgetId: s.selectedWidgetId,
        historyPast: s.historyPast,
        historyFuture: s.historyFuture,
        chrome: s.chrome,
      }),
    },
  ),
)


