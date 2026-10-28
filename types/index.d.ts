// Why the session is waiting on the person, and where it sat in the sidebar before.
// `group` is undefined when the app had not reported groups yet, so the session was only pinned.
export type Blocked = {
  reason: 'permission' | 'question' | 'handback'
  group: string | null | undefined
  wasPinned: boolean
}
