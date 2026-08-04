import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '../services/supabaseClient';
import { AiOrchestrationPanel } from '../modules/ai';
import ToolAccessPanel from '../components/settings/ToolAccessPanel';
import ModuleEntitlementsPanel from '../components/admin/ModuleEntitlementsPanel';
import SmtpSettingsPanel from '../components/settings/SmtpSettingsPanel';
import PromoCodePanel from '../components/settings/PromoCodePanel';
import { DateRangeFilter, defaultAdminPeriod } from '../components/admin/DateRangeFilter';
import type { AdminPeriodValue } from '../components/admin/DateRangeFilter';
import { PeriodDelta } from '../components/admin/PeriodDelta';
import RevenueSection from '../components/admin/RevenueSection';
import TeamsSection from '../components/admin/TeamsSection';
import OrganizationsSection from '../components/admin/OrganizationsSection';
import UserCard from '../components/admin/UserCard';
import { PLACEHOLDER_DEMO_NAME } from '../services/api/demoProfile';
import DelegationReportsSection from '../components/admin/DelegationReportsSection';
import { downloadCsv } from '../services/csvExport';
import {
    Alert,
    AppHeader,
    Avatar,
    Badge,
    Button,
    Card,
    EmptyState,
    Input,
    ListRow,
    Modal,
    Select,
    SkeletonList,
    StatCard,
    Tabs,
    Textarea,
} from '../components/ui';
import type { BadgeVariant } from '../components/ui';
import type { AdminUser, AdminInvoice, AdminOverviewData, AdminPurgeableDemoUser } from '../types';

// AdminUser/AdminInvoice/AdminOverviewData live in types.ts —
// shared with the admin/* section components above, which each fetch their
// own slice of insights independently.
type Invoice = AdminInvoice;
type OverviewData = AdminOverviewData;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string | null): string => {
    if (!iso) return '–';
    try {
        return new Date(iso).toLocaleDateString('da-DK', { dateStyle: 'medium' });
    } catch {
        return '–';
    }
};

const formatDateTime = (iso: string | null): string => {
    if (!iso) return '–';
    try {
        return new Date(iso).toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return '–';
    }
};

const formatMoney = (minor: number, currency: string): string => {
    try {
        return new Intl.NumberFormat('da-DK', { style: 'currency', currency: (currency || 'dkk').toUpperCase() }).format((minor || 0) / 100);
    } catch {
        return `${((minor || 0) / 100).toFixed(2)} ${currency?.toUpperCase() || ''}`;
    }
};

const TIER_VARIANTS: Record<string, BadgeVariant> = {
    FREE: 'neutral',
    PRO: 'info',
    PREMIUM: 'warning',
    ENTERPRISE: 'brand',
};

const tierVariant = (tier: string): BadgeVariant => TIER_VARIANTS[tier] ?? 'neutral';

const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Ingen aktiv session.');
    return fetch(path, {
        ...init,
        headers: {
            ...(init.headers || {}),
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token}`,
        },
    });
};

// ─── Generic UI bits ─────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="text-heading text-text-primary dark:text-text-dark-primary mb-3">
        {children}
    </h2>
);

const DetailModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
    <Modal open onClose={onClose} title={title} size="md">
        {children}
    </Modal>
);

type ActionTone = 'default' | 'primary' | 'danger' | 'success';
const toneClass: Record<ActionTone, string> = {
    default: 'bg-bg-muted text-text-primary hover:bg-border dark:bg-bg-dark-muted dark:text-text-dark-primary dark:hover:bg-border-dark',
    primary: 'bg-brand-primary text-white hover:bg-brand-strong',
    danger: 'bg-danger-subtle text-danger-strong hover:bg-danger-border/60 dark:bg-danger-subtle-dark dark:text-danger',
    success: 'bg-success-subtle text-success-strong hover:bg-success-border/60 dark:bg-success-subtle-dark dark:text-success',
};

const ActionButton: React.FC<{ label: string; icon: React.ReactNode; tone?: ActionTone; disabled?: boolean; onClick: () => void }> = ({ label, icon, tone = 'default', disabled, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-card min-h-11 py-3 px-2 text-caption font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${toneClass[tone]}`}
    >
        <span className="w-5 h-5" aria-hidden="true">{icon}</span>
        <span>{label}</span>
    </button>
);

// For a demo account the profile e-mail is the generated demo+…@ login address,
// which tells an admin nothing. The address the visitor actually typed on the
// login screen is the useful one.
const contactEmailOf = (u: AdminUser): string => (u.isDemo && u.demoContactEmail) || u.email || '–';

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between gap-3 py-2 border-b border-border dark:border-border-dark last:border-0">
        <span className="text-caption text-text-secondary dark:text-text-dark-secondary flex-shrink-0">{label}</span>
        <span className="text-caption font-medium text-text-primary dark:text-text-dark-primary text-right break-words">{children}</span>
    </div>
);

// Icons (inline to avoid new deps)
const Icon = {
    edit: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>,
    role: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    deactivate: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
    activate: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    notify: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
    invoice: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    trash: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
    building: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>,
    clock: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

// ─── User detail modal ───────────────────────────────────────────────────────

type DetailView = 'detail' | 'edit' | 'notify' | 'invoices' | 'trial';

const UserDetailModal: React.FC<{
    user: AdminUser;
    currentUserId: string;
    onClose: () => void;
    onChanged: () => void;
    notify: (msg: string, ok?: boolean) => void;
}> = ({ user, currentUserId, onClose, onChanged, notify }) => {
    const [view, setView] = useState<DetailView>('detail');
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState<null | { label: string; tone: ActionTone; run: () => Promise<void> }>(null);

    // edit form
    const [form, setForm] = useState({
        name: user.name || '', email: user.email || '', phone: user.phone || '',
        jobTitle: user.jobTitle || '', subscriptionTier: user.subscriptionTier || 'FREE',
    });
    // notify form
    const [msg, setMsg] = useState({ title: '', text: '', link: '' });
    // invoices
    const [invoices, setInvoices] = useState<Invoice[] | null>(null);
    const [invoiceNote, setInvoiceNote] = useState<string | null>(null);
    // trial grant
    const [trialTier, setTrialTier] = useState(user.trialTier || 'PRO');
    const [trialEndsAt, setTrialEndsAt] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d.toISOString().slice(0, 10);
    });

    const isSelf = user.id === currentUserId;

    const act = async (path: string, init: RequestInit, okMsg: string) => {
        setBusy(true);
        try {
            const res = await apiFetch(path, init);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
            notify(okMsg, true);
            onChanged();
            return true;
        } catch (e) {
            notify(e instanceof Error ? e.message : 'Handlingen mislykkedes', false);
            return false;
        } finally {
            setBusy(false);
        }
    };

    const loadInvoices = useCallback(async () => {
        setInvoices(null);
        setInvoiceNote(null);
        try {
            const res = await apiFetch(`/api/admin/users/${user.id}/invoices`);
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || 'Kunne ikke hente fakturaer');
            setInvoices(payload.invoices || []);
            setInvoiceNote(payload.note || null);
        } catch (e) {
            setInvoices([]);
            setInvoiceNote(e instanceof Error ? e.message : 'Fejl');
        }
    }, [user.id]);

    const title = view === 'edit' ? 'Rediger bruger' : view === 'notify' ? 'Send besked' : view === 'invoices' ? 'Fakturaer' : view === 'trial' ? 'Trial-adgang' : (user.name || user.username);

    return (
        <DetailModal title={title} onClose={onClose}>
            {confirm && (
                <div className="mb-4 rounded-card border border-border dark:border-border-dark p-3 bg-bg-subtle dark:bg-bg-dark-muted">
                    <p className="text-body text-text-primary dark:text-text-dark-primary mb-3">{confirm.label}</p>
                    <div className="flex gap-2">
                        <Button
                            variant={confirm.tone === 'danger' ? 'danger' : 'primary'}
                            className="flex-1"
                            disabled={busy}
                            onClick={async () => { await confirm.run(); setConfirm(null); }}
                        >
                            Bekræft
                        </Button>
                        <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setConfirm(null)}>
                            Annuller
                        </Button>
                    </div>
                </div>
            )}

            {view === 'detail' && !confirm && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Avatar name={user.name || user.username} src={user.avatarUrl} size="lg" />
                        <div className="min-w-0">
                            <p className="text-heading text-text-primary dark:text-text-dark-primary truncate">{user.name || user.username}</p>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary truncate">{user.email || '–'}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Badge variant={user.appRole === 'admin' ? 'brand' : 'neutral'}>{user.appRole === 'admin' ? 'Admin' : 'Bruger'}</Badge>
                        <Badge variant={tierVariant(user.subscriptionTier)}>{user.subscriptionTier}</Badge>
                        <Badge variant={user.isActive ? 'success' : 'danger'} dot>{user.isActive ? 'Aktiv' : 'Deaktiveret'}</Badge>
                        <Badge variant={user.isPaid ? 'success' : 'neutral'}>{user.isPaid ? 'Betalende' : 'Gratis'}</Badge>
                        {user.isDemo && <Badge variant="warning">Demo</Badge>}
                        {user.isTrialActive && <Badge variant="info">Trial: {user.trialTier} til {formatDate(user.trialEndsAt)}</Badge>}
                    </div>

                    <Select
                        label="Brugertype"
                        value={user.userType}
                        disabled={isSelf}
                        onChange={(e) => act(`/api/admin/users/${user.id}/user-type`, { method: 'PATCH', body: JSON.stringify({ userType: e.target.value }) }, 'Brugertype opdateret')}
                    >
                        <option value="normal">Normal</option>
                        <option value="test">Test (Stripe testtilstand)</option>
                        <option value="partner">Partner</option>
                        <option value="admin">Admin</option>
                    </Select>

                    <div className="rounded-card border border-border dark:border-border-dark px-3">
                        <InfoRow label="Brugernavn">{user.username}</InfoRow>
                        <InfoRow label="Telefon">{user.phone || '–'}</InfoRow>
                        <InfoRow label="Jobtitel">{user.jobTitle || '–'}</InfoRow>
                        <InfoRow label="Virksomhed">{user.companyName || '–'}</InfoRow>
                        {user.isDemo && (
                            <InfoRow label="Demo-kontakt">{user.demoContactEmail || '–'}</InfoRow>
                        )}
                        <InfoRow label="Team">{user.teamId ? `${user.teamCount} medlem(mer)${user.teamRole ? ` · ${user.teamRole}` : ''}` : '–'}</InfoRow>
                        <InfoRow label="Registreret">{formatDate(user.createdAt)}</InfoRow>
                        <InfoRow label="Sidst aktiv">{formatDateTime(user.lastSignInAt)}</InfoRow>
                        <InfoRow label="Email bekræftet">{user.emailConfirmed == null ? '–' : user.emailConfirmed ? 'Ja' : 'Nej'}</InfoRow>
                        <InfoRow label="Fakturering">{user.hasBilling ? 'Stripe-kunde' : 'Ingen'}</InfoRow>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <ActionButton label="Rediger" icon={Icon.edit} onClick={() => setView('edit')} />
                        {user.isActive ? (
                            <ActionButton label="Deaktiver" icon={Icon.deactivate} tone="danger" disabled={isSelf}
                                onClick={() => setConfirm({
                                    label: `Deaktiver ${user.name || user.username}? De kan ikke logge ind før de aktiveres igen.`,
                                    tone: 'danger',
                                    run: () => act(`/api/admin/users/${user.id}/deactivate`, { method: 'POST' }, 'Bruger deaktiveret').then(() => undefined),
                                })} />
                        ) : (
                            <ActionButton label="Aktiver" icon={Icon.activate} tone="success"
                                onClick={() => act(`/api/admin/users/${user.id}/activate`, { method: 'POST' }, 'Bruger aktiveret')} />
                        )}
                        <ActionButton label="Send besked" icon={Icon.notify} onClick={() => setView('notify')} />
                        <ActionButton label="Fakturaer" icon={Icon.invoice} onClick={() => { setView('invoices'); loadInvoices(); }} />
                        <ActionButton label={user.isTrialActive ? 'Rediger trial' : 'Giv trial'} icon={Icon.clock} onClick={() => setView('trial')} />
                        <ActionButton label="Slet" icon={Icon.trash} tone="danger" disabled={isSelf}
                            onClick={() => setConfirm({
                                label: `Slet ${user.name || user.username} permanent? Konto, organisation, projekter og alle tilhørende data slettes. Dette kan ikke fortrydes.`,
                                tone: 'danger',
                                run: async () => { const ok = await act(`/api/admin/users/${user.id}`, { method: 'DELETE' }, 'Bruger slettet'); if (ok) onClose(); },
                            })} />
                    </div>
                    {isSelf && <p className="text-caption text-text-secondary dark:text-text-dark-secondary text-center">Nogle handlinger er deaktiveret for din egen konto.</p>}
                </div>
            )}

            {view === 'edit' && (
                <div className="space-y-3">
                    <Input label="Navn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <Input label="Jobtitel" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
                    <Select label="Abonnement" value={form.subscriptionTier} onChange={(e) => setForm({ ...form, subscriptionTier: e.target.value })}>
                        {['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'].map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                    <div className="flex gap-2 pt-2">
                        <Button className="flex-1" disabled={busy} onClick={async () => { const ok = await act(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(form) }, 'Profil opdateret'); if (ok) setView('detail'); }}>
                            Gem
                        </Button>
                        <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setView('detail')}>
                            Tilbage
                        </Button>
                    </div>
                </div>
            )}

            {view === 'notify' && (
                <div className="space-y-3">
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Sendes til {user.name || user.username} som notifikation (i app + push).</p>
                    <Input label="Titel (valgfri)" value={msg.title} onChange={(e) => setMsg({ ...msg, title: e.target.value })} placeholder="BygSmart" />
                    <Textarea label="Besked" rows={4} value={msg.text} onChange={(e) => setMsg({ ...msg, text: e.target.value })} />
                    <Input label="Link (valgfri)" value={msg.link} onChange={(e) => setMsg({ ...msg, link: e.target.value })} placeholder="/#/home" />
                    <div className="flex gap-2 pt-2">
                        <Button className="flex-1" disabled={busy || !msg.text.trim()} onClick={async () => { const ok = await act(`/api/admin/users/${user.id}/notify`, { method: 'POST', body: JSON.stringify(msg) }, 'Besked sendt'); if (ok) { setMsg({ title: '', text: '', link: '' }); setView('detail'); } }}>
                            Send
                        </Button>
                        <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setView('detail')}>
                            Tilbage
                        </Button>
                    </div>
                </div>
            )}

            {view === 'invoices' && (
                <div className="space-y-3">
                    <Button variant="ghost" size="sm" onClick={() => setView('detail')}>← Tilbage</Button>
                    {invoices === null ? (
                        <SkeletonList count={3} />
                    ) : invoices.length === 0 ? (
                        <p className="text-body text-text-secondary dark:text-text-dark-secondary text-center py-6">{invoiceNote || 'Ingen fakturaer.'}</p>
                    ) : (
                        <div className="space-y-2">
                            {invoices.map((inv) => (
                                <div key={inv.id} className="rounded-card border border-border dark:border-border-dark p-3">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="min-w-0">
                                            <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{inv.number || inv.id}</p>
                                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{formatDate(inv.created)}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-label font-bold text-text-primary dark:text-text-dark-primary">{formatMoney(inv.amountPaid || inv.amountDue, inv.currency)}</p>
                                            <Badge variant={inv.status === 'paid' ? 'success' : 'neutral'}>{inv.status || '–'}</Badge>
                                        </div>
                                    </div>
                                    {(inv.hostedInvoiceUrl || inv.pdfUrl) && (
                                        <div className="flex gap-3 mt-2">
                                            {inv.hostedInvoiceUrl && <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-label font-semibold text-brand-primary hover:underline">Vis</a>}
                                            {inv.pdfUrl && <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-label font-semibold text-brand-primary hover:underline">PDF</a>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'trial' && (
                <div className="space-y-3">
                    {user.isTrialActive && (
                        <Alert variant="info" title={`Aktiv trial: ${user.trialTier}`}>
                            <p className="text-caption">Udløber {formatDate(user.trialEndsAt)}. Gem herunder for at forlænge/ændre, eller fjern den.</p>
                        </Alert>
                    )}
                    <Select label="Abonnement under trial" value={trialTier} onChange={(e) => setTrialTier(e.target.value)}>
                        {['PRO', 'PREMIUM', 'ENTERPRISE'].map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                    <div className="flex gap-2">
                        {[7, 14, 30].map((days) => (
                            <Button key={days} variant="outline" size="sm" className="flex-1" disabled={busy}
                                onClick={async () => {
                                    const ok = await act(`/api/admin/users/${user.id}/trial`, { method: 'PATCH', body: JSON.stringify({ tier: trialTier, days }) }, `Trial givet i ${days} dage`);
                                    if (ok) setView('detail');
                                }}
                            >
                                +{days} dage
                            </Button>
                        ))}
                    </div>
                    <Input label="…eller indtil dato" type="date" value={trialEndsAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setTrialEndsAt(e.target.value)} />
                    <div className="flex gap-2 pt-2">
                        <Button
                            className="flex-1"
                            disabled={busy}
                            onClick={async () => {
                                const ok = await act(`/api/admin/users/${user.id}/trial`, { method: 'PATCH', body: JSON.stringify({ tier: trialTier, endsAt: new Date(trialEndsAt).toISOString() }) }, 'Trial opdateret');
                                if (ok) setView('detail');
                            }}
                        >
                            Gem
                        </Button>
                        {user.isTrialActive && (
                            <Button
                                variant="danger"
                                className="flex-1"
                                disabled={busy}
                                onClick={async () => {
                                    const ok = await act(`/api/admin/users/${user.id}/trial`, { method: 'PATCH', body: JSON.stringify({ tier: null }) }, 'Trial fjernet');
                                    if (ok) setView('detail');
                                }}
                            >
                                Fjern trial
                            </Button>
                        )}
                        <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setView('detail')}>
                            Tilbage
                        </Button>
                    </div>
                </div>
            )}
        </DetailModal>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

type AdminTab = 'overview' | 'users' | 'organizations' | 'teams' | 'delegation' | 'ai' | 'tools' | 'modules' | 'email' | 'promos';

// Tabs that manage their own data fetching (period-aware insight sections)
// rather than reading from the shared `data` (overview) state.
const SELF_CONTAINED_TABS: AdminTab[] = ['ai', 'tools', 'modules', 'email', 'promos', 'organizations', 'teams', 'delegation'];

const ADMIN_TABS: Array<{ id: AdminTab; label: string }> = [
    { id: 'overview', label: 'Oversigt' },
    { id: 'users', label: 'Brugere' },
    { id: 'organizations', label: 'Organisationer' },
    { id: 'teams', label: 'Teams & sæder' },
    { id: 'delegation', label: 'Leverandører & rapporter' },
    { id: 'ai', label: 'AI-orkestrering' },
    { id: 'tools', label: 'Værktøjsadgang' },
    { id: 'modules', label: 'Moduler' },
    { id: 'email', label: 'E-mail / SMTP' },
    { id: 'promos', label: 'Rabat & prøve' },
];

const AdminDashboardPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<OverviewData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<AdminTab>('overview');
    const [period, setPeriod] = useState<AdminPeriodValue>(() => defaultAdminPeriod());
    const [query, setQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    // Demo accounts that never completed the welcome step — bulk-purgeable.
    const [purgeable, setPurgeable] = useState<AdminPurgeableDemoUser[]>([]);
    const [purging, setPurging] = useState(false);
    const [confirmPurge, setConfirmPurge] = useState(false);

    const showToast = useCallback((msg: string, ok = true) => {
        setToast({ msg, ok });
        window.setTimeout(() => setToast(null), 3200);
    }, []);

    const fetchOverview = useCallback(async () => {
        setError(null);
        try {
            const qs = new URLSearchParams({ from: period.from, to: period.to, compare: period.compare });
            const res = await apiFetch(`/api/admin/overview?${qs.toString()}`);
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || `HTTP ${res.status}`);
            }
            const json = await res.json();
            setData(json);
            // Keep an open modal in sync with refreshed data.
            setSelectedUser((prev) => (prev ? json.users.find((u: AdminUser) => u.id === prev.id) || null : null));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ukendt fejl');
        } finally {
            setIsLoading(false);
        }
    }, [period.from, period.to, period.compare]);

    // Dry run for the bulk purge — this is the list the confirmation counts.
    const fetchPurgeable = useCallback(async () => {
        try {
            const res = await apiFetch('/api/admin/demo-users/purgeable');
            if (!res.ok) return;
            const json = await res.json();
            setPurgeable(json.users || []);
        } catch {
            /* non-fatal — the purge banner simply stays hidden */
        }
    }, []);

    const runPurge = useCallback(async () => {
        setPurging(true);
        try {
            const res = await apiFetch('/api/admin/demo-users/purge', { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
            showToast(
                json.failedCount
                    ? `${json.deletedCount} demokonti slettet, ${json.failedCount} fejlede.`
                    : `${json.deletedCount} demokonti slettet.`,
                !json.failedCount
            );
            await Promise.all([fetchOverview(), fetchPurgeable()]);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Sletning fejlede.', false);
        } finally {
            setPurging(false);
            setConfirmPurge(false);
        }
    }, [fetchOverview, fetchPurgeable, showToast]);

    useEffect(() => {
        if (!user) return;
        if (user.appRole !== 'admin') {
            navigate('/home', { replace: true });
            return;
        }
        setIsLoading(true);
        fetchOverview();
        fetchPurgeable();
    }, [user, navigate, fetchOverview, fetchPurgeable]);

    const purgeableCount = purgeable.length;

    // One shared clock drives every trial countdown on the users tab, so the
    // list ticks in step and idle tabs don't run a timer per card.
    const [nowMs, setNowMs] = useState(() => Date.now());
    const hasLiveTrial = (data?.users || []).some((u) => u.isTrialActive);
    useEffect(() => {
        if (activeTab !== 'users' || !hasLiveTrial) return;
        const id = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [activeTab, hasLiveTrial]);

    // Hooks must run unconditionally (before the admin-gate early return below),
    // so these are memoized here rather than after it.
    const filteredUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (data?.users || []).filter((u) =>
            !q
            || (u.name || '').toLowerCase().includes(q)
            || (u.email || '').toLowerCase().includes(q)
            || (u.username || '').toLowerCase().includes(q)
            || (u.companyName || '').toLowerCase().includes(q)
            || (u.demoContactEmail || '').toLowerCase().includes(q)
        );
    }, [data, query]);

    // user insights
    const userInsights = useMemo(() => {
        const ui = data?.users || [];
        return {
            active: ui.filter((u) => u.isActive).length,
            deactivated: ui.filter((u) => !u.isActive).length,
            paid: ui.filter((u) => u.isPaid).length,
            admins: ui.filter((u) => u.appRole === 'admin').length,
        };
    }, [data]);

    if (!user || user.appRole !== 'admin') return null;

    return (
        <div className="bg-bg-subtle dark:bg-bg-dark min-h-screen transition-colors duration-300">
            <div className="sticky top-0 z-10 bg-bg-subtle/95 dark:bg-bg-dark/95 backdrop-blur-sm border-b border-border dark:border-border-dark px-4 pt-safe">
                <AppHeader title="Admin Dashboard" back />
                <Tabs
                    aria-label="Admin sektioner"
                    variant="pills"
                    className="pb-2.5"
                    value={activeTab}
                    onChange={(id) => setActiveTab(id as AdminTab)}
                    tabs={ADMIN_TABS.map(({ id, label }) => ({ id, label }))}
                />
            </div>

            {/* Toast */}
            {toast && (
                <div role="status" className={`fixed top-20 left-1/2 -translate-x-1/2 z-[110] px-4 py-2.5 rounded-card shadow-raised text-label font-semibold text-white ${toast.ok ? 'bg-success' : 'bg-danger'}`}>
                    {toast.msg}
                </div>
            )}

            <main className="p-4 pb-24 space-y-6">
                {activeTab === 'ai' && <AiOrchestrationPanel />}
                {activeTab === 'tools' && <ToolAccessPanel />}
                {activeTab === 'modules' && <ModuleEntitlementsPanel />}
                {activeTab === 'email' && <SmtpSettingsPanel />}
                {activeTab === 'promos' && <PromoCodePanel />}
                {activeTab === 'organizations' && (
                    <div className="space-y-4 animate-fade-in">
                        <DateRangeFilter value={period} onChange={setPeriod} />
                        <OrganizationsSection apiFetch={apiFetch} period={period} />
                    </div>
                )}
                {activeTab === 'teams' && (
                    <div className="space-y-4 animate-fade-in">
                        <DateRangeFilter value={period} onChange={setPeriod} />
                        <TeamsSection apiFetch={apiFetch} period={period} />
                    </div>
                )}
                {activeTab === 'delegation' && (
                    <div className="space-y-4 animate-fade-in">
                        <DateRangeFilter value={period} onChange={setPeriod} />
                        <DelegationReportsSection apiFetch={apiFetch} period={period} />
                    </div>
                )}

                {!SELF_CONTAINED_TABS.includes(activeTab) && isLoading && (
                    <Card>
                        <SkeletonList count={4} />
                    </Card>
                )}

                {!SELF_CONTAINED_TABS.includes(activeTab) && error && (
                    <Alert variant="danger" title="Backend-serveren er ikke tilgængelig">
                        <p className="text-caption">{error}</p>
                        <p className="text-caption mt-1">
                            Genstart backend via cPanel → Node.js Applications → Restart, eller tjek serverloggen:
                            <br /><code className="font-mono">ssh namecheap 'tail -30 ~/logs/byggeapp_server.log'</code>
                        </p>
                    </Alert>
                )}

                {!SELF_CONTAINED_TABS.includes(activeTab) && !isLoading && !error && data && (
                    <>
                        {/* Overview tab */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-fade-in">
                                <section>
                                    <DateRangeFilter value={period} onChange={setPeriod} />
                                </section>
                                <section>
                                    <SectionTitle>Platformsoversigt</SectionTitle>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                        <StatCard value={data.stats.userCount} label="Brugere" tone="brand" />
                                        <StatCard value={data.stats.companyCount} label="Organisationer" onClick={() => setActiveTab('organizations')} />
                                        <StatCard value={data.stats.projectCount} label="Projekter" />
                                        <StatCard value={data.stats.taskCount} label="Opgaver oprettet" />
                                        <StatCard value={data.stats.tasksSolved} label="Opgaver løst" tone="success" />
                                        <StatCard value={data.stats.tasksOverdue} label="Forfaldne opgaver" tone="danger" />
                                    </div>
                                    <Card className="flex flex-wrap gap-x-6 gap-y-2 mt-2.5">
                                        <span className="flex flex-col gap-0.5">
                                            <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Nye brugere i perioden</span>
                                            <PeriodDelta delta={data.period.newUsers} goodDirection="up" />
                                        </span>
                                        <span className="flex flex-col gap-0.5">
                                            <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Nye organisationer i perioden</span>
                                            <PeriodDelta delta={data.period.newCompanies} goodDirection="up" />
                                        </span>
                                        <span className="flex flex-col gap-0.5">
                                            <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Opgaver løst i perioden</span>
                                            <PeriodDelta delta={data.period.tasksSolved} goodDirection="up" />
                                        </span>
                                        <span className="flex flex-col gap-0.5">
                                            <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Projekter afsluttet i perioden</span>
                                            <PeriodDelta delta={data.period.projectsFinished} goodDirection="up" />
                                        </span>
                                    </Card>
                                </section>
                                <section>
                                    <SectionTitle>Omsætning</SectionTitle>
                                    <RevenueSection apiFetch={apiFetch} period={period} />
                                </section>
                                <section>
                                    <SectionTitle>Seneste logins</SectionTitle>
                                    <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                                        {data.users.slice(0, 5).map((u) => (
                                            <ListRow
                                                key={u.id}
                                                leading={<Avatar name={u.name || u.username} src={u.avatarUrl} size="sm" />}
                                                title={u.name || u.username}
                                                subtitle={u.email || '–'}
                                                trailing={<Badge variant={u.appRole === 'admin' ? 'brand' : 'neutral'}>{u.appRole === 'admin' ? 'Admin' : 'Bruger'}</Badge>}
                                                onClick={() => { setActiveTab('users'); setSelectedUser(u); }}
                                            />
                                        ))}
                                    </Card>
                                </section>
                            </div>
                        )}

                        {/* Users tab */}
                        {activeTab === 'users' && (
                            <div className="space-y-3 animate-fade-in">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <StatCard value={data.stats.userCount} label="Brugere" tone="brand" />
                                    <StatCard value={userInsights.active} label="Aktive" tone="success" />
                                    <StatCard value={userInsights.deactivated} label="Deaktiveret" tone="danger" />
                                    <StatCard value={userInsights.paid} label="Betalende" tone="success" />
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <StatCard value={userInsights.admins} label="Admins" tone="info" />
                                    <StatCard value={data.stats.activeTrials} label="Aktive trials" tone="info" />
                                    <StatCard value={data.stats.trialsExpiringSoon} label="Trial udløber ≤7 dage" tone={data.stats.trialsExpiringSoon > 0 ? 'warning' : 'default'} />
                                </div>
                                <Input aria-label="Søg brugere" placeholder="Søg navn, email, brugernavn, virksomhed…" value={query} onChange={(e) => setQuery(e.target.value)} />
                                <div className="flex items-center justify-between gap-2">
                                    <SectionTitle>Alle brugere ({filteredUsers.length})</SectionTitle>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={filteredUsers.length === 0}
                                        onClick={() => downloadCsv(
                                            `brugere_${new Date().toISOString().slice(0, 10)}.csv`,
                                            ['Navn', 'Email', 'Brugernavn', 'Rolle', 'Abonnement', 'Virksomhed', 'Demo', 'Demo-kontakt', 'Aktiv', 'Registreret'],
                                            filteredUsers.map((u) => [u.name, u.email, u.username, u.appRole, u.subscriptionTier, u.companyName, u.isDemo ? 'Ja' : 'Nej', u.demoContactEmail, u.isActive ? 'Ja' : 'Nej', formatDate(u.createdAt)])
                                        )}
                                    >
                                        Eksporter CSV
                                    </Button>
                                </div>
                                {purgeableCount > 0 && (
                                    <Alert variant="warning" title={`${purgeableCount} ubrugte demokonti`}>
                                        <p className="text-caption">
                                            Demokonti der aldrig gennemførte velkomsttrinnet (stadig navngivet "{PLACEHOLDER_DEMO_NAME}").
                                            Sletning fjerner konto, organisation, projekter og alle tilhørende data permanent.
                                        </p>
                                        <div className="mt-2">
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                loading={purging}
                                                onClick={() => setConfirmPurge(true)}
                                            >
                                                Slet {purgeableCount} demokonti
                                            </Button>
                                        </div>
                                    </Alert>
                                )}
                                {filteredUsers.length === 0 ? (
                                    <EmptyState title="Ingen brugere fundet." description="Prøv at justere søgningen." />
                                ) : (
                                    <div className="space-y-2">
                                        {filteredUsers.map((u) => (
                                            <UserCard
                                                key={u.id}
                                                user={u}
                                                nowMs={nowMs}
                                                contactEmail={contactEmailOf(u)}
                                                tierVariant={tierVariant}
                                                onClick={() => setSelectedUser(u)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </>
                )}
            </main>

            {selectedUser && (
                <UserDetailModal user={selectedUser} currentUserId={user.id} onClose={() => setSelectedUser(null)} onChanged={fetchOverview} notify={showToast} />
            )}

            {confirmPurge && (
                <DetailModal title="Slet ubrugte demokonti" onClose={() => setConfirmPurge(false)}>
                    <div className="space-y-3">
                        <Alert variant="danger" title={`${purgeableCount} konti slettes permanent`}>
                            <p className="text-caption">
                                Konto, personlig organisation, projekter og alle tilhørende data fjernes.
                                Handlingen kan ikke fortrydes. Demokonti hvor besøgende har oplyst navn og
                                firma bevares — dem må du slette enkeltvis.
                            </p>
                        </Alert>
                        <Card padding="none" className="max-h-64 overflow-y-auto divide-y divide-border dark:divide-border-dark">
                            {purgeable.map((p) => (
                                <ListRow
                                    key={p.id}
                                    className="px-3 py-2"
                                    title={p.demoContactEmail || p.email || p.id}
                                    subtitle={`Oprettet ${formatDate(p.createdAt)}`}
                                />
                            ))}
                        </Card>
                        <div className="flex gap-2">
                            <Button variant="danger" className="flex-1" loading={purging} onClick={runPurge}>
                                Slet {purgeableCount} konti
                            </Button>
                            <Button variant="secondary" className="flex-1" disabled={purging} onClick={() => setConfirmPurge(false)}>
                                Annuller
                            </Button>
                        </div>
                    </div>
                </DetailModal>
            )}
        </div>
    );
};

export default AdminDashboardPage;
