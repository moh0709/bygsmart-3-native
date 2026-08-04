# Task Chat, Mentions, Push, and Unread Design

## Goal

Provide one canonical real-time chat inside every saved task, whether the task belongs to a project or is standalone. Chat supports text, photos, task-team mentions, secure in-app/push notifications, and a per-user unread badge that clears when that user opens Chat.

## Scope

The feature replaces the legacy `task.comments` chat in `TaskDetailPage` and adds the same chat to `TaskFormModal`. It reuses the existing `task_chat_messages` service/table and `task-docs` storage bucket, extends the schema for standalone tasks, and adds per-user read cursors.

No global chat, project-wide chat, read receipts per message, typing indicators, message editing, reactions, or bell changes are included.

## User Experience

### Thread

`TaskChatTab` renders a task-scoped message thread with own messages aligned right and other messages aligned left. It loads history oldest-first, subscribes to new inserts, deduplicates by message ID, replaces optimistic messages after persistence, and scrolls to the newest message.

Image attachments are resolved through `resolveFileUrl`. The composer accepts text, one prepared photo per message, and @mentions. Failed sends remove the optimistic entry, restore the draft, and show Danish error feedback. Mention notification failure never reverses a successfully saved message.

### Mentions

Typing `@` opens a picker containing only the task team. The task team consists of the task owner and users invited or assigned to that task. It does not include every member of the parent project.

Selecting a member inserts `@Name` and records that member's profile ID. Before sending, selected mention IDs are retained only while their inserted token still exists in the body. Manually typing a matching name without selecting it does not create a mention. Rendered tokens for IDs stored on the message are highlighted.

### Unread badge

Each task surface owns one `useTaskChatUnread` hook. It shows the current user's unread message count in a small red circular badge on the Chat tab header. Messages sent by the current user do not increment the count.

Opening Chat marks the task read for only the current user and resets their badge to zero. The read cursor is persisted so unread state survives reloads and remains user-specific. Realtime message events update the badge while Chat is inactive. Realtime read-cursor events keep multiple open sessions for the same user consistent.

## Component Architecture

### `TaskChatTab`

Props:

- `taskId`
- `projectId: string | null`
- `projectTeam` containing only the normalized task-team members
- `currentUserId`
- `currentUserName`

The component owns history, draft text, selected mention IDs, attachment preparation, optimistic messages, send state, Realtime subscription, and scrolling. The parent owns the active-tab state and unread badge.

Photo preparation follows the existing documentation flow: `FilePicker` accepts images, `processFileForStorage` produces a data URL, `fetch(dataUrl)` produces a Blob, and `sendTaskChatMessage` uploads it through `uploadTaskFile`.

### Task-team normalization

Parents normalize task assignees and owners into the `projectTeam` prop shape. Project-task members are resolved from `task.assignees`, `task.ownerId`, and matching project team records. Standalone task members are resolved from `task.assignees`, the task owner, and loaded quick-task access/profile data already available to `TaskDetailPage`.

Only UUID-backed profile members are mentionable. Pending email placeholders without a profile ID are not sent as mention IDs.

### `TaskFormModal`

Add `chat` to the active-tab union and render a Chat tab with `MessageSquareIcon`. Unsaved tasks show a save-first placeholder. Saved project tasks render `TaskChatTab`, pass a filtered task team, and show the per-user unread badge in the custom tab header.

### `TaskDetailPage`

Replace the existing comments-array Chat thread and fixed composer with `TaskChatTab`. Remove chat-only legacy state and handlers made obsolete by the canonical service. Keep the existing Chat tab but attach its unread badge through the shared `Tabs` component's `badge` field.

This is the surface that ensures standalone tasks receive the same chat implementation.

## Data Model and RLS

Create an additive migration using the Supabase CLI.

### `task_chat_messages`

Change `project_id` to nullable. Project tasks continue storing their project UUID; standalone tasks store null.

Update SELECT and INSERT policies so authenticated users may access a message when either:

- the task belongs to a project and the caller has project/task access under the existing project-resource rules; or
- the task is standalone and `is_quick_task_accessible(task_id)` authorizes the owner or invited/assigned participant.

INSERT continues requiring `sender_id = auth.uid()`. Existing sender/owner/manager delete behavior remains, extended so the standalone task owner can moderate their task.

### `task_chat_reads`

Columns:

- `task_id UUID` referencing `tasks(id)` with cascade delete
- `user_id UUID` referencing `profiles(id)` with cascade delete
- `last_read_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`
- primary key `(task_id, user_id)`

RLS restricts every operation to `user_id = auth.uid()` and additionally requires access to the referenced task. Users cannot read or mutate another user's cursor. Add the table to `supabase_realtime` so a user's other active session can observe cursor updates.

Indexes support unread counts by task/time and read lookup by user/task.

## Client Service

Extend `services/taskChat.ts` with:

- message history errors that throw instead of silently returning an empty thread;
- existing send and task-filtered Realtime subscription for nullable `projectId`;
- `getTaskChatUnreadCount(taskId, userId)`;
- `markTaskChatRead(taskId, userId)` using upsert;
- `subscribeToTaskChatUnread(taskId, userId, callbacks)` for message and read-cursor events;
- the existing best-effort `notifyMentions` request.

Unread count is the number of messages for the task whose sender differs from the current user and whose `created_at` is newer than that user's read cursor. With no cursor, all messages from other users are unread.

## Push Endpoint and Authorization

Add `POST /api/push/notify` beside the existing push routes with `sensitiveLimiter`, `getAuthenticatedUser`, and `supabaseAdmin`.

Validate the body:

- `taskId` is a UUID/string identifier;
- `mentionedUserIds` is a bounded array of unique UUIDs;
- `preview` and `link` are bounded strings;
- the link is normalized server-side to the task route rather than trusting an external URL.

Load the task (`project_id`, `owner_id`, `assignees`) and reconstruct access server-side.

For a project task, caller authorization accepts the project owner, active mirrored team member, active project resource, task assignee, or task-authorized resource. For a standalone task, caller authorization accepts the task owner, assignee, or pending/active `quick_task_access` participant.

The valid mention recipient set is narrower: task owner plus UUID-backed task assignees and users with explicit task access. Intersect the client IDs with this set, remove the sender, and deduplicate before notification.

For every valid recipient:

- insert `notifications` with `type = 'task_chat_mention'`, the task link, and `metadata = { task_id }`;
- send web push to all `push_subscriptions` with title `Du er nævnt i en opgavechat`.

Generalize `notifyUserAndPush` to accept `type`, `title`, and `metadata`, retaining its current admin defaults. Notification insertion errors are reported to the route; individual web-push delivery errors remain best-effort.

## Error Handling

- History failure renders an explicit Danish error state, not an empty conversation.
- Attachment preparation failure preserves the text draft and shows a toast.
- Send failure restores text, mention selections, and attachment state.
- Realtime duplicates are ignored by ID.
- Notification failure is logged but does not make the already-sent chat message appear failed.
- Invalid, unauthorized, or non-team mention recipients are silently excluded; an unauthorized sender receives 403.
- Missing task returns 404; invalid payload returns 400; unavailable server database configuration returns 503.

## Testing

### Client

- history loading and explicit failure state;
- own/other bubble rendering and attachment URL resolution;
- optimistic insert replacement and Realtime deduplication;
- auto-scroll trigger;
- mention picker filtering, token insertion, ID resolution, and highlighted rendering;
- photo preparation and send payload;
- best-effort mention notification after successful send;
- per-user unread count excluding own messages;
- Realtime badge increment while inactive;
- opening Chat upserts only the current user's cursor and clears the badge;
- modal saved/unsaved wiring and badge rendering;
- `TaskDetailPage` uses the canonical component instead of legacy comments.

### Server

- rejects unauthenticated and unauthorized callers;
- recognizes project owner, active project/task resource, assignee, standalone owner, and quick-task participant;
- intersects recipients with the task-team allowlist;
- excludes sender, invalid IDs, unrelated project users, and duplicates;
- inserts the required notification type/link/metadata;
- passes title/type/metadata through the generalized push helper;
- treats individual web-push failures as non-fatal.

### Database and verification

- migration assertions cover nullable project IDs and per-user read RLS;
- focused Vitest suites run before the full suite;
- TypeScript, scoped ESLint, production build, and relevant server tests must pass;
- where a local Supabase instance is available, exercise project and standalone RLS with separate authenticated users.

## Security Properties

- The service-role key remains server-only.
- The server never trusts client-provided mention recipients or membership.
- RLS remains the primary protection for message history and inserts.
- Read cursors are private per user.
- Notification links cannot become arbitrary external push URLs.
- Message and preview lengths, recipient count, and attachment type are bounded at their respective boundaries.
