import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  SegmentedControl,
  Spinner,
} from '../ui';
import {
  listDiscountCodes,
  createDiscountCode,
  deactivateDiscountCode,
  listTrialCodes,
  createTrialCode,
  deactivateTrialCode,
  type DiscountCode,
  type TrialCode,
} from '../../services/api/promoCodes';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('da-DK') : '—');

type Msg = { ok: boolean; text: string } | null;

const PromoCodePanel: React.FC = () => {
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [trials, setTrials] = useState<TrialCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Discount form
  const [dCode, setDCode] = useState('');
  const [dPercent, setDPercent] = useState('20');
  const [dDuration, setDDuration] = useState<'once' | 'repeating' | 'forever'>('once');
  const [dMonths, setDMonths] = useState('3');
  const [dExpires, setDExpires] = useState('');
  const [dMax, setDMax] = useState('');
  const [dSaving, setDSaving] = useState(false);
  const [dMsg, setDMsg] = useState<Msg>(null);

  // Trial form
  const [tCode, setTCode] = useState('');
  const [tKind, setTKind] = useState<'days' | 'until'>('days');
  const [tDays, setTDays] = useState('14');
  const [tUntil, setTUntil] = useState('');
  const [tMax, setTMax] = useState('');
  const [tExpires, setTExpires] = useState('');
  const [tNote, setTNote] = useState('');
  const [tSaving, setTSaving] = useState(false);
  const [tMsg, setTMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, t] = await Promise.all([listDiscountCodes(), listTrialCodes()]);
      setDiscounts(d);
      setTrials(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke indlæse koder.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitDiscount = async () => {
    setDSaving(true);
    setDMsg(null);
    try {
      await createDiscountCode({
        code: dCode,
        percentOff: Number(dPercent),
        duration: dDuration,
        durationInMonths: dDuration === 'repeating' ? Number(dMonths) : undefined,
        expiresAt: dExpires || undefined,
        maxRedemptions: dMax ? Number(dMax) : undefined,
      });
      setDMsg({ ok: true, text: 'Rabatkode oprettet.' });
      setDCode('');
      await load();
    } catch (e) {
      setDMsg({ ok: false, text: e instanceof Error ? e.message : 'Der opstod en fejl.' });
    } finally {
      setDSaving(false);
    }
  };

  const submitTrial = async () => {
    setTSaving(true);
    setTMsg(null);
    try {
      await createTrialCode({
        code: tCode,
        trialDays: tKind === 'days' ? Number(tDays) : null,
        trialUntil: tKind === 'until' ? tUntil || null : null,
        maxRedemptions: tMax ? Number(tMax) : null,
        expiresAt: tExpires || null,
        note: tNote || undefined,
      });
      setTMsg({ ok: true, text: 'Prøvekode oprettet.' });
      setTCode('');
      await load();
    } catch (e) {
      setTMsg({ ok: false, text: e instanceof Error ? e.message : 'Der opstod en fejl.' });
    } finally {
      setTSaving(false);
    }
  };

  const removeDiscount = async (id: string) => {
    try {
      await deactivateDiscountCode(id);
      await load();
    } catch {
      /* surfaced on next load */
    }
  };
  const removeTrial = async (id: string) => {
    try {
      await deactivateTrialCode(id);
      await load();
    } catch {
      /* surfaced on next load */
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-6 w-6 text-text-tertiary dark:text-text-dark-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="danger">{error}</Alert>}

      {/* ── Discount codes ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="mb-1">
          <CardTitle>Rabatkoder</CardTitle>
        </CardHeader>
        <CardDescription>
          Procentrabat via Stripe. Kunder indtaster koden på Stripes betalingsside ved checkout.
        </CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input label="Kode" value={dCode} onChange={(e) => setDCode(e.target.value.toUpperCase())} placeholder="SOMMER20" />
          <Input type="number" label="Rabat (%)" value={dPercent} onChange={(e) => setDPercent(e.target.value)} min={1} max={100} />
          <div className="sm:col-span-2">
            <SegmentedControl
              label="Varighed"
              value={dDuration}
              onChange={(v) => setDDuration(v as 'once' | 'repeating' | 'forever')}
              options={[
                { label: 'Én gang', value: 'once' },
                { label: 'Gentages', value: 'repeating' },
                { label: 'For altid', value: 'forever' },
              ]}
            />
          </div>
          {dDuration === 'repeating' && (
            <Input type="number" label="Antal måneder" value={dMonths} onChange={(e) => setDMonths(e.target.value)} min={1} />
          )}
          <Input type="date" label="Udløber (valgfri)" value={dExpires} onChange={(e) => setDExpires(e.target.value)} />
          <Input type="number" label="Maks. antal brug (valgfri)" value={dMax} onChange={(e) => setDMax(e.target.value)} min={1} />
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <Button onClick={submitDiscount} loading={dSaving} disabled={!dCode}>
            Opret rabatkode
          </Button>
          {dMsg && <Badge variant={dMsg.ok ? 'success' : 'danger'} dot={dMsg.ok}>{dMsg.text}</Badge>}
        </div>

        {discounts.length > 0 && (
          <div className="mt-5 divide-y divide-border dark:divide-border-dark">
            {discounts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <span className="font-semibold text-text-primary dark:text-text-dark-primary">{c.code}</span>
                  <span className="ml-2 text-caption text-text-secondary dark:text-text-dark-secondary">
                    {c.percentOff}%{' · '}
                    {c.duration === 'repeating' ? `${c.durationInMonths} mdr.` : c.duration === 'forever' ? 'for altid' : 'én gang'}
                    {c.expiresAt ? ` · udløber ${fmtDate(c.expiresAt)}` : ''}
                    {` · brugt ${c.timesRedeemed}${c.maxRedemptions ? `/${c.maxRedemptions}` : ''}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.active ? <Badge variant="success" dot>Aktiv</Badge> : <Badge>Inaktiv</Badge>}
                  {c.active && (
                    <Button size="sm" variant="outline" onClick={() => removeDiscount(c.id)}>
                      Deaktiver
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Trial codes ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="mb-1">
          <CardTitle>Prøvekoder (gratis prøveperiode)</CardTitle>
        </CardHeader>
        <CardDescription>
          Delbare koder, som kunder indtaster i appen inden betaling. Enten et antal dage eller indtil en bestemt dato.
        </CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input label="Kode" value={tCode} onChange={(e) => setTCode(e.target.value.toUpperCase())} placeholder="TRIAL30" />
          <div className="sm:col-span-2">
            <SegmentedControl
              label="Type"
              value={tKind}
              onChange={(v) => setTKind(v as 'days' | 'until')}
              options={[
                { label: 'Antal dage', value: 'days' },
                { label: 'Indtil dato', value: 'until' },
              ]}
            />
          </div>
          {tKind === 'days' ? (
            <Input type="number" label="Antal dage" value={tDays} onChange={(e) => setTDays(e.target.value)} min={1} max={365} />
          ) : (
            <Input type="date" label="Prøveperiode indtil" value={tUntil} onChange={(e) => setTUntil(e.target.value)} />
          )}
          <Input type="number" label="Maks. antal brug (valgfri)" value={tMax} onChange={(e) => setTMax(e.target.value)} min={1} />
          <Input type="date" label="Kode udløber (valgfri)" value={tExpires} onChange={(e) => setTExpires(e.target.value)} />
          <Input label="Note (valgfri)" value={tNote} onChange={(e) => setTNote(e.target.value)} placeholder="Fx kampagnenavn" />
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <Button onClick={submitTrial} loading={tSaving} disabled={!tCode}>
            Opret prøvekode
          </Button>
          {tMsg && <Badge variant={tMsg.ok ? 'success' : 'danger'} dot={tMsg.ok}>{tMsg.text}</Badge>}
        </div>

        {trials.length > 0 && (
          <div className="mt-5 divide-y divide-border dark:divide-border-dark">
            {trials.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <span className="font-semibold text-text-primary dark:text-text-dark-primary">{c.code}</span>
                  <span className="ml-2 text-caption text-text-secondary dark:text-text-dark-secondary">
                    {c.trial_days ? `${c.trial_days} dages prøve` : `indtil ${fmtDate(c.trial_until)}`}
                    {c.expires_at ? ` · udløber ${fmtDate(c.expires_at)}` : ''}
                    {` · brugt ${c.redeemed_count}${c.max_redemptions ? `/${c.max_redemptions}` : ''}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.active ? <Badge variant="success" dot>Aktiv</Badge> : <Badge>Inaktiv</Badge>}
                  {c.active && (
                    <Button size="sm" variant="outline" onClick={() => removeTrial(c.id)}>
                      Deaktiver
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default PromoCodePanel;
