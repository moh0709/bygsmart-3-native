import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { acceptTaskInvitation, declineTaskInvitation } from '../../services/api';
import { useAuth } from '../../contexts/AuthProvider';
import InviteIdReveal from './InviteIdReveal';
import { Avatar, Badge, Button, Card } from '../ui';

interface TaskInviteNotification {
  id: string;
  text: string;
  metadata: {
    task_id: string;
    project_id: string;
    task_title: string;
    project_name: string;
    inviter_name: string;
    inviter_initials: string;
    member_kind: 'staff' | 'partner';
    /** Optional hierarchical step (e.g. "1.2") for a friendly "Opgave 1.2" label. */
    task_step?: string;
  };
}

/** First 8 hex chars of the task UUID, uppercased — a stable short fallback code. */
const shortTaskCode = (id: string) =>
  id.replace(/-/g, '').substring(0, 8).toUpperCase();

const ClipboardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const TaskInvitationCarousel: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<TaskInviteNotification[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await (supabase as any)
        .from('notifications')
        .select('id, text, metadata')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('type', 'task_invite');
      setInvitations((data ?? []) as TaskInviteNotification[]);
    } catch {
      // Non-critical
    }
  }, [user]);

  useEffect(() => {
    loadInvitations();

    const channel = supabase
      .channel('task-invite-carousel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`,
      }, () => {
        loadInvitations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadInvitations, user?.id]);

  const handleAccept = async (notif: TaskInviteNotification) => {
    if (!user) return;
    setActionInProgress(notif.id);
    try {
      await acceptTaskInvitation(notif.id);
      setInvitations(prev => prev.filter(i => i.id !== notif.id));
    } catch {
      // ignore
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDecline = async (notif: TaskInviteNotification) => {
    setActionInProgress(notif.id);
    try {
      await declineTaskInvitation(notif.id);
      setInvitations(prev => prev.filter(i => i.id !== notif.id));
    } catch {
      // ignore
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDismiss = (id: string) => {
    setInvitations(prev => prev.filter(i => i.id !== id));
  };

  if (invitations.length === 0) return null;

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-1 pt-2 px-1 mb-4"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      {invitations.map(notif => {
        const meta = notif.metadata;
        const isStaff = meta.member_kind === 'staff';
        const taskLabel = meta.task_step
          ? `Opgave ${meta.task_step}`
          : `Opgave #${shortTaskCode(meta.task_id)}`;

        return (
          <Card
            key={notif.id}
            padding="md"
            className="invite-glow relative shrink-0 w-[calc(100vw-2rem)] sm:w-[380px] max-w-sm border-2"
            style={{ ['--glow-color' as any]: 'var(--color-brand-primary)', scrollSnapAlign: 'start' }}
          >
            {/* Dismiss × */}
            <button
              type="button"
              onClick={() => handleDismiss(notif.id)}
              className="absolute top-1 right-1 z-10 flex h-11 w-11 items-center justify-center rounded-full text-text-tertiary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary transition-colors"
              aria-label="Luk"
            >
              <span className="text-heading leading-none" aria-hidden="true">×</span>
            </button>

            {/* Who / what / when */}
            <div className="flex items-start gap-3 pr-10">
              <Avatar name={meta.inviter_name || '?'} size="md" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="success" className="font-bold uppercase tracking-wide">Du er inviteret</Badge>
                  <Badge variant={isStaff ? 'info' : 'warning'} className="uppercase tracking-wide">
                    {isStaff ? 'Intern' : 'Underentreprenør'}
                  </Badge>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                  <ClipboardIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Opgaveinvitation
                </p>
                <p className="mt-1 text-body font-semibold text-text-primary dark:text-text-dark-primary leading-snug">
                  "{meta.task_title}"
                </p>
                <p className="mt-0.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                  Projekt: <span className="font-semibold text-text-primary dark:text-text-dark-primary">{meta.project_name}</span>
                </p>
                <p className="mt-0.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                  Inviteret af <span className="font-semibold text-text-primary dark:text-text-dark-primary">{meta.inviter_name}</span>
                </p>
                <div className="mt-1.5 text-text-secondary dark:text-text-dark-secondary">
                  <InviteIdReveal label={taskLabel} fullId={meta.task_id} />
                </div>
              </div>
            </div>

            {/* Actions — 1 primary + 1 secondary */}
            <div className="flex gap-2 mt-4">
              <Button
                className="flex-1"
                loading={actionInProgress === notif.id}
                onClick={() => handleAccept(notif)}
              >
                Accepter
              </Button>
              <Button
                variant="ghost"
                className="flex-1 text-danger hover:text-danger"
                disabled={actionInProgress === notif.id}
                onClick={() => handleDecline(notif)}
              >
                Afvis
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default TaskInvitationCarousel;
