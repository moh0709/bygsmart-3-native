# Task Chat, Mentions, Push, and Per-User Unread Implementation Plan

> Execute this plan in the current checkout because the chat prerequisites are uncommitted workspace changes. Preserve all unrelated edits.

**Goal:** Ship one secure real-time chat per task, including standalone tasks, task-team mentions, photos, best-effort bell/web-push notifications, and a per-user unread badge.

**Architecture:** `TaskChatTab` owns thread interaction. `services/taskChat.ts` owns Supabase persistence/realtime and always derives the message project from the task row. PostgreSQL enforces task/project consistency and per-user read cursors. The Express endpoint independently authorizes sender and recipients before creating notifications and sending push.

**Tech Stack:** React 18, TypeScript, Supabase/Postgres/Realtime/Storage, Express, web-push, Vitest, Testing Library.

---

### Task 1: Secure persistence and service behavior

**Files:**
- Modify: `supabase/migrations/20260703000001_task_ks_and_chat.sql`
- Modify: `services/taskChat.ts`
- Create: `services/taskChat.test.ts`

- [ ] Add failing service tests proving sends derive `project_id` from `tasks`, reject missing/inaccessible tasks, and support a null project for standalone tasks.
- [ ] Add failing tests for history errors and per-user unread read/count/realtime helpers.
- [ ] Add a task/project pair integrity constraint or trigger, authorize chat policies through the referenced task, add standalone-task access, and create `task_chat_reads` with own-user RLS and realtime publication.
- [ ] Implement service changes and run `npx vitest run services/taskChat.test.ts` until green.

### Task 2: Authorize mention notifications on the server

**Files:**
- Create: `server/taskChatAccess.js`
- Create: `server/taskChatAccess.test.js`
- Modify: `server/index.js`

- [ ] Add failing pure tests for caller access, task-team recipient filtering, sender exclusion, duplicate removal, and project/task consistency.
- [ ] Implement the access helpers and run `npx vitest run server/taskChatAccess.test.js` until green.
- [ ] Generalize `notifyUserAndPush` to accept `type`, `title`, and `metadata` while preserving existing callers.
- [ ] Add rate-limited `POST /api/push/notify`, validate the payload, load authoritative task/project/access rows, authorize the caller, filter recipients to the task team, and write/send `task_chat_mention` notifications with the Danish title.

### Task 3: Build the task chat component

**Files:**
- Create: `components/project/tabs/TaskChatTab.tsx`
- Create: `components/project/tabs/TaskChatTab.test.tsx`

- [ ] Add failing interaction tests for history, optimistic send, realtime deduplication, photo selection, task-team mention selection, mention highlighting, and notification dispatch.
- [ ] Implement the thread, composer, image resolution, mention picker, and best-effort notification flow.
- [ ] Run `npx vitest run components/project/tabs/TaskChatTab.test.tsx` until green.

### Task 4: Add per-user unread state and modal wiring

**Files:**
- Create: `hooks/useTaskChatUnread.ts`
- Create: `hooks/useTaskChatUnread.test.tsx`
- Modify: `components/project/modals/TaskFormModal.tsx`
- Create or modify: `components/project/modals/TaskFormModal.chat.test.tsx`

- [ ] Add failing hook tests proving unread increments only for other users, clears only for the active user when chat opens, and remains zero while chat is active.
- [ ] Implement the hook and run its focused test.
- [ ] Add failing modal tests for the Chat tab, red unread badge, save-first placeholder, and saved-task `TaskChatTab` props.
- [ ] Wire `chat`, `MessageSquareIcon`, badge, placeholder, and task-team-only members into the modal; run focused tests.

### Task 5: Use the same chat for standalone task pages

**Files:**
- Modify: `pages/TaskDetailPage.tsx`
- Create or modify: `pages/TaskDetailPage.chat.test.tsx`

- [ ] Add a failing integration test showing the existing Chat workspace tab uses `TaskChatTab` for both project and standalone tasks and displays the unread badge.
- [ ] Replace legacy `task.comments` chat UI/state with `TaskChatTab`, normalize the task team from owner/assignees/explicit task access, and remove orphaned code.
- [ ] Run the focused task-page test until green.

### Task 6: Verify the complete change

- [ ] Run all focused chat/server tests.
- [ ] Run `npm run typecheck`.
- [ ] Run scoped ESLint over changed chat, server, modal, page, hook, and test files.
- [ ] Run `npx vitest run`.
- [ ] Run `npm run build`.
- [ ] Inspect the final diff for unrelated changes and confirm each review comment has direct code and test coverage.
