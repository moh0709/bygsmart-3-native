import React, { useEffect, useState } from 'react';
import { AppScreen, Button, SegmentedControl, Skeleton, Alert } from '../../../../components/ui';
import { useAuth } from '../../../../contexts/AuthProvider';
import { useOrg } from '../../../../core/org/OrgProvider';
import { amIOrgTeamLeader, amIResponsibleForAnyone } from '../../services/timeRegistrations';
import { StaffWizard } from './StaffWizard';
import { ManagerOverview } from './ManagerOverview';

type ViewMode = 'overview' | 'wizard';

/**
 * /tidsregistrering — role router (org-anchored per the locked decisions):
 * CEO = org owner; Manager = assigned ansvarlig for ≥1 staff member OR
 * leader of an org work-crew; everyone else lands directly in the staff
 * wizard. CEO/managers get a toggle so they can register their own time too.
 */
const TidsregistreringPage: React.FC = () => {
  const { user } = useAuth();
  const { activeOrg, isLoading: orgLoading } = useOrg();

  const [isManager, setIsManager] = useState<boolean | null>(null);
  const [mode, setMode] = useState<ViewMode>('overview');

  const isCeo = !!(user && activeOrg && activeOrg.createdBy === user.id);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user || !activeOrg) return;
      if (isCeo) {
        if (active) setIsManager(true);
        return;
      }
      const [responsible, leader] = await Promise.all([
        amIResponsibleForAnyone(activeOrg.id, user.id),
        amIOrgTeamLeader(activeOrg.id, user.id),
      ]);
      if (active) setIsManager(responsible || leader);
    })();
    return () => {
      active = false;
    };
  }, [user?.id, activeOrg?.id, isCeo]);

  const header = { title: 'Registrer tid', back: '/home' as const };

  if (orgLoading || !user || (activeOrg && isManager === null)) {
    return (
      <AppScreen header={header}>
        <div className="space-y-3 pt-2">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppScreen>
    );
  }

  if (!activeOrg) {
    return (
      <AppScreen header={header}>
        <Alert variant="warning" title="Ingen aktiv organisation" className="mt-2">
          Tidsregistrering kræver en organisation. Kontakt din administrator.
        </Alert>
      </AppScreen>
    );
  }

  // Staff go straight to the wizard — no toggle, no overview.
  if (!isManager) {
    return (
      <AppScreen header={header}>
        <StaffWizard />
      </AppScreen>
    );
  }

  return (
    // 'wide' only for the Oversigt table view — the registrations table has 8
    // columns (min-w 820px) and would otherwise always scroll inside the
    // default max-w-3xl. The wizard keeps the narrower column flow.
    <AppScreen header={header} width={mode === 'overview' ? 'wide' : 'default'}>
      <div className="pt-2">
        <SegmentedControl<ViewMode>
          label="Skift mellem oversigt og egen registrering"
          value={mode}
          onChange={setMode}
          options={[
            { label: 'Oversigt', value: 'overview' },
            { label: 'Registrer min tid', value: 'wizard' },
          ]}
        />
      </div>
      {mode === 'overview' ? (
        <ManagerOverview orgId={activeOrg.id} ownerUserId={activeOrg.createdBy} isCeo={isCeo} />
      ) : (
        <StaffWizard />
      )}
    </AppScreen>
  );
};

export default TidsregistreringPage;
