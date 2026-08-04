import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthProvider';
import { supabase } from '../../../services/supabaseClient';
import {
  Alert,
  AppScreen,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  SkeletonList,
} from '../../../components/ui';
import { UsersIcon } from '../../../components/icons';

interface TeamInvite {
  seat_id: string;
  team_id: string;
  team_name: string;
  leader_name: string;
  leader_initials: string;
  subscription_tier: string;
  created_at: string;
}

const TeamInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null); // seat_id

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {

      const { data, error: rpcErr } = await (supabase as any).rpc('get_my_team_invites');
      if (rpcErr) throw rpcErr;
      setInvites(data ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Kunne ikke hente invitationer');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleAccept = async (seatId: string) => {
    setActionInProgress(seatId);
    setError(null);
    try {

      const { error: rpcErr } = await (supabase as any).rpc('accept_team_invite', { p_seat_id: seatId });
      if (rpcErr) throw rpcErr;
      // Refresh the auth user so teamId / subscriptionTier update in context
      if (refreshUser) await refreshUser();
      setInvites(prev => prev.filter(i => i.seat_id !== seatId));
      navigate('/team');
    } catch (e: any) {
      setError(e.message ?? 'Kunne ikke acceptere invitation');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDecline = async (seatId: string) => {
    setActionInProgress(seatId);
    setError(null);
    try {

      const { error: rpcErr } = await (supabase as any).rpc('decline_team_invite', { p_seat_id: seatId });
      if (rpcErr) throw rpcErr;
      setInvites(prev => prev.filter(i => i.seat_id !== seatId));
    } catch (e: any) {
      setError(e.message ?? 'Kunne ikke afvise invitation');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <AppScreen
      hasBottomNav={false}
      width="reading"
      header={{ title: 'Teaminvitationer', back: '/home' }}
    >
      <div className="max-w-md mx-auto w-full flex flex-col gap-4 mt-2">
        {error && (
          <Alert variant="danger" title="Der opstod en fejl">{error}</Alert>
        )}

        {loading ? (
          <SkeletonList count={1} label="Indlæser invitationer…" />
        ) : invites.length === 0 ? (
          <Card padding="md">
            <EmptyState
              icon={<UsersIcon className="w-7 h-7" />}
              title="Ingen afventende invitationer"
              description="Når en teamleder inviterer dig, vises invitationen her."
            />
          </Card>
        ) : (
          invites.map(invite => (
            <Card key={invite.seat_id} padding="md">
              {/* Leader avatar + team context */}
              <div className="flex items-center gap-3">
                <Avatar name={invite.leader_name} size="md" />
                <div className="min-w-0 grow">
                  <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                    {invite.leader_name}
                  </p>
                  <p className="text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                    Inviterer dig til <span className="font-semibold">{invite.team_name}</span>
                  </p>
                </div>
                <Badge variant={invite.subscription_tier === 'PREMIUM' ? 'warning' : 'info'}>
                  {invite.subscription_tier}
                </Badge>
              </div>

              <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-3">
                Dit abonnement bliver opgraderet til <strong>{invite.subscription_tier}</strong>{' '}
                automatisk, når du accepterer.
              </p>

              <div className="flex gap-2 mt-4">
                <Button
                  fullWidth
                  loading={actionInProgress === invite.seat_id}
                  onClick={() => handleAccept(invite.seat_id)}
                >
                  Accepter invitation
                </Button>
                <Button
                  fullWidth
                  variant="ghost"
                  disabled={actionInProgress === invite.seat_id}
                  onClick={() => handleDecline(invite.seat_id)}
                >
                  Afvis
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </AppScreen>
  );
};

export default TeamInvitePage;
