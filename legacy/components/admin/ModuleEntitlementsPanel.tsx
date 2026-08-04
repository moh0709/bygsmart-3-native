import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  Modal,
  SkeletonList,
  cn,
} from '../ui';
import {
  EntitlementAdminOrg,
  ModuleAccessConfig,
  OrgModuleOverride,
  clearOrgOverride,
  listEntitlementOrgsAdmin,
  listModuleConfigsAdmin,
  listOrgOverridesAdmin,
  saveOrgOverride,
  saveModuleConfig,
} from '../../services/moduleEntitlements';
import { MODULE_IDS, ModuleId } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { useEntitlements } from '../../core/entitlements/EntitlementsProvider';

// ─────────────────────────────────────────────────────────────────────────────
// ModuleEntitlementsPanel — admin UI for the global module defaults
// (module_access_configs). Mirrors ToolAccessPanel structure.
//
// Phase 1: kill-switch + min-tier per module, platform-wide. Phase 3 adds an
// org selector for per-org overrides (org_module_entitlements).
// ─────────────────────────────────────────────────────────────────────────────

type Tier = 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE';
const TIERS: Tier[] = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];

// Local accessible toggle — mirrors the Switch used on the main Settings page.
const Switch: React.FC<{
  checked: boolean;
  onChange: () => void;
  'aria-label': string;
}> = ({ checked, onChange, 'aria-label': ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked ? 'true' : 'false'}
    aria-label={ariaLabel}
    onClick={onChange}
    className="shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center"
  >
    <span
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150',
        checked ? 'bg-brand-primary' : 'bg-border-strong dark:bg-border-dark-strong',
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </span>
  </button>
);

const GROUP_ORDER = ['Foundation', 'Operations', 'Commercial', 'Add-ons'] as const;

interface ModuleRow {
  moduleId: ModuleId;
  name: string;
  description: string;
  group: (typeof GROUP_ORDER)[number];
  config: ModuleAccessConfig | null;
}

const stateBadge = (row: ModuleRow) => {
  if (row.config && row.config.enabled === false) return <Badge variant="danger">Deaktiveret</Badge>;
  if (row.config?.min_tier) return <Badge variant="warning">Min. {row.config.min_tier}</Badge>;
  if (row.config) return <Badge variant="success">Aktiv</Badge>;
  return <Badge variant="neutral">Standard</Badge>;
};

// ── Row ──────────────────────────────────────────────────────────────────────

const ModuleRowItem: React.FC<{ row: ModuleRow; onClick: () => void }> = ({ row, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
          {row.name}
        </span>
        {stateBadge(row)}
      </div>
      <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
        {row.description}
        {row.config?.note && (
          <span className="ml-2 italic">· {row.config.note}</span>
        )}
      </p>
    </div>
    <svg
      className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  </button>
);

// ── Editor modal ─────────────────────────────────────────────────────────────

const ModuleEditorModal: React.FC<{
  row: ModuleRow;
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, onClose, onSaved }) => {
  const [enabled, setEnabled] = useState(row.config?.enabled ?? true);
  const [minTier, setMinTier] = useState<Tier | ''>((row.config?.min_tier as Tier | null) ?? '');
  const [note, setNote] = useState(row.config?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveModuleConfig(row.moduleId, {
        enabled,
        minTier: minTier || null,
        note,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl ved gem.');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={row.name}
      description={`Modul-id: ${row.moduleId}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuller
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Gem
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
              Modul aktivt (kill-switch)
            </p>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              Slå fra for at deaktivere modulet for ALLE brugere — den eneste
              regel der lukker mere end standard.
            </p>
          </div>
          <Switch checked={enabled} onChange={() => setEnabled((v) => !v)} aria-label="Modul aktivt" />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1">
            Minimum abonnement (for nye organisationer)
          </label>
          <select
            value={minTier}
            onChange={(e) => setMinTier(e.target.value as Tier | '')}
            className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-bg-dark-surface px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="">Standard (fra modulkatalogets tier-kort)</option>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
            Håndhæves først når tier-kortet aktiveres — eksisterende
            organisationer bevarer alt (grandfather-reglen).
          </p>
        </div>

        <Input
          label="Note (intern)"
          placeholder="F.eks. 'Deaktiveret pga. fejl i integrationen'"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          hint="Vises kun for administratorer."
        />

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
};

// ── Org override editor ──────────────────────────────────────────────────────

const OrgOverrideEditorModal: React.FC<{
  org: EntitlementAdminOrg;
  moduleId: ModuleId;
  override: OrgModuleOverride | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ org, moduleId, override, onClose, onSaved }) => {
  const [status, setStatus] = useState<'enabled' | 'disabled' | 'trial'>(override?.status ?? 'enabled');
  const [validUntil, setValidUntil] = useState(override?.valid_until ? override.valid_until.slice(0, 10) : '');
  const [note, setNote] = useState(override?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveOrgOverride(org.id, moduleId, {
        status,
        validUntil: status === 'trial' && validUntil ? new Date(validUntil).toISOString() : null,
        note,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl ved gem.');
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    try {
      await clearOrgOverride(org.id, moduleId);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke fjerne reglen.');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${MODULE_INFO[moduleId].name} · ${org.name}`}
      description={`Organisation-specifik regel · modul-id: ${moduleId}`}
      size="md"
      footer={
        <>
          {override && (
            <Button variant="ghost" onClick={handleClear} disabled={saving} className="mr-auto text-danger">
              Fjern regel
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>Annuller</Button>
          <Button onClick={handleSave} loading={saving}>Gem</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'enabled' | 'disabled' | 'trial')}
            className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-bg-dark-surface px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="enabled">Aktiveret (uanset abonnement)</option>
            <option value="trial">Prøveperiode (til dato)</option>
            <option value="disabled">Deaktiveret for organisationen</option>
          </select>
        </div>

        {status === 'trial' && (
          <Input
            type="date"
            label="Prøve slutter (dato)"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            hint="Modulet er aktivt frem til denne dato, derefter følger det abonnementet."
          />
        )}

        <Input
          label="Note (intern)"
          placeholder="F.eks. 'Prøve aftalt med kunden på messe'"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
      </div>
    </Modal>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────

const ModuleEntitlementsPanel: React.FC = () => {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [enforceTierMap, setEnforceTierMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ModuleRow | null>(null);
  const { refresh: refreshEntitlements } = useEntitlements();

  // Per-org override state — '' = global defaults view.
  const [orgs, setOrgs] = useState<EntitlementAdminOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [overrides, setOverrides] = useState<Map<string, OrgModuleOverride>>(new Map());
  const [editingOrgModule, setEditingOrgModule] = useState<ModuleId | null>(null);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null;

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [adminData, orgData] = await Promise.all([
        listModuleConfigsAdmin(),
        listEntitlementOrgsAdmin().catch(() => ({ orgs: [] })),
      ]);
      const configMap = new Map(adminData.configs.map((c) => [c.module_id, c]));
      setEnforceTierMap(adminData.enforceTierMap);
      setOrgs(orgData.orgs);
      setRows(
        MODULE_IDS.map((moduleId) => ({
          moduleId,
          name: MODULE_INFO[moduleId].name,
          description: MODULE_INFO[moduleId].description,
          group: MODULE_INFO[moduleId].group,
          config: configMap.get(moduleId) ?? null,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOverrides = useCallback(async () => {
    if (!selectedOrgId) { setOverrides(new Map()); return; }
    try {
      const data = await listOrgOverridesAdmin(selectedOrgId);
      setOverrides(new Map(data.overrides.map((o) => [o.module_id, o])));
    } catch {
      setOverrides(new Map());
    }
  }, [selectedOrgId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { refreshOverrides(); }, [refreshOverrides]);

  if (loading) {
    return <SkeletonList count={4} label="Indlæser modulkonfiguration…" />;
  }

  const orgStateBadge = (moduleId: ModuleId) => {
    const override = overrides.get(moduleId);
    if (!override) {
      return selectedOrg?.grandfathered
        ? <Badge variant="success">Fuld adgang</Badge>
        : <Badge variant="neutral">Følger abonnement</Badge>;
    }
    if (override.status === 'disabled') return <Badge variant="danger">Deaktiveret</Badge>;
    if (override.status === 'trial') return <Badge variant="info">Prøve</Badge>;
    return <Badge variant="success">Aktiveret</Badge>;
  };

  return (
    <div className="space-y-5">
      {error && (
        <Card className="border-danger/40">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Prøv igen
          </Button>
        </Card>
      )}

      <Alert variant={enforceTierMap ? 'info' : 'warning'}>
        {enforceTierMap
          ? 'Tier-håndhævelse er AKTIV: grandfathered organisationer beholder alt; nye organisationer følger deres abonnement + regler herunder.'
          : 'NØDTILSTAND: Tier-håndhævelse er slået fra (MODULE_TIER_MAP_ENFORCED=false) — alle moduler er aktive for alle.'}
      </Alert>

      {/* Scope selector: global defaults vs a specific organization */}
      <Card>
        <CardTitle>Omfang</CardTitle>
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="mt-2 w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-bg-dark-surface px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="">Globale standarder (alle organisationer)</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}{org.grandfathered ? ' · fuld adgang' : ''}
            </option>
          ))}
        </select>
        {selectedOrg?.grandfathered && (
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-2">
            Denne organisation er grandfathered — alle moduler er aktive uanset abonnement.
            En "Deaktiveret"-regel her lukker stadig et modul for den.
          </p>
        )}
      </Card>

      {GROUP_ORDER.map((group) => {
        const groupRows = rows.filter((r) => r.group === group);
        if (groupRows.length === 0) return null;
        return (
          <Card key={group} padding="none">
            <div className="p-4 sm:p-5 pb-2">
              <CardTitle>{group}</CardTitle>
              {!selectedOrgId && (
                <CardDescription>
                  {groupRows.filter((r) => !(r.config && r.config.enabled === false)).length} af {groupRows.length} aktive
                </CardDescription>
              )}
            </div>
            <div className="divide-y divide-border dark:divide-border-dark">
              {groupRows.map((row) =>
                selectedOrgId ? (
                  <button
                    key={row.moduleId}
                    type="button"
                    onClick={() => setEditingOrgModule(row.moduleId)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                          {row.name}
                        </span>
                        {orgStateBadge(row.moduleId)}
                      </div>
                      <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
                        {row.description}
                        {overrides.get(row.moduleId)?.note && (
                          <span className="ml-2 italic">· {overrides.get(row.moduleId)!.note}</span>
                        )}
                      </p>
                    </div>
                  </button>
                ) : (
                  <ModuleRowItem key={row.moduleId} row={row} onClick={() => setEditing(row)} />
                )
              )}
            </div>
          </Card>
        );
      })}

      {editing && !selectedOrgId && (
        <ModuleEditorModal
          key={editing.moduleId}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setLoading(true);
            refresh();
            // Reflect flips in this admin's own session immediately.
            refreshEntitlements();
          }}
        />
      )}

      {editingOrgModule && selectedOrg && (
        <OrgOverrideEditorModal
          key={`${selectedOrg.id}:${editingOrgModule}`}
          org={selectedOrg}
          moduleId={editingOrgModule}
          override={overrides.get(editingOrgModule) ?? null}
          onClose={() => setEditingOrgModule(null)}
          onSaved={() => {
            setEditingOrgModule(null);
            refreshOverrides();
            refreshEntitlements();
          }}
        />
      )}
    </div>
  );
};

export default ModuleEntitlementsPanel;
