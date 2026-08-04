import { authenticatedServerFetch } from './http';

// --- SMTP CONFIG (/api/smtp/*) ---
// Global config is admin-only; custom config is per-subscription-owner. Passwords
// are never returned — the safe shape exposes hasPassword (bool) only. All calls
// go through authenticatedServerFetch so the Express server can verify the caller.

export type SmtpScope = 'global' | 'custom';

/** Safe response shape returned by GET/PUT /api/smtp/{global,custom}. */
export interface SmtpConfigShape {
    scope: 'global' | 'custom' | null;
    host: string | null;
    port: number | null;
    secure: boolean;
    username: string | null;
    fromName: string | null;
    fromEmail: string | null;
    enabled: boolean;
    hasPassword: boolean;
    updatedAt: string | null;
}

/** Body for PUT /api/smtp/{scope}. Omit `password` to keep the stored value. */
export interface SmtpSavePayload {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password?: string;
    fromName: string;
    fromEmail: string;
    enabled: boolean;
}

export interface SmtpActionResult {
    ok: boolean;
    error?: string;
}

const smtpConfigPath = (scope: SmtpScope): string =>
    scope === 'global' ? '/smtp/global' : '/smtp/custom';

export const getSmtpConfig = async (scope: SmtpScope): Promise<SmtpConfigShape> => {
    const res = await authenticatedServerFetch(smtpConfigPath(scope));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error((data as any).error || `Serverfejl (${res.status}).`);
    }
    return data as SmtpConfigShape;
};

export const saveSmtpConfig = async (
    scope: SmtpScope,
    payload: SmtpSavePayload
): Promise<SmtpConfigShape> => {
    const res = await authenticatedServerFetch(smtpConfigPath(scope), {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error((data as any).error || `Serverfejl (${res.status}).`) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return data as SmtpConfigShape;
};

export const testSmtpConnection = async (scope: SmtpScope): Promise<SmtpActionResult> => {
    const res = await authenticatedServerFetch('/smtp/test-connection', {
        method: 'POST',
        body: JSON.stringify({ scope }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return { ok: false, error: (data as any).error || `Serverfejl (${res.status}).` };
    }
    return data as SmtpActionResult;
};

export const sendSmtpTestEmail = async (scope: SmtpScope): Promise<SmtpActionResult> => {
    const res = await authenticatedServerFetch('/smtp/send-test', {
        method: 'POST',
        body: JSON.stringify({ scope }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return { ok: false, error: (data as any).error || `Serverfejl (${res.status}).` };
    }
    return data as SmtpActionResult;
};
