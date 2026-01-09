import { isPlainObject } from './deepMerge'

/**
 * ECharts option merge helper.
 * - Objects are merged recursively.
 * - Arrays of objects are merged by index (so series style overrides don't wipe series.data).
 * - Other arrays are replaced.
 */
export function mergeEChartsOption<T>(base: T, override: unknown): T {
  // array handling
  if (Array.isArray(base) && Array.isArray(override)) {
    const overrideHasObjectElements = override.every((x) => x === undefined || x === null || isPlainObject(x))
    const baseHasObjectElements = base.every((x) => x === undefined || x === null || isPlainObject(x))

    // ECharts series/xAxis/yAxis are typically arrays of objects -> merge by index
    if (overrideHasObjectElements && baseHasObjectElements) {
      const max = Math.max(base.length, override.length)
      const out: any[] = []
      for (let i = 0; i < max; i++) {
        const b = (base as any)[i]
        const o = (override as any)[i]
        if (o === undefined) out[i] = b
        else if (isPlainObject(b) && isPlainObject(o)) out[i] = mergeEChartsOption(b, o)
        else out[i] = o
      }
      return out as T
    }

    return override as T
  }

  // object handling
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, unknown> = { ...(base as any) }
    for (const [k, v] of Object.entries(override)) {
      const prev = (out as any)[k]
      if (Array.isArray(prev) && Array.isArray(v)) {
        ;(out as any)[k] = mergeEChartsOption(prev, v)
      } else if (isPlainObject(prev) && isPlainObject(v)) {
        ;(out as any)[k] = mergeEChartsOption(prev, v)
      } else {
        ;(out as any)[k] = v
      }
    }
    return out as T
  }

  // primitive fallback
  return (override as T) ?? base
}

