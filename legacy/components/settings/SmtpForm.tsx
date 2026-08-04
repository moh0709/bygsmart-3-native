import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, Input, SkeletonList } from '../ui';
import type { SmtpConfigShape } from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// SmtpForm — shared presentational SMTP field set + action buttons.
//
// Owns no data fetching: all state and callbacks come from props so it can be
// reused by both the admin global panel (SmtpSettingsPanel) and the owner
// custom-SMTP modal (SettingsPage). Local form state is initialised from
// `config`; the password field is always empty on load and is only included in
// the onSave payload when the user has typed a new value.
// ─────────────────────────────────────────────────────────────────────────────

export interface SmtpFormFields {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  enabled: boolean;
}

interface ActionResult {
  ok: boolean;
  error?: string;
}

interface SmtpFormProps {
  scope: 'global' | 'custom';
  config: SmtpConfigShape | null;
  loading: boolean;
  /** Message shown when the initial fetch failed / the server is unavailable. */
  loadError?: string | null;
  /** Retry the initial fetch (renders a "Prøv igen" button in the error state). */
  onRetryLoad?: () => void;
  saving: boolean;
  testing: boolean;
  sendingTest: boolean;
  saveResult: ActionResult | null;
  testResult: ActionResult | null;
  sendTestResult: ActionResult | null;
  onSave: (fields: SmtpFormFields) => void;
  onTestConnection: () => void;
  onSendTestEmail: () => void;
}

const SmtpForm: React.FC<SmtpFormProps> = ({
  config,
  loading,
  loadError,
  onRetryLoad,
  saving,
  testing,
  sendingTest,
  saveResult,
  testResult,
  sendTestResult,
  onSave,
  onTestConnection,
  onSendTestEmail,
}) => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState<number>(587);
  const [secure, setSecure] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [enabled, setEnabled] = useState(false);

  // Re-initialise local form state whenever the loaded config changes.
  // The password field is intentionally never pre-filled.
  useEffect(() => {
    if (config) {
      setHost(config.host ?? '');
      setPort(config.port ?? 587);
      setSecure(config.secure ?? true);
      setUsername(config.username ?? '');
      setFromName(config.fromName ?? '');
      setFromEmail(config.fromEmail ?? '');
      setEnabled(Boolean(config.enabled));
      setPassword('');
    }
  }, [config]);

  const hasStoredPassword = Boolean(config?.hasPassword);

  const handleSave = () => {
    onSave({ host, port, secure, username, password, fromName, fromEmail, enabled });
  };

  const resultBadge = (result: ActionResult | null) => {
    if (!result) return null;
    return result.ok ? (
      <Badge variant="success" dot>OK</Badge>
    ) : (
      <Badge variant="danger">{result.error || 'Fejl'}</Badge>
    );
  };

  // ── Three explicit states ──────────────────────────────────────────────────
  // 1) Loading: the initial fetch is in flight.
  if (loading) {
    return <SkeletonList count={3} label="Indlæser SMTP-konfiguration…" />;
  }

  // 2) Load error / server unavailable: never show an editable empty form here.
  //    A null config (with no loaded data) also means the fetch failed or has
  //    not completed, so treat it as an error state with a retry option.
  if (loadError || !config) {
    return (
      <Card className="border-danger/40">
        <p role="alert" className="text-sm text-danger">
          {loadError || 'Kunne ikke hente SMTP-konfiguration.'}
        </p>
        {onRetryLoad && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetryLoad}>
            Prøv igen
          </Button>
        )}
      </Card>
    );
  }

  // 3) Loaded successfully. The API returns a safe shape even when nothing is
  //    configured yet, so derive the "not configured" banner from that shape
  //    (no host set) rather than from a null config.
  const isUnconfigured = !config.host;

  return (
    <div className="space-y-4">
      {/* Not-configured hint — derived from the successful safe shape. */}
      {isUnconfigured && (
        <Card className="border-warning/50">
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
            Ingen SMTP-konfiguration fundet. Udfyld felterne herunder og gem.
          </p>
        </Card>
      )}

      {/* Enable toggle */}
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
          Aktiveret
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-5 h-5 accent-brand-primary"
        />
      </label>

      <Input
        label="SMTP-server (host)"
        placeholder="smtp.eksempel.dk"
        value={host}
        onChange={(e) => setHost(e.target.value)}
      />

      <Input
        type="number"
        label="Port"
        min={1}
        max={65535}
        value={port}
        onChange={(e) => setPort(Number.parseInt(e.target.value, 10) || 0)}
      />

      {/* Secure (TLS) toggle */}
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
          Sikker forbindelse (TLS)
        </span>
        <input
          type="checkbox"
          checked={secure}
          onChange={(e) => setSecure(e.target.checked)}
          className="w-5 h-5 accent-brand-primary"
        />
      </label>

      <Input
        label="Brugernavn"
        autoComplete="off"
        placeholder="bruger@eksempel.dk"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <Input
        type="password"
        label="Adgangskode"
        autoComplete="off"
        placeholder={hasStoredPassword && !password ? '•••• gemt' : 'Indtast adgangskode'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="Lad feltet stå tomt for at beholde den gemte adgangskode."
      />

      <Input
        label="Afsendernavn"
        placeholder="BygSmart"
        value={fromName}
        onChange={(e) => setFromName(e.target.value)}
      />

      <Input
        type="email"
        label="Afsender-e-mail"
        autoComplete="off"
        placeholder="noreply@eksempel.dk"
        value={fromEmail}
        onChange={(e) => setFromEmail(e.target.value)}
      />

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleSave} loading={saving} disabled={loading}>
            Gem
          </Button>
          {resultBadge(saveResult)}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={onTestConnection} loading={testing} disabled={loading}>
            Test forbindelse
          </Button>
          {resultBadge(testResult)}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={onSendTestEmail} loading={sendingTest} disabled={loading}>
            Send test-e-mail
          </Button>
          {resultBadge(sendTestResult)}
        </div>
      </div>
    </div>
  );
};

export default SmtpForm;
