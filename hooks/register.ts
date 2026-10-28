import type { EngineInterface, McpToolResult, Register } from 'claude-code'

import type { Blocked } from '../types'

const SECTION = '🔴 BLOCKED'
const ASKS_PERSON = new Set(['AskUserQuestion', 'ExitPlanMode'])

type Session = {
  sessionId: string
  group?: { id: string } | null
}

function textOf(result: McpToolResult): string {
  return result.content.map(block => block.text ?? '').join('')
}

async function call($: EngineInterface, server: string, tool: string, args: Record<string, unknown>) {
  const result = await $.mcp.call(server, tool, args)
  if (result.isError) throw new Error(`${tool}: ${textOf(result)}`)

  return textOf(result)
}

async function self($: EngineInterface): Promise<Session> {
  return JSON.parse(await call($, 'ccd_session_mgmt', 'get_session', { session_id: 'self' })) as Session
}

async function sectionId($: EngineInterface): Promise<string> {
  type Section = { id: string; kind: string; name: string; order: number }
  const find = async () => {
    const sections = JSON.parse(await call($, 'ccd_sidebar', 'list_sections', {})) as Section[]
    return sections.filter(s => s.kind === 'manual' && s.name === SECTION).sort((a, b) => a.order - b.order)[0]?.id
  }

  const existing = await find()
  if (existing) return existing

  await call($, 'ccd_sidebar', 'create_section', { name: SECTION })
  const created = await find()
  if (!created) throw new Error(`could not find the ${SECTION} section after creating it`)
  return created
}

// The record lives in $.store, keyed by session, so a restart while blocked can still be undone.
const keyOf = (session: Session) => `blocked:${session.sessionId}`

async function block($: EngineInterface, reason: Blocked['reason']) {
  let session = await self($)
  if ((await $.store.get(keyOf(session))) !== undefined) return

  // The app leaves `group` out until its window has reported the sidebar; give it a few seconds.
  for (let tries = 0; !('group' in session) && tries < 5; tries++) {
    await $.clock.sleep(1000)
    session = await self($)
  }
  if (!('group' in session)) throw new Error(`the app has not reported this session's section, so it was not moved`)

  await $.store.set(keyOf(session), { reason, group: session.group?.id ?? null } satisfies Blocked)
  await call($, 'ccd_sidebar', 'move_sessions', { session_ids: ['self'], section_id: await sectionId($) })
  $.ui.status(`BLOCKED: waiting on your ${reason === 'permission' ? 'approval' : 'answer'}`)
}

async function unblock($: EngineInterface, onlyReason?: Blocked['reason']) {
  const session = await self($)
  const was = (await $.store.get(keyOf(session))) as Blocked | undefined
  if (!was || (onlyReason && was.reason !== onlyReason)) return

  try {
    await call($, 'ccd_sidebar', 'move_sessions', { session_ids: ['self'], section_id: was.group ?? 'sessions' })
  } catch {
    // Its old section is gone: fall back to Ungrouped rather than staying in BLOCKED.
    await call($, 'ccd_sidebar', 'move_sessions', { session_ids: ['self'], section_id: 'sessions' })
  }
  await $.store.delete(keyOf(session))
  $.ui.status(undefined)
}

export const register: Register = on => {
  // Sidebar changes run one at a time, in the order the events asked for them.
  let queue: Promise<void> = Promise.resolve()

  const enqueue = ($: EngineInterface, work: () => Promise<void>) => {
    queue = queue.then(work).catch(error => {
      $.ui.toast(`blocked-pin: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  on('classic.Notification', ($, e, next) => {
    if (e.notification_type === 'permission_prompt' && e.agent_id === undefined) {
      enqueue($, () => block($, 'permission'))
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    if (ASKS_PERSON.has(e.tool)) {
      enqueue($, () => block($, 'question'))
      try {
        return await next(e)
      } finally {
        enqueue($, () => unblock($))
      }
    }

    try {
      return await next(e)
    } finally {
      if (e.tool === 'mcp__ccd_turn__wrap_up' && (e as { blocked?: unknown }).blocked === true) {
        enqueue($, () => block($, 'handback'))
      } else {
        // The call that raised a permission prompt has been approved or denied.
        enqueue($, () => unblock($, 'permission'))
      }
    }
  })

  on('turn.start', ($, e, next) => {
    // Only a message from the person counts as a reply, not a continuation or wakeup.
    if (e.agentId === undefined && e.text !== '') enqueue($, () => unblock($))

    return next(e)
  })

  on('session.end', ($, e, next) => {
    enqueue($, () => unblock($))

    return next(e)
  })
}
