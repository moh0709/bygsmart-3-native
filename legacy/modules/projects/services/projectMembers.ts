import { authenticatedServerFetch } from '../../../services/api/http';

// --- TERMINATE PROJECT MEMBER (/api/project/terminate-member) ---
// Owner-only: server verifies the caller is the project OWNER, generates an
// OVERDRAGELSESRAPPORT (handover report), revokes the member's access, emails
// the report to the removed member, notifies them in-app, and writes an audit
// record. The call goes through authenticatedServerFetch so the Express server
// can verify the caller.

export interface TerminateMemberResult {
    ok: boolean;
    emailStatus: 'sent' | 'failed' | 'skipped';
    reportSignedUrl: string | null;
    error?: string;
}

export const terminateProjectMember = async ({
    projectId,
    removedUserId,
}: {
    projectId: string;
    removedUserId: string;
}): Promise<TerminateMemberResult> => {
    const res = await authenticatedServerFetch('/project/terminate-member', {
        method: 'POST',
        body: JSON.stringify({ projectId, removedUserId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return {
            ok: false,
            emailStatus: 'skipped',
            reportSignedUrl: null,
            error: (data as any).error || `Serverfejl (${res.status}).`,
        };
    }
    return data as TerminateMemberResult;
};
