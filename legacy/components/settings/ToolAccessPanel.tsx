import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Modal,
  SkeletonList,
} from '../ui';
import {
  AccessLevel,
  AdvancedAccessLevel,
  ToolAccessConfig,
  listToolAccessAdmin,
  saveToolAccess,
} from '../../services/toolAccess';
import { listCalculators } from '../../modules/tools';

// ─────────────────────────────────────────────────────────────────────────────
// ToolAccessPanel — admin UI for per-tool access level and campaign gating.
// Mirrors AiOrchestrationPanel structure.
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  free: 'Gratis',
  pro: 'Pro',
  campaign: 'Kampagne (midlertidigt gratis)',
};

const ADVANCED_LEVEL_LABELS: Record<AdvancedAccessLevel, string> = {
  free: 'Gratis',
  pro: 'Pro',
  campaign: 'Kampagne',
  inherit: 'Arver basis-niveau',
};

const accessBadge = (level: AccessLevel) => {
  if (level === 'free') return <Badge variant="success">Gratis</Badge>;
  if (level === 'campaign') return <Badge variant="info">Kampagne</Badge>;
  return <Badge variant="warning">Pro</Badge>;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleDateString('da-DK', { dateStyle: 'medium' });
  } catch {
    return '–';
  }
};

// ── Tool row ─────────────────────────────────────────────────────────────────

interface ToolRow {
  toolId: string;
  name: string;
  category: string;
  config: ToolAccessConfig | null;
}

const ToolRowItem: React.FC<{ row: ToolRow; onClick: () => void }> = ({ row, onClick }) => (
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
        {row.config ? accessBadge(row.config.access_level) : <Badge variant="neutral">Standard</Badge>}
      </div>
      <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
        {row.category}
        {row.config?.campaign_until && (
          <span className="ml-2 text-success-strong dark:text-success">
            · Kampagne til {formatDate(row.config.campaign_until)}
          </span>
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

interface EditorState {
  accessLevel: AccessLevel;
  campaignUntil: string;
  advancedAccessLevel: AdvancedAccessLevel;
  advancedCampaignUntil: string;
  note: string;
}

const ToolEditorModal: React.FC<{
  row: ToolRow;
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, onClose, onSaved }) => {
  const existing = row.config;
  const [state, setState] = useState<EditorState>({
    accessLevel: existing?.access_level ?? 'free',
    campaignUntil: existing?.campaign_until
      ? existing.campaign_until.slice(0, 10)
      : '',
    advancedAccessLevel: existing?.advanced_access_level ?? 'inherit',
    advancedCampaignUntil: existing?.advanced_campaign_until
      ? existing.advanced_campaign_until.slice(0, 10)
      : '',
    note: existing?.note ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveToolAccess(row.toolId, {
        accessLevel: state.accessLevel,
        campaignUntil:
          state.accessLevel === 'campaign' && state.campaignUntil
            ? new Date(state.campaignUntil).toISOString()
            : null,
        advancedAccessLevel: state.advancedAccessLevel,
        advancedCampaignUntil:
          state.advancedAccessLevel === 'campaign' && state.advancedCampaignUntil
            ? new Date(state.advancedCampaignUntil).toISOString()
            : null,
        note: state.note,
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
      description={`Kategori: ${row.category} · ID: ${row.toolId}`}
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
        {/* Access level */}
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1">
            Adgangsniveau (basis)
          </label>
          <select
            value={state.accessLevel}
            onChange={(e) => setState((s) => ({ ...s, accessLevel: e.target.value as AccessLevel }))}
            className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-bg-dark-surface px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            {(Object.keys(ACCESS_LEVEL_LABELS) as AccessLevel[]).map((lvl) => (
              <option key={lvl} value={lvl}>
                {ACCESS_LEVEL_LABELS[lvl]}
              </option>
            ))}
          </select>
        </div>

        {state.accessLevel === 'campaign' && (
          <Input
            type="date"
            label="Kampagne slutter (dato)"
            value={state.campaignUntil}
            onChange={(e) => setState((s) => ({ ...s, campaignUntil: e.target.value }))}
            hint="Værktøjet er gratis frem til denne dato. Datoen skal være i fremtiden."
          />
        )}

        {/* Advanced access level */}
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1">
            Avanceret tilstand — adgangsniveau
          </label>
          <select
            value={state.advancedAccessLevel}
            onChange={(e) => setState((s) => ({ ...s, advancedAccessLevel: e.target.value as AdvancedAccessLevel }))}
            className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-bg-dark-surface px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            {(Object.keys(ADVANCED_LEVEL_LABELS) as AdvancedAccessLevel[]).map((lvl) => (
              <option key={lvl} value={lvl}>
                {ADVANCED_LEVEL_LABELS[lvl]}
              </option>
            ))}
          </select>
        </div>

        {state.advancedAccessLevel === 'campaign' && (
          <Input
            type="date"
            label="Avanceret kampagne slutter (dato)"
            value={state.advancedCampaignUntil}
            onChange={(e) => setState((s) => ({ ...s, advancedCampaignUntil: e.target.value }))}
            hint="Avanceret tilstand er gratis frem til denne dato."
          />
        )}

        {/* Note */}
        <Input
          label="Note (intern)"
          placeholder="F.eks. 'Q3 kampagne for mursten-segment'"
          value={state.note}
          onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
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

// ── Main panel ────────────────────────────────────────────────────────────────

const ToolAccessPanel: React.FC = () => {
  const [rows, setRows] = useState<ToolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ToolRow | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Alle');

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [adminData] = await Promise.all([
        listToolAccessAdmin().catch(() => ({ configs: [] })),
      ]);

      const configMap = new Map<string, ToolAccessConfig>(adminData.configs.map((c): [string, ToolAccessConfig] => [c.tool_id, c]));

      // Build rows from the full calculator registry — every calculator visible by default.
      const allCalcs = listCalculators();
      const registryIds = new Set(allCalcs.map((c) => c.id));

      const built: ToolRow[] = allCalcs.map((calc) => ({
        toolId: calc.id,
        name: calc.name,
        category: calc.category,
        config: configMap.get(calc.id) ?? null,
      }));

      // Include any DB rows whose tool_id is not (yet) in the registry.
      for (const cfg of adminData.configs) {
        if (!registryIds.has(cfg.tool_id)) {
          built.push({ toolId: cfg.tool_id, name: cfg.tool_id, category: 'Ukendt', config: cfg });
        }
      }

      setRows(built);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const categories = ['Alle', ...Array.from(new Set(rows.map((r) => r.category))).sort()];

  const filtered = rows.filter((r) => {
    const matchCat = categoryFilter === 'Alle' || r.category === categoryFilter;
    const matchSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.toolId.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const configured = filtered.filter((r) => r.config);
  const unconfigured = filtered.filter((r) => !r.config);

  if (loading) {
    return <SkeletonList count={4} label="Indlæser adgangskonfigurationer…" />;
  }

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

      {/* Search + filter */}
      <Card>
        <CardHeader className="mb-2">
          <CardTitle>Søg og filtrer</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <input
            type="search"
            placeholder="Søg efter værktøjsnavn eller ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-bg-dark-surface px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  categoryFilter === cat
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-bg dark:bg-bg-dark-surface text-text-secondary dark:text-text-dark-secondary border-border dark:border-border-dark'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Configured tools */}
      {configured.length > 0 && (
        <Card padding="none">
          <div className="p-4 sm:p-5 pb-2">
            <CardTitle>Konfigurerede ({configured.length})</CardTitle>
            <CardDescription>Disse værktøjer har eksplicitte adgangsregler.</CardDescription>
          </div>
          <div className="divide-y divide-border dark:divide-border-dark">
            {configured.map((row) => (
              <ToolRowItem key={row.toolId} row={row} onClick={() => setEditing(row)} />
            ))}
          </div>
        </Card>
      )}

      {/* Unconfigured tools */}
      <Card padding="none">
        <div className="p-4 sm:p-5 pb-2">
          <CardTitle>Standard adgang ({unconfigured.length})</CardTitle>
          <CardDescription>
            Ingen eksplicit regel — opfører sig som standard (gratis, medmindre id er i legacy Pro-listen).
          </CardDescription>
        </div>
        {unconfigured.length === 0 ? (
          <EmptyState
            title="Alle værktøjer er konfigurerede"
            description="Godt gået! Alle synlige værktøjer har en adgangsregel."
          />
        ) : (
          <div className="divide-y divide-border dark:divide-border-dark">
            {unconfigured.map((row) => (
              <ToolRowItem key={row.toolId} row={row} onClick={() => setEditing(row)} />
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <ToolEditorModal
          key={editing.toolId}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setLoading(true);
            refresh();
          }}
        />
      )}
    </div>
  );
};

export default ToolAccessPanel;
