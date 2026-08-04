import React from 'react';
import { PartnerInvitesPanel } from '../PartnerInvitesPanel';
import { OPEN_STATUSES } from '../partnerStatus';

/**
 * "Kræver handling" wrapper: partner (underleverandør) invitations addressed
 * to me. The panel fetches its own data and hides itself when empty.
 */
export const PartnerInvitesWidget: React.FC = () => (
    <PartnerInvitesPanel mode="partner" hideWhenEmpty statuses={OPEN_STATUSES} />
);
