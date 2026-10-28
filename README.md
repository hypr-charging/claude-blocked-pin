# blocked-pin

A Claude Code mod for the desktop app's Code tab: when a session is waiting on you, it gets pinned to the top of the sidebar and filed under a **🔴 BLOCKED** section. When you reply, it's unpinned and goes back to its own section.

A session counts as blocked when:

- a permission prompt is waiting on your approval
- Claude has asked you a question or put a plan up for approval
- Claude ended its turn marked as waiting on your answer

While blocked, the status line reads `BLOCKED: waiting on your approval` (or `answer`).

## Install

At the prompt of a terminal session:

```
/plugin install blocked-pin --marketplace hypr-charging/claude-blocked-pin
```

From a shell:

```bash
claude plugin install blocked-pin --marketplace hypr-charging/claude-blocked-pin
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `hypr-charging/claude-blocked-pin`, then Add plugin.

## Known limits

- The app shows a pinned session under Pinned, so the BLOCKED section mostly holds sessions you unpin by hand while they are still blocked.
- If several tool calls run at once during a permission prompt, the first to finish clears the blocked state.
- It needs the desktop app's sidebar tools, so it does nothing in a plain terminal session.
- Permission prompts are detected through Claude Code's `Notification` hook (`permission_prompt`); a host that doesn't raise it won't trigger the permission path.
- If the app hasn't reported sidebar groups yet when a session blocks, the session is pinned but not moved.
- If two sessions block at the same instant before the BLOCKED section exists, the section can be created twice.
- The mod API is early access and may change between Claude Code releases.

## Developing

`tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which Claude Code writes (and git ignores) once it has loaded the mod. Load it with `claude --plugin-dir <this folder>`, then `npx tsc -p .` type-checks it.
