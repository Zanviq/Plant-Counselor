/**
 * Canonical query key factory.
 *
 * ALWAYS import from here instead of writing inline arrays.
 * Key mismatches (e.g. ["plants", {}] vs ["plants", { sort: "activity" }])
 * cause cache misses and unnecessary refetches on every page navigation.
 *
 * TanStack Query uses deep-equal comparison, so "plants" ≠ "plants + params"
 * even when both produce the same URL.
 */
export const QK = {
  // Plants list — no params variant (default sort=activity, include_dormant=false)
  plants: () => ["plants", {}] as const,
  plant:  (id: string) => ["plant", id] as const,

  // Buds — global list vs per-plant list
  buds:      () => ["buds", {}] as const,
  plantBuds: (plantId: string) => ["buds", { plant_id: plantId }] as const,
  bud:       (id: string) => ["bud", id] as const,

  // Stats / briefing
  summary:  () => ["stats", "summary"] as const,
  briefing: () => ["briefing", "today"] as const,
  calendar: (year: number, month: number) => ["calendar", year, month] as const,

  // Notifications
  notifications: () => ["notifications"] as const,

  // Conversation history
  conversations: () => ["conversations", "list"] as const,
  historyThread: (scope: string, scopeId?: string | null) =>
    ["history", scope, scopeId ?? null] as const,
};
