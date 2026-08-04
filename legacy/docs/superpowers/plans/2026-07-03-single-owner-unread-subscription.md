# Single-owner Unread Subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent both responsive navigation surfaces from registering callbacks on the same subscribed Supabase Realtime channel.

**Architecture:** `MainLayout` owns the existing `useProjectUnread()` hook exactly once. It passes the resulting number into `NavRail` and `BottomNavBar` as a required `projectUnread` prop.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Supabase Realtime

---

### Task 1: Add the regression test

**Files:**
- Create: `components/NavigationSubscriptions.test.tsx`
- Test: `components/NavigationSubscriptions.test.tsx`

- [x] **Step 1: Write the failing test**

Create a test-only owner that calls `useProjectUnread()` once and passes the
count to both real navigation components. Mock a Realtime client that reuses a
channel and throws if another Postgres callback is added after subscription.
Assert that rendering does not throw and that `supabase.channel()` is called
once.

- [x] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run components/NavigationSubscriptions.test.tsx`

Expected: FAIL with `cannot add postgres_changes callbacks ... after subscribe()` because both navigation components still call the hook themselves.

### Task 2: Move subscription ownership to MainLayout

**Files:**
- Modify: `App.tsx:21,286-303`
- Modify: `components/BottomNavBar.tsx:28-57`
- Modify: `components/NavRail.tsx:4-18`
- Test: `components/NavigationSubscriptions.test.tsx`

- [x] **Step 1: Make navigation props required**

Change each navigation component to accept:

```tsx
interface NavigationUnreadProps {
  projectUnread: number;
}
```

Remove the internal `useProjectUnread()` calls and render badge state from the
prop. Keep the hook implementation exported from `BottomNavBar.tsx`.

- [x] **Step 2: Add the single owner**

In `MainLayout`, call:

```tsx
const projectUnread = useProjectUnread();
```

Pass it to both surfaces:

```tsx
<NavRail projectUnread={projectUnread} />
{showNavBar && <BottomNavBar projectUnread={projectUnread} />}
```

- [x] **Step 3: Run the focused test**

Run: `npm run test -- --run components/NavigationSubscriptions.test.tsx`

Expected: PASS with one channel creation.

### Task 3: Verify the complete change

**Files:**
- Verify: `App.tsx`
- Verify: `components/BottomNavBar.tsx`
- Verify: `components/NavRail.tsx`
- Verify: `components/NavigationSubscriptions.test.tsx`

- [x] **Step 1: Run all unit tests**

Run: `npm run test -- --run`

Expected: all tests pass.

- [x] **Step 2: Run TypeScript**

Run: `npm run typecheck`

Expected: exit code 0.

- [x] **Step 3: Build production assets**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Verify the running browser**

Reload `http://192.168.0.134:3000/byggeapp/#/home` and confirm the error boundary
is absent and the console no longer contains the duplicate callback error.
