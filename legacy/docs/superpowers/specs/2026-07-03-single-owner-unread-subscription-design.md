# Single-owner unread subscription

## Problem

`MainLayout` renders both `NavRail` and `BottomNavBar`. Each component calls
`useProjectUnread()`, so both attempt to register a `postgres_changes` callback
on the same `bottom-nav:notifications` Supabase Realtime channel. The installed
Realtime client reuses channels by topic and rejects adding another callback
after the first channel has subscribed.

## Design

`MainLayout` will call `useProjectUnread()` once. It will pass the resulting
unread count to `NavRail` and `BottomNavBar` through a required numeric prop.
The hook remains responsible for the initial count request, Realtime refreshes,
and channel cleanup.

This keeps one subscription owner for both responsive navigation surfaces.
CSS visibility remains unchanged, and no Supabase package or database changes
are required.

## Error handling

Existing unread-count request and subscription behavior remains unchanged. This
change only removes the duplicate subscription. Existing error handling in the
API and Supabase client layers remains responsible for request failures.

## Verification

- Add a regression test proving `MainLayout` creates one unread subscription
  while rendering both navigation surfaces with the same count.
- Run the focused regression test and observe it fail before implementation.
- Implement the prop flow and rerun the focused test.
- Run the complete test suite, TypeScript check, and production build.

## Out of scope

- Changing channel names to permit duplicate subscriptions.
- Adding a new context/provider for one value.
- Upgrading or pinning Supabase packages.
- Changing authentication or manifest handling.
