import { describe, expect, test, vi } from 'vitest';
import {
    findProfileByUsername,
    isSupabaseDuplicateSignupResponse,
} from './authProfileQueries';

const createProfilesClient = <T,>(result: { data: T | null; error: unknown }) => {
    const query = {
        select: vi.fn(() => query),
        ilike: vi.fn(() => query),
        maybeSingle: vi.fn(async () => result),
    };

    const client = {
        from: vi.fn(() => query),
    };

    return { client, query };
};

describe('auth profile queries', () => {
    test('looks up usernames with maybeSingle so missing rows are not request errors', async () => {
        const { client, query } = createProfilesClient({ data: null, error: null });

        const result = await findProfileByUsername<{ id: string }>(client, 'MOH2990', 'id');

        expect(client.from).toHaveBeenCalledWith('profiles');
        expect(query.select).toHaveBeenCalledWith('id');
        expect(query.ilike).toHaveBeenCalledWith('username', 'MOH2990');
        expect(query.maybeSingle).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ data: null, error: null });
    });

    test('detects Supabase duplicate signup placeholder responses', () => {
        expect(isSupabaseDuplicateSignupResponse({ identities: [] })).toBe(true);
        expect(isSupabaseDuplicateSignupResponse({ identities: [{ id: 'identity-id' }] })).toBe(false);
        expect(isSupabaseDuplicateSignupResponse(null)).toBe(false);
    });
});
