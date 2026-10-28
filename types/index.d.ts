// Why the session is waiting on the person, and the sidebar section it sat in before (null: Ungrouped).
export type Blocked = {
  reason: 'permission' | 'question' | 'handback'
  group: string | null
}
