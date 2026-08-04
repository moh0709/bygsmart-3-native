import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Avatar, Card, CardTitle, Select, SkeletonList } from '../../../../components/ui';
import { useToast } from '../../../../contexts/ToastContext';
import { useAuth } from '../../../../contexts/AuthProvider';
import { listOrgMembers, type OrgMember } from '../../../../services/organizations';
import {
  listTimeResponsibles,
  setTimeResponsible,
  type TimeResponsible,
} from '../../services/timeRegistrations';

/**
 * CEO-only: assigns the "ansvarlig" (approver) per staff member. Unassigned
 * staff fall back to the org owner at submit time (RPC fallback), so the
 * default option reads "Ejeren (standard)".
 */
export const AnsvarligeSection: React.FC<{ orgId: string; ownerUserId: string }> = ({ orgId, ownerUserId }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [mapping, setMapping] = useState<TimeResponsible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, r] = await Promise.all([listOrgMembers(orgId), listTimeResponsibles(orgId)]);
      setMembers(m.filter((mem) => mem.status === 'active' && mem.userId));
      setMapping(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente medlemmer.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const responsibleFor = (staffUserId: string): string =>
    mapping.find((r) => r.staffUserId === staffUserId)?.responsibleUserId ?? '';

  const handleChange = async (staffUserId: string, responsibleUserId: string) => {
    if (!user) return;
    const previous = mapping;
    setMapping((prev) => {
      const rest = prev.filter((r) => r.staffUserId !== staffUserId);
      return responsibleUserId ? [...rest, { staffUserId, responsibleUserId }] : rest;
    });
    try {
      await setTimeResponsible(orgId, staffUserId, responsibleUserId || null, user.id);
      showToast('Ansvarlig opdateret.', 'success');
    } catch (e) {
      setMapping(previous);
      showToast(e instanceof Error ? e.message : 'Kunne ikke gemme ansvarlig.', 'error');
    }
  };

  const staff = members.filter((m) => m.userId !== ownerUserId);

  return (
    <Card padding="md">
      <CardTitle className="mb-1">Ansvarlige</CardTitle>
      <p className="text-caption text-text-secondary dark:text-text-dark-secondary mb-3">
        Vælg hvem der godkender hver medarbejders tidsregistrering. Uden et valg går
        registreringen til dig som ejer.
      </p>

      {loading ? (
        <SkeletonList count={2} label="Henter medlemmer…" />
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : staff.length === 0 ? (
        <Alert variant="info">Organisationen har ingen andre aktive medlemmer endnu.</Alert>
      ) : (
        <div className="space-y-2">
          {staff.map((member) => (
            <div key={member.userId} className="flex items-center gap-3">
              <Avatar name={member.name} size="sm" />
              <span className="min-w-0 grow text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                {member.name}
              </span>
              <div className="w-48 shrink-0">
                <Select
                  aria-label={`Ansvarlig for ${member.name}`}
                  value={responsibleFor(member.userId!)}
                  onChange={(e) => handleChange(member.userId!, e.target.value)}
                >
                  <option value="">Ejeren (standard)</option>
                  {members
                    .filter((m) => m.userId !== member.userId)
                    .map((m) => (
                      <option key={m.userId} value={m.userId!}>
                        {m.name}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
