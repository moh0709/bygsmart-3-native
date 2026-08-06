// @bygsmart/api-client — typed Supabase + /api client.
// The anon key ships inside the binary and is trivially extractable; RLS is the SOLE
// authorisation boundary. This client never introduces client-side-only authorisation.
export const PLACEHOLDER_API_CLIENT = 'bygsmart-api-client' as const;

export * from './auth/client';
export * from './auth/AuthProvider';
export * from './auth/messages';
