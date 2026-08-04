import React, { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal } from '../ui';
import { supabase } from '../../services/supabaseClient';

/**
 * TOTP MFA enrollment entry point (F-05).
 *
 * Minimal flow using the existing Supabase client:
 *   1. listFactors() — if a verified TOTP factor already exists, offer to remove it.
 *   2. enroll({ factorType: 'totp' }) — returns a QR code + secret to scan.
 *   3. challenge() + verify({ code }) — confirm the 6-digit code from the app.
 */

interface MfaEnrollModalProps {
  onClose: () => void;
}

type Phase = 'loading' | 'idle' | 'enrolling' | 'verifying' | 'done';

interface EnrollData {
  factorId: string;
  qrCode: string; // SVG data URL
  secret: string;
}

export const MfaEnrollModal: React.FC<MfaEnrollModalProps> = ({ onClose }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState('');
  const [existingFactorId, setExistingFactorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Check whether the user already has a verified TOTP factor.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listErr) {
        setError(listErr.message);
        setPhase('idle');
        return;
      }
      const verified = data?.totp?.find((f) => f.status === 'verified');
      if (verified) {
        setExistingFactorId(verified.id);
        setPhase('done');
      } else {
        setPhase('idle');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startEnrollment = async () => {
    setError(null);
    setBusy(true);
    try {
      // Clean up any stale unverified factor so re-enrollment doesn't collide.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const stale = factors?.totp?.find((f) => f.status !== 'verified');
      if (stale) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id }).catch(() => undefined);
      }

      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `BygSmart (${new Date().toISOString().slice(0, 10)})`,
      });
      if (enrollErr || !data) {
        setError(enrollErr?.message ?? 'Kunne ikke starte MFA-tilmelding.');
        return;
      }
      setEnroll({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setPhase('enrolling');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!enroll) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Indtast den 6-cifrede kode fra din authenticator-app.');
      return;
    }
    setError(null);
    setPhase('verifying');
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: enroll.factorId,
      });
      if (challengeErr || !challenge) {
        setError(challengeErr?.message ?? 'Kunne ikke oprette MFA-udfordring.');
        setPhase('enrolling');
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyErr) {
        setError(verifyErr.message);
        setPhase('enrolling');
        return;
      }
      setExistingFactorId(enroll.factorId);
      setEnroll(null);
      setCode('');
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifikation mislykkedes.');
      setPhase('enrolling');
    }
  };

  const removeFactor = async () => {
    if (!existingFactorId) return;
    setError(null);
    setBusy(true);
    try {
      const { error: removeErr } = await supabase.auth.mfa.unenroll({ factorId: existingFactorId });
      if (removeErr) {
        setError(removeErr.message);
        return;
      }
      setExistingFactorId(null);
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="To-faktor-godkendelse (MFA)"
      onClose={onClose}
      footer={<Button variant="secondary" fullWidth onClick={onClose}>Luk</Button>}
    >
      <div className="space-y-4">
        {phase === 'loading' && (
          <p className="text-body text-text-secondary dark:text-text-dark-secondary">Indlæser…</p>
        )}

        {phase === 'idle' && (
          <>
            <p className="text-body text-text-secondary dark:text-text-dark-secondary">
              Tilføj et ekstra sikkerhedslag med en authenticator-app (fx Google
              Authenticator, Microsoft Authenticator eller 1Password). Du skal indtaste
              en engangskode fra appen, når du logger ind.
            </p>
            <Button variant="primary" fullWidth onClick={startEnrollment} loading={busy}>
              Aktivér MFA
            </Button>
          </>
        )}

        {(phase === 'enrolling' || phase === 'verifying') && enroll && (
          <>
            <p className="text-body text-text-secondary dark:text-text-dark-secondary">
              Scan QR-koden i din authenticator-app, og indtast derefter den 6-cifrede kode.
            </p>
            <div className="flex justify-center">
              {/* qr_code is an SVG data URL returned by Supabase */}
              <img src={enroll.qrCode} alt="MFA QR-kode" className="w-44 h-44" />
            </div>
            <div className="text-center">
              <p className="text-caption text-text-secondary dark:text-text-dark-secondary mb-1">
                Kan du ikke scanne? Indtast denne nøgle manuelt:
              </p>
              <code className="text-caption font-mono break-all select-all text-text-primary dark:text-text-dark-primary">
                {enroll.secret}
              </code>
            </div>
            <Input
              id="mfa-code"
              label="6-cifret kode"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
            <Button
              variant="primary"
              fullWidth
              onClick={verifyCode}
              loading={phase === 'verifying'}
              disabled={code.length !== 6}
            >
              Bekræft og aktivér
            </Button>
          </>
        )}

        {phase === 'done' && (
          <>
            <Alert variant="success" title="MFA er aktiv">
              To-faktor-godkendelse er aktiv på din konto.
            </Alert>
            <Button variant="danger" fullWidth onClick={removeFactor} loading={busy}>
              Fjern MFA
            </Button>
          </>
        )}

        {error && <p className="text-label text-danger text-center" role="alert">{error}</p>}
      </div>
    </Modal>
  );
};

export default MfaEnrollModal;
