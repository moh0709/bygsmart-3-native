import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthProvider';
import { Avatar, Badge, Button, Card } from '../ui';

interface TeamInvite {
  seat_id: string;
  team_id: string;
  team_name: string;
  leader_name: string;
  leader_initials: string;
  subscription_tier: string;
}

const UsersRoundIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5M12 12a4 4 0 100-8 4 4 0 000 8z" />
  </svg>
);

const TeamInviteBanner: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const loadInvites = useCallback(async () => {
    try {
       
      const { data } = await (supabase as any).rpc('get_my_team_invites');
      setInvites(data ?? []);
    } catch {
      // Silently ignore — this banner is non-critical
    }
  }, []);

  useEffect(() => {
    loadInvites();

    // Re-check whenever a new notification arrives (invite was just sent)
    const channel = supabase
      .channel('team-invite-banner')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`,
      }, () => {
        loadInvites();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadInvites, user?.id]);

  const handleAccept = async (invite: TeamInvite) => {
    setActionInProgress(invite.seat_id);
    try {
       
      const { error } = await (supabase as any).rpc('accept_team_invite', { p_seat_id: invite.seat_id });
      if (error) throw error;
      if (refreshUser) await refreshUser();
      setInvites(prev => prev.filter(i => i.seat_id !== invite.seat_id));
      navigate('/team');
    } catch {
      setActionInProgress(null);
    }
  };

  const handleDecline = async (invite: TeamInvite) => {
    setActionInProgress(invite.seat_id);
    try {
       
      const { error } = await (supabase as any).rpc('decline_team_invite', { p_seat_id: invite.seat_id });
      if (error) throw error;
      setInvites(prev => prev.filter(i => i.seat_id !== invite.seat_id));
    } catch {
      setActionInProgress(null);
    }
  };

  const handleDismiss = (seatId: string) => {
    setDismissed(prev => new Set(prev).add(seatId));
  };

  const visible = invites.filter(i => !dismissed.has(i.seat_id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      {visible.map(invite => (
        <Card
          key={invite.seat_id}
          padding="md"
          className="invite-glow relative border-2"
          style={{ ['--glow-color' as any]: 'var(--color-success)' }}
        >
          {/* Dismiss × */}
          <button
            type="button"
            onClick={() => handleDismiss(invite.seat_id)}
            className="absolute top-1 right-1 z-10 flex h-11 w-11 items-center justify-center rounded-full text-text-tertiary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary transition-colors"
            aria-label="Luk"
          >
            <span className="text-heading leading-none" aria-hidden="true">×</span>
          </button>

          {/* Who / what */}
          <div className="flex items-start gap-3 pr-10">
            <Avatar name={invite.leader_name || '?'} size="md" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="success" className="font-bold uppercase tracking-wide">Du er inviteret</Badge>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                <UsersRoundIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                Teaminvitation
              </p>
              <p className="mt-1 text-body text-text-primary dark:text-text-dark-primary leading-snug">
                <span className="font-semibold">{invite.leader_name}</span>
                <span className="text-text-secondary dark:text-text-dark-secondary"> har inviteret dig til teamet </span>
                <span className="font-semibold">"{invite.team_name}"</span>
              </p>
              <p className="mt-0.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                Adgang: <span className="font-semibold">{invite.subscription_tier}</span>
              </p>
            </div>
          </div>

          {/* Actions — 1 primary + 1 secondary */}
          <div className="flex gap-2 mt-4">
            <Button
              className="flex-1"
              loading={actionInProgress === invite.seat_id}
              onClick={() => handleAccept(invite)}
            >
              Accepter
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-danger hover:text-danger"
              disabled={actionInProgress === invite.seat_id}
              onClick={() => handleDecline(invite)}
            >
              Afvis
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default TeamInviteBanner;
