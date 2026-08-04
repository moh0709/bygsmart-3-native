import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui';
import SmtpForm, { SmtpFormFields } from './SmtpForm';
import {
  getSmtpConfig,
  saveSmtpConfig,
  testSmtpConnection,
  sendSmtpTestEmail,
  SmtpConfigShape,
  SmtpSavePayload,
} from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// SmtpSettingsPanel — admin global SMTP tab. Stateful container modelled on
// AiOrchestrationPanel; loads its own data and wires SmtpForm's callbacks to the
// /api/smtp/global endpoints.
// ─────────────────────────────────────────────────────────────────────────────

interface ActionResult {
  ok: boolean;
  error?: string;
}

const buildPayload = (fields: SmtpFormFields): SmtpSavePayload => ({
  host: fields.host,
  port: fields.port,
  secure: fields.secure,
  username: fields.username,
  fromName: fields.fromName,
  fromEmail: fields.fromEmail,
  enabled: fields.enabled,
  // Only send password when the user typed a new value — otherwise keep the stored one.
  ...(fields.password ? { password: fields.password } : {}),
});

const SmtpSettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<SmtpConfigShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secretMissing, setSecretMissing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [saveResult, setSaveResult] = useState<ActionResult | null>(null);
  const [testResult, setTestResult] = useState<ActionResult | null>(null);
  const [sendTestResult, setSendTestResult] = useState<ActionResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSmtpConfig('global');
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (fields: SmtpFormFields) => {
    setSaving(true);
    setSaveResult(null);
    setSecretMissing(false);
    try {
      const updated = await saveSmtpConfig('global', buildPayload(fields));
      setConfig(updated);
      setSaveResult({ ok: true });
    } catch (err) {
      if ((err as { status?: number })?.status === 503) setSecretMissing(true);
      setSaveResult({ ok: false, error: err instanceof Error ? err.message : 'Ukendt fejl.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testSmtpConnection('global'));
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Ukendt fejl.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    setSendTestResult(null);
    try {
      setSendTestResult(await sendSmtpTestEmail('global'));
    } catch (err) {
      setSendTestResult({ ok: false, error: err instanceof Error ? err.message : 'Ukendt fejl.' });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-5">
      {secretMissing && (
        <Card className="border-warning/50">
          <p className="text-sm text-text-primary dark:text-text-dark-primary font-semibold">
            AI_KEYS_SECRET mangler på serveren
          </p>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-1">
            Adgangskoden kan ikke krypteres og gemmes, før miljøvariablen er sat. Se .env.example.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader className="mb-1">
          <CardTitle>Global SMTP-konfiguration</CardTitle>
        </CardHeader>
        <CardDescription>
          Systemets standard SMTP-server til udgående e-mails (fx overdragelsesrapporter). Krypteret med AI_KEYS_SECRET.
        </CardDescription>
        <div className="mt-4">
          <SmtpForm
            scope="global"
            config={config}
            loading={loading}
            loadError={error}
            onRetryLoad={load}
            saving={saving}
            testing={testing}
            sendingTest={sendingTest}
            saveResult={saveResult}
            testResult={testResult}
            sendTestResult={sendTestResult}
            onSave={handleSave}
            onTestConnection={handleTestConnection}
            onSendTestEmail={handleSendTestEmail}
          />
        </div>
      </Card>
    </div>
  );
};

export default SmtpSettingsPanel;
