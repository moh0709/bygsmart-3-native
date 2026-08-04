import { authenticatedServerFetch } from '../../../services/api/http';

// Logs generation of an on-demand AI project handover report ("Overdragelsesrapport",
// see services/gemini.ts generateHandoverReport) so admin insights can count it —
// this report is otherwise generated and saved entirely client-side and never
// touches the backend. Best-effort: failures are swallowed so a logging hiccup
// never blocks the user's PDF download.
export const logAiHandoverReport = async (projectId: string): Promise<void> => {
    try {
        await authenticatedServerFetch('/reports/ai-handover', {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        });
    } catch (err) {
        console.warn('logAiHandoverReport failed (non-fatal):', err);
    }
};
