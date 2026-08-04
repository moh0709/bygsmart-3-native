// @bygsmart/core — partner invitation status (pure).
//
// Harvested from legacy/modules/partners/components/partnerStatus.ts. The Danish
// date formatters there are DOM/locale presentation and stay in the UI layer;
// only the open-negotiation set + status metadata come across. Tones map onto the
// framework-agnostic StatusTone (2.1's 'info' → 'primary', the UI kit has no 'info').

import type { PartnerInviteStatus, StatusTone } from '../types';

/** Danish label + pill tone per partner invitation status. */
export const PARTNER_STATUS_META: Record<PartnerInviteStatus, { label: string; tone: StatusTone }> = {
  invited: { label: 'Inviteret', tone: 'primary' },
  negotiating: { label: 'Forhandler', tone: 'warning' },
  accepted: { label: 'Accepteret', tone: 'success' },
  declined: { label: 'Afvist', tone: 'danger' },
  cancelled: { label: 'Annulleret', tone: 'neutral' },
};

/** Statuses where the negotiation is still open. */
export const OPEN_STATUSES: PartnerInviteStatus[] = ['invited', 'negotiating'];

export const isNegotiationOpen = (status: PartnerInviteStatus): boolean =>
  OPEN_STATUSES.includes(status);
