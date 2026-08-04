import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '../../../components/ui';
import {
  AiProviderAdminView,
  AiUsageAggregate,
  AiUsageRow,
  FetchModelsResult,
  TestProviderResult,
  fetchProviderModels,
  getUsage,
  listProviders,
  saveProvider,
  testProvider,
} from '../services/aiOrchestration';

// ─────────────────────────────────────────────────────────────────────────────
// AiOrchestrationPanel — admin UI for the multi-provider AI layer.
// Wire it into AdminDashboardPage (or SettingsPage admin section) as a
// tab/section; it has no router dependencies and manages its own data.
// ─────────────────────────────────────────────────────────────────────────────

const statusBadge = (p: AiProviderAdminView) => {
  if (p.authStyle === 'stub' && p.enabled && p.hasKey) {
    return <Badge variant="info">Adapter på vej</Badge>;
  }
  if (p.enabled && p.hasKey) return <Badge variant="success" dot>Aktiv</Badge>;
  if (p.enabled && !p.hasKey) return <Badge variant="warning">Nøgle mangler</Badge>;
  return <Badge variant="neutral">Deaktiveret</Badge>;
};

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '–';
  }
};

// ── Provider row ─────────────────────────────────────────────────────────────

const ProviderRow: React.FC<{ provider: AiProviderAdminView; onClick: () => void }> = ({
  provider,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
          {provider.label}
        </span>
        {statusBadge(provider)}
      </div>
      <p className="text-xs text-text-secondary dark:text-text-dark-secondary truncate mt-0.5">
        {provider.defaultModel || provider.defaultModels[0] || 'Ingen standardmodel'}
        {provider.hasKey && provider.keyLast4 ? ` · nøgle ••••${provider.keyLast4}` : ''}
      </p>
    </div>
    <span className="text-xs text-text-tertiary dark:text-text-dark-tertiary shrink-0">
      Prioritet {provider.priority}
    </span>
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
  enabled: boolean;
  apiKey: string;
  clearKey: boolean;
  defaultModel: string;
  priority: number;
  config: Record<string, string>;
}

const ProviderEditorModal: React.FC<{
  provider: AiProviderAdminView;
  onClose: () => void;
  onSaved: () => void;
}> = ({ provider, onClose, onSaved }) => {
  const [state, setState] = useState<EditorState>({
    enabled: provider.enabled,
    apiKey: '',
    clearKey: false,
    defaultModel: provider.defaultModel || provider.defaultModels[0] || '',
    priority: provider.priority,
    config: { ...provider.config },
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestProviderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelsResult, setModelsResult] = useState<FetchModelsResult | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [customModel, setCustomModel] = useState(false);

  const loadModels = useCallback(async () => {
    if (provider.authStyle === 'stub') return;
    setFetchingModels(true);
    try {
      const result = await fetchProviderModels(provider.providerId);
      setModelsResult(result);
    } catch {
      // silently fall back to static list
    } finally {
      setFetchingModels(false);
    }
  }, [provider.providerId, provider.authStyle]);

  // Fetch live models when opening if the provider already has a key saved
  useEffect(() => {
    if (provider.hasKey) {
      loadModels();
    }
  }, [provider.hasKey, loadModels]);

  const availableModels = modelsResult?.models?.length
    ? modelsResult.models
    : provider.defaultModels;

  // When models load, if the current value isn't in the list, switch to custom mode
  useEffect(() => {
    if (availableModels.length > 0 && state.defaultModel && !availableModels.includes(state.defaultModel)) {
      setCustomModel(true);
    }
  }, [availableModels, state.defaultModel]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveProvider(provider.providerId, {
        enabled: state.enabled,
        apiKey: state.clearKey ? '' : state.apiKey.trim() ? state.apiKey.trim() : undefined,
        config: state.config,
        defaultModel: state.defaultModel,
        priority: state.priority,
      });
      // Refresh model list after saving (new key may unlock more models)
      loadModels();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl ved gem.');
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProvider(provider.providerId, {
        apiKey: state.apiKey.trim() || undefined,
        model: state.defaultModel.trim() || undefined,
        config: state.config,
      });
      setTestResult(result);
      // Also refresh model list after a successful test
      if (result.ok) loadModels();
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Ukendt fejl.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={provider.label}
      description={
        provider.authStyle === 'stub'
          ? provider.stubMessage || 'Adapteren er ikke klar endnu — nøgler kan gemmes allerede nu.'
          : 'Konfigurer adgang, model og prioritet i fallback-kæden.'
      }
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
        {/* Enable toggle */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
            Aktiveret
          </span>
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => setState((s) => ({ ...s, enabled: e.target.checked }))}
            className="w-5 h-5 accent-brand-primary"
          />
        </label>

        {/* API key */}
        <div>
          <Input
            type="password"
            label={provider.keyLabel}
            autoComplete="off"
            placeholder={provider.hasKey && !state.clearKey ? '•••• gemt' : 'Indsæt nøgle'}
            value={state.apiKey}
            disabled={state.clearKey}
            onChange={(e) => setState((s) => ({ ...s, apiKey: e.target.value }))}
            hint={
              state.clearKey
                ? 'Nøglen slettes når du gemmer.'
                : provider.hasKey
                  ? `Der er gemt en nøgle (••••${provider.keyLast4 ?? ''}). Lad feltet stå tomt for at beholde den.`
                  : 'Nøglen krypteres og gemmes kun på serveren.'
            }
          />
          {provider.hasKey && (
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, clearKey: !s.clearKey, apiKey: '' }))}
              className="mt-1 text-xs font-semibold text-danger hover:underline"
            >
              {state.clearKey ? 'Fortryd sletning af nøgle' : 'Ryd gemt nøgle'}
            </button>
          )}
        </div>

        {/* Provider-specific config fields */}
        {provider.configFields.map((field) => (
          <Input
            key={field.key}
            label={field.label}
            required={field.required}
            placeholder={field.placeholder}
            value={state.config[field.key] ?? ''}
            onChange={(e) =>
              setState((s) => ({ ...s, config: { ...s.config, [field.key]: e.target.value } }))
            }
          />
        ))}

        {/* Default model — select from live/static list or type a custom name */}
        <div className="space-y-1.5">
          <label
            htmlFor={`model-select-${provider.providerId}`}
            className="block text-sm font-medium text-text-primary dark:text-text-dark-primary"
          >
            {fetchingModels
              ? 'Standardmodel (henter modeller…)'
              : modelsResult?.source === 'live'
                ? `Standardmodel · ${availableModels.length} tilgængelige`
                : 'Standardmodel'}
          </label>

          {!customModel ? (
            <select
              id={`model-select-${provider.providerId}`}
              className="w-full rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-dark-primary text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              value={availableModels.includes(state.defaultModel) ? state.defaultModel : ''}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setCustomModel(true);
                  setState((s) => ({ ...s, defaultModel: '' }));
                } else {
                  setState((s) => ({ ...s, defaultModel: e.target.value }));
                }
              }}
              disabled={fetchingModels}
            >
              {availableModels.length === 0 && (
                <option value="">– ingen modeller –</option>
              )}
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              <option value="__custom__">Skriv eget modelnavn…</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="fx gpt-4o eller llama-3.3-70b"
                value={state.defaultModel}
                onChange={(e) => setState((s) => ({ ...s, defaultModel: e.target.value }))}
                className="flex-1"
              />
              {availableModels.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomModel(false);
                    setState((s) => ({ ...s, defaultModel: availableModels[0] || '' }));
                  }}
                  className="shrink-0 text-xs text-brand-primary hover:underline"
                >
                  Vælg fra liste
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
            {customModel
              ? 'Skriv præcis det modelnavn som udbyderen forventer.'
              : 'Vælg fra listen eller vælg "Skriv eget modelnavn…" for et brugerdefineret navn.'}
          </p>
        </div>

        {/* Priority */}
        <Input
          type="number"
          label="Prioritet"
          min={0}
          max={9999}
          value={state.priority}
          onChange={(e) =>
            setState((s) => ({ ...s, priority: Number.parseInt(e.target.value, 10) || 0 }))
          }
          hint="Lavere tal = tidligere i fallback-kæden."
        />

        {/* Connection test */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleTest} loading={testing}>
            Test forbindelse
          </Button>
          {testResult &&
            (testResult.ok ? (
              <Badge variant="success" dot>
                OK · {testResult.latencyMs} ms
              </Badge>
            ) : (
              <Badge variant="danger">Fejl</Badge>
            ))}
        </div>
        {testResult && !testResult.ok && testResult.error && (
          <p className="text-xs text-danger break-words">{testResult.error}</p>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
};

// ── Usage table ──────────────────────────────────────────────────────────────

const UsageSection: React.FC<{ rows: AiUsageRow[]; aggregates: AiUsageAggregate[] }> = ({
  rows,
  aggregates,
}) => (
  <Card padding="none">
    <div className="p-4 sm:p-5 pb-0">
      <CardHeader className="mb-1">
        <CardTitle>Seneste AI-forbrug</CardTitle>
      </CardHeader>
      <CardDescription>De seneste kald via orkestreringslaget.</CardDescription>
      {aggregates.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {aggregates.map((agg) => (
            <Badge key={agg.providerId} variant={agg.failures > 0 ? 'warning' : 'brand'}>
              {agg.providerId}: {agg.calls} kald · {agg.tokensIn + agg.tokensOut} tokens
            </Badge>
          ))}
        </div>
      )}
    </div>
    {rows.length === 0 ? (
      <EmptyState
        title="Intet forbrug endnu"
        description="Når appens AI-funktioner bruger orkestreringslaget, vises kaldene her."
      />
    ) : (
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary border-b border-border dark:border-border-dark">
              <th className="px-4 py-2 font-semibold">Tidspunkt</th>
              <th className="px-4 py-2 font-semibold">Udbyder</th>
              <th className="px-4 py-2 font-semibold">Model</th>
              <th className="px-4 py-2 font-semibold">Funktion</th>
              <th className="px-4 py-2 font-semibold text-right">Tokens</th>
              <th className="px-4 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 25).map((row) => (
              <tr
                key={row.id}
                className="border-b border-border dark:border-border-dark last:border-b-0"
              >
                <td className="px-4 py-2 whitespace-nowrap text-text-secondary dark:text-text-dark-secondary">
                  {formatTime(row.created_at)}
                </td>
                <td className="px-4 py-2 text-text-primary dark:text-text-dark-primary">
                  {row.provider_id}
                </td>
                <td className="px-4 py-2 text-text-secondary dark:text-text-dark-secondary truncate max-w-[160px]">
                  {row.model || '–'}
                </td>
                <td className="px-4 py-2 text-text-secondary dark:text-text-dark-secondary">
                  {row.feature || '–'}
                </td>
                <td className="px-4 py-2 text-right text-text-secondary dark:text-text-dark-secondary whitespace-nowrap">
                  {(row.tokens_in ?? 0) + (row.tokens_out ?? 0)}
                </td>
                <td className="px-4 py-2">
                  {row.success ? (
                    <Badge variant="success">OK</Badge>
                  ) : (
                    <Badge variant="danger">Fejl</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

// ── Main panel ───────────────────────────────────────────────────────────────

const AiOrchestrationPanel: React.FC = () => {
  const [providers, setProviders] = useState<AiProviderAdminView[]>([]);
  const [chain, setChain] = useState<string[]>([]);
  const [encryptionConfigured, setEncryptionConfigured] = useState(true);
  const [usageRows, setUsageRows] = useState<AiUsageRow[]>([]);
  const [usageAggregates, setUsageAggregates] = useState<AiUsageAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AiProviderAdminView | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [providersData, usageData] = await Promise.all([
        listProviders(),
        getUsage().catch(() => ({ rows: [], aggregates: [] })),
      ]);
      setProviders(providersData.providers);
      setChain(providersData.chain);
      setEncryptionConfigured(providersData.encryptionConfigured);
      setUsageRows(usageData.rows);
      setUsageAggregates(usageData.aggregates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const labelFor = useMemo(() => {
    const map = new Map(providers.map((p) => [p.providerId, p.label]));
    return (id: string) => map.get(id) || id;
  }, [providers]);

  const activated = providers.filter((p) => p.enabled);
  const available = providers.filter((p) => !p.enabled);

  if (loading) {
    return <SkeletonList count={3} label="Indlæser AI-orkestrering…" />;
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

      {!encryptionConfigured && (
        <Card className="border-warning/50">
          <p className="text-sm text-text-primary dark:text-text-dark-primary font-semibold">
            AI_KEYS_SECRET mangler på serveren
          </p>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-1">
            API-nøgler kan ikke krypteres og gemmes, før miljøvariablen er sat. Se .env.example.
          </p>
        </Card>
      )}

      {/* Active chain */}
      <Card>
        <CardHeader className="mb-1">
          <CardTitle>Aktiv kæde</CardTitle>
        </CardHeader>
        <CardDescription>
          AI-kald prøver udbyderne i denne rækkefølge (fallback ved fejl).
        </CardDescription>
        {chain.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary dark:text-text-dark-secondary">
            Ingen udbydere i kæden endnu — aktivér en udbyder og gem en API-nøgle.
          </p>
        ) : (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {chain.map((id, i) => (
              <React.Fragment key={id}>
                {i > 0 && (
                  <span className="text-text-tertiary dark:text-text-dark-tertiary" aria-hidden="true">
                    →
                  </span>
                )}
                <Badge variant={i === 0 ? 'brand' : 'neutral'}>{labelFor(id)}</Badge>
              </React.Fragment>
            ))}
          </div>
        )}
      </Card>

      {/* Activated providers */}
      <Card padding="none">
        <div className="p-4 sm:p-5 pb-2">
          <CardTitle>Aktiveret ({activated.length})</CardTitle>
        </div>
        {activated.length === 0 ? (
          <EmptyState
            title="Ingen aktiverede udbydere"
            description="Vælg en udbyder fra listen herunder, indtast en API-nøgle og slå den til."
          />
        ) : (
          <div className="divide-y divide-border dark:divide-border-dark">
            {activated.map((p) => (
              <ProviderRow key={p.providerId} provider={p} onClick={() => setEditing(p)} />
            ))}
          </div>
        )}
      </Card>

      {/* Available providers */}
      <Card padding="none">
        <div className="p-4 sm:p-5 pb-2">
          <CardTitle>Tilgængelige ({available.length})</CardTitle>
        </div>
        <div className="divide-y divide-border dark:divide-border-dark">
          {available.map((p) => (
            <ProviderRow key={p.providerId} provider={p} onClick={() => setEditing(p)} />
          ))}
        </div>
      </Card>

      {/* Usage */}
      <UsageSection rows={usageRows} aggregates={usageAggregates} />

      {editing && (
        <ProviderEditorModal
          key={editing.providerId}
          provider={editing}
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

export default AiOrchestrationPanel;
