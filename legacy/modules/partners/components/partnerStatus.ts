import type { PartnerInviteStatus } from '../../../types';
import type { BadgeVariant } from '../../../components/ui';

/** Danish labels + Badge variants for partner invitation statuses. */
export const PARTNER_STATUS_META: Record<PartnerInviteStatus, { label: string; variant: BadgeVariant }> = {
    invited: { label: 'Inviteret', variant: 'info' },
    negotiating: { label: 'Forhandler', variant: 'warning' },
    accepted: { label: 'Accepteret', variant: 'success' },
    declined: { label: 'Afvist', variant: 'danger' },
    cancelled: { label: 'Annulleret', variant: 'neutral' },
};

/** Statuses where the negotiation is still open. */
export const OPEN_STATUSES: PartnerInviteStatus[] = ['invited', 'negotiating'];

export const formatDateTimeDa = (iso: string): string =>
    new Date(iso).toLocaleString('da-DK', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

export const formatDateDa = (iso: string | null | undefined): string => {
    if (!iso) return '–';
    return new Date(iso).toLocaleDateString('da-DK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};
