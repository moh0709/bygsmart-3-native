import { supabase } from '../supabaseClient';

// --- SERVER FETCH HELPER ---
// Attaches the current session's JWT so the Express server can verify the caller.
// Uses Vite's proxy (/api → http://localhost:3002) in development and the
// nginx reverse proxy (/api → the server container) in production.
export const authenticatedServerFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(`/api${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...((options.headers as Record<string, string>) || {}),
        },
    });
};
