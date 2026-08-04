import React, { useState, useEffect } from 'react';
import { Project } from '../../../types';
import { Badge, Modal, cn } from '../../../components/ui';
import { getProfileById } from '../../../services/api';

// ─── Assignee Profile Modal ───────────────────────────────────────────────────

export const AssigneeProfileModal: React.FC<{
  assignee: { id: string; initials: string; name: string; isOwner?: boolean };
  projectTeam: Project['team'];
  onClose: () => void;
}> = ({ assignee, projectTeam, onClose }) => {
  const member = projectTeam.find(m => m.id === assignee.id);
  const [company, setCompany] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    setLoadingProfile(true);
    getProfileById(assignee.id)
      .then(p => { if (p?.companyName) setCompany(p.companyName); })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [assignee.id]);

  const roleLabel = member?.role === 'OWNER' ? 'Ejer'
    : member?.role === 'EXTERNAL' ? 'Underentreprenør'
    : member?.role === 'MANAGER' ? 'Projektleder'
    : 'Medarbejder';

  const isExternal = member?.role === 'EXTERNAL';
  const avatarBg = isExternal
    ? 'bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning'
    : 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light';

  return (
    <Modal open onClose={onClose} title="Profil">
      <div className="flex flex-col items-center gap-4 py-2">
        <div className={cn('w-16 h-16 rounded-full flex items-center justify-center text-title', avatarBg)}>
          {assignee.initials}
        </div>
        <div className="text-center">
          <p className="text-heading text-text-primary dark:text-text-dark-primary">{assignee.name}</p>
          <Badge variant={isExternal ? 'warning' : 'info'} className="mt-1">{roleLabel}</Badge>
        </div>
        <div className="w-full divide-y divide-border dark:divide-border-dark text-label">
          {member?.email && (
            <div className="flex justify-between py-2.5">
              <span className="text-text-secondary dark:text-text-dark-secondary">Email</span>
              <span className="font-medium text-text-primary dark:text-text-dark-primary truncate max-w-[60%] text-right">{member.email}</span>
            </div>
          )}
          {!loadingProfile && company && (
            <div className="flex justify-between py-2.5">
              <span className="text-text-secondary dark:text-text-dark-secondary">Virksomhed</span>
              <span className="font-medium text-text-primary dark:text-text-dark-primary">{company}</span>
            </div>
          )}
          <div className="flex justify-between py-2.5">
            <span className="text-text-secondary dark:text-text-dark-secondary">Bruger-ID</span>
            <span className="font-mono text-caption text-text-tertiary dark:text-text-dark-tertiary">{assignee.id.slice(0, 12)}…</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
