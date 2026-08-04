import React from 'react';
import TeamInviteBanner from '../../../../components/dashboard/TeamInviteBanner';

/**
 * "Kræver handling" wrapper for the team-invite banner. The banner is shared
 * legacy code that fetches its own data and renders null when empty — this
 * widget just puts it behind the team module's entitlement.
 */
export const TeamInviteWidget: React.FC = () => <TeamInviteBanner />;
