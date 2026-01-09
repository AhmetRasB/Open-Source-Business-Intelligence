export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Deep-merge two values. Arrays are replaced (not concatenated).
 * Objects are merged recursively. Primitives are replaced.
 */
export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override as T) ?? base
  }

  const out: Record<string, unknown> = { ...(base as any) }
  for (const [k, v] of Object.entries(override)) {
    const prev = (out as any)[k]
    if (Array.isArray(v)) {
      ;(out as any)[k] = v
    } else if (isPlainObject(prev) && isPlainObject(v)) {
      ;(out as any)[k] = deepMerge(prev, v)
    } else {
      ;(out as any)[k] = v
    }
  }
  return out as T
}


