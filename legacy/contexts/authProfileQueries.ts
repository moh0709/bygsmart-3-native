export type QueryResult<T> = {
    data: T | null;
    error: { message?: string } | null;
};

export const findProfileByUsername = async <T>(
    client: { from: (table: 'profiles') => any },
    username: string,
    columns: string
): Promise<QueryResult<T>> => {
    return client
        .from('profiles')
        .select(columns)
        .ilike('username', username)
        .maybeSingle();
};

export const isSupabaseDuplicateSignupResponse = (user: unknown): boolean => {
    if (!user || typeof user !== 'object' || !('identities' in user)) {
        return false;
    }

    const identities = (user as { identities?: unknown }).identities;
    return Array.isArray(identities) && identities.length === 0;
};
