
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserIcon, FileTextIcon, XIcon, EyeIcon } from '../components/icons';
import { useAuth } from '../contexts/AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { PLAN_DETAILS } from '../config/subscriptionPlans';
import { getPendingPlan, clearPendingPlan, planParamToTier } from '../services/pendingPlan';
import { EditProfileModal } from '../components/settings/EditProfileModal';
import { MfaEnrollModal } from '../components/settings/MfaEnrollModal';
import { SubscriptionModal } from '../components/settings/SubscriptionModal';
import SmtpForm, { SmtpFormFields } from '../components/settings/SmtpForm';
import OrganisationSection from '../components/org/OrganisationSection';
import { StorageAddonCard } from '../components/marketplace/StorageAddonCard';
import { AiUsageCard } from '../components/settings/AiUsageCard';
import { SectionTitle } from '../components/settings/SectionTitle';
import { useSlot } from '../core/registry/hooks';
import type { SettingsSectionContribution } from '../core/registry/types';
import {
    getSmtpConfig,
    saveSmtpConfig,
    testSmtpConnection,
    sendSmtpTestEmail,
    SmtpConfigShape,
    SmtpSavePayload,
} from '../services/api';
import {
    Alert,
    AppScreen,
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    ListRow,
    Modal,
    SegmentedControl,
    Spinner,
    cn,
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { enablePushNotifications, getPushStatus, disablePushNotifications, sendTestPush, PushStatus } from '../services/pushNotifications';

// Module-contributed settings blocks (e.g. Integrationer) arrive via the
// settingsSections slot; React.lazy wrappers must be stable across renders.
const sectionCache = new Map<string, React.LazyExoticComponent<React.ComponentType>>();
const getSectionComponent = (c: SettingsSectionContribution) => {
    let cached = sectionCache.get(c.id);
    if (!cached) {
        cached = React.lazy(c.load);
        sectionCache.set(c.id, cached);
    }
    return cached;
};

/** Accessible toggle: real button with switch semantics and a 44px hit area. */
const Switch: React.FC<{
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    'aria-label': string;
}> = ({ checked, onChange, disabled, 'aria-label': ariaLabel }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked ? 'true' : 'false'}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onChange}
        className="shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
    >
        <span
            className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150',
                checked ? 'bg-brand-primary' : 'bg-border-strong dark:bg-border-dark-strong'
            )}
            aria-hidden="true"
        >
            <span
                className={cn(
                    'inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-150',
                    checked ? 'translate-x-[22px]' : 'translate-x-0.5'
                )}
            />
        </span>
    </button>
);

/** Static row shell for switch settings (leading icon + text + control). */
const SwitchRow: React.FC<{
    icon: React.ReactNode;
    title: string;
    subtitle?: React.ReactNode;
    control: React.ReactNode;
}> = ({ icon, title, subtitle, control }) => (
    <div className="flex w-full items-center gap-3 px-4 py-3 min-h-11">
        <span className="shrink-0 flex items-center">{icon}</span>
        <span className="min-w-0 grow">
            <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary">{title}</span>
            {subtitle && (
                <span className="block text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">{subtitle}</span>
            )}
        </span>
        {control}
    </div>
);

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, updateUser, deleteAccount, refreshUser } = useAuth();
    const { theme, setTheme, transparentMenu, setTransparentMenu } = useTheme();
    const { tier, openPortal } = useSubscription();
    const { showToast } = useToast();
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [isMfaOpen, setIsMfaOpen] = useState(false);
    const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
    const [preselectTier, setPreselectTier] = useState<string | null>(null);
    const [billingBanner, setBillingBanner] = useState<'success' | 'cancelled' | null>(null);
    const [isPortalLoading, setIsPortalLoading] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const billingParam = params.get('billing');
        if (billingParam === 'success') {
            setBillingBanner('success');
            showToast('Abonnement aktiveret! Velkommen til din nye plan.', 'success');
            navigate('/settings', { replace: true });
            refreshUser();
        } else if (billingParam === 'cancelled') {
            setBillingBanner('cancelled');
            navigate('/settings', { replace: true });
        } else if (billingParam === 'portal') {
            showToast('Du er tilbage fra abonnementsportalen.', 'info');
            navigate('/settings', { replace: true });
        }

    }, []);

    useEffect(() => {
        getPushStatus().then(setPushStatus);
    }, []);

    // Open the subscription chooser preselected to the plan a user picked during
    // signup — either passed via ?plan= (immediate flow) or stashed in localStorage
    // across the email-confirmation round-trip. One-shot: cleared once consumed.
    useEffect(() => {
        const fromUrl = planParamToTier(new URLSearchParams(location.search).get('plan'));
        const pending = fromUrl || getPendingPlan();
        if (pending && pending !== tier) {
            setPreselectTier(pending);
            setIsSubscriptionOpen(true);
        }
        clearPendingPlan();
        if (fromUrl) navigate('/settings', { replace: true });
    }, []);

    const handleOpenPortal = async () => {
        setIsPortalLoading(true);
        await openPortal();
        setIsPortalLoading(false);
    };

    const isPaidTier = tier === 'PRO' || tier === 'PREMIUM';
    // Only subscription owners (team leaders or single-profile users) on a
    // Premium/Enterprise plan may configure their own SMTP server.
    const isSmtpOwner =
        (tier === 'PREMIUM' || tier === 'ENTERPRISE') &&
        (user?.teamRole === 'leader' || user?.teamRole == null || user?.teamRole === undefined) &&
        user?.teamRole !== 'staff' && user?.teamRole !== 'member';
    const planDetails = PLAN_DETAILS[tier];
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
    const [isEnablingPush, setIsEnablingPush] = useState(false);

    // Owner SMTP config (loaded lazily when the modal opens)
    const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
    const [smtpConfig, setSmtpConfig] = useState<SmtpConfigShape | null>(null);
    const [smtpLoading, setSmtpLoading] = useState(false);
    const [smtpLoadError, setSmtpLoadError] = useState<string | null>(null);
    const [smtpSaving, setSmtpSaving] = useState(false);
    const [smtpTesting, setSmtpTesting] = useState(false);
    const [smtpSendingTest, setSmtpSendingTest] = useState(false);
    const [smtpSaveResult, setSmtpSaveResult] = useState<{ ok: boolean; error?: string } | null>(null);
    const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
    const [smtpSendTestResult, setSmtpSendTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

    // Fetch the owner's custom SMTP config. The API always returns a safe shape
    // on success (never null), so a null smtpConfig means "not loaded / failed".
    const loadSmtpConfig = async () => {
        setSmtpLoading(true);
        setSmtpLoadError(null);
        try {
            const data = await getSmtpConfig('custom');
            setSmtpConfig(data);
        } catch (err) {
            setSmtpLoadError(err instanceof Error ? err.message : 'Kunne ikke hente SMTP-konfiguration.');
        } finally {
            setSmtpLoading(false);
        }
    };

    const handleOpenSmtp = () => {
        setIsSmtpModalOpen(true);
        // Load lazily on first open or after a previous failure (config stays null).
        if (smtpConfig === null && !smtpLoading) {
            loadSmtpConfig();
        }
    };

    const handleSaveSmtp = async (fields: SmtpFormFields) => {
        setSmtpSaving(true);
        setSmtpSaveResult(null);
        try {
            const payload: SmtpSavePayload = {
                host: fields.host,
                port: fields.port,
                secure: fields.secure,
                username: fields.username,
                fromName: fields.fromName,
                fromEmail: fields.fromEmail,
                enabled: fields.enabled,
                ...(fields.password ? { password: fields.password } : {}),
            };
            const updated = await saveSmtpConfig('custom', payload);
            setSmtpConfig(updated);
            setSmtpSaveResult({ ok: true });
            showToast('SMTP-indstillinger gemt.', 'success');
        } catch (err) {
            setSmtpSaveResult({ ok: false, error: err instanceof Error ? err.message : 'Ukendt fejl.' });
        } finally {
            setSmtpSaving(false);
        }
    };

    const handleTestSmtp = async () => {
        setSmtpTesting(true);
        setSmtpTestResult(null);
        try {
            setSmtpTestResult(await testSmtpConnection('custom'));
        } catch (err) {
            setSmtpTestResult({ ok: false, error: err instanceof Error ? err.message : 'Ukendt fejl.' });
        } finally {
            setSmtpTesting(false);
        }
    };

    const handleSendTestSmtp = async () => {
        setSmtpSendingTest(true);
        setSmtpSendTestResult(null);
        try {
            setSmtpSendTestResult(await sendSmtpTestEmail('custom'));
        } catch (err) {
            setSmtpSendTestResult({ ok: false, error: err instanceof Error ? err.message : 'Ukendt fejl.' });
        } finally {
            setSmtpSendingTest(false);
        }
    };

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const settingsSections = useSlot('settingsSections');

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const handleUpdateProfile = async (data: { name: string; initials: string; email: string; jobTitle: import('../types').JobTitle | null; companyName: string; cvr: string; address: string; phone: string }) => {
        await updateUser(data);
    };

    const handleOpenDeleteAccount = () => {
        setDeleteConfirmation('');
        setIsDeleteModalOpen(true);
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmation.trim().toUpperCase() !== 'SLET') {
            showToast('Skriv SLET for at bekræfte kontosletning.', 'warning');
            return;
        }

        setIsDeletingAccount(true);
        const result = await deleteAccount();
        setIsDeletingAccount(false);

        if (!result.success) {
            showToast(result.message, 'error');
            return;
        }

        setIsDeleteModalOpen(false);
        showToast(result.message, 'success');
        navigate('/welcome');
    };

    const handleTogglePush = async () => {
        if (pushStatus === 'enabled') {
            setIsEnablingPush(true);
            await disablePushNotifications();
            setPushStatus('failed');
            setIsEnablingPush(false);
            showToast('Push-notifikationer er slået fra.', 'info');
        } else {
            await handleEnablePush();
        }
    };

    const handleEnablePush = async () => {
        setIsEnablingPush(true);
        const status = await enablePushNotifications();
        setPushStatus(status);
        setIsEnablingPush(false);

        if (status === 'enabled') {
            showToast('Push-notifikationer er slået til.', 'success');
            sendTestPush().catch(() => {});
        } else if (status === 'unsupported') {
            showToast('Push understøttes ikke i denne browser. På iPhone: tilføj appen til hjemmeskærmen via Del-knappen og åbn den derfra.', 'warning');
        } else if (status === 'denied') {
            showToast('Push-tilladelse er blokeret. Gå til browserens indstillinger → Webstedstilladelser → Notifikationer og tillad denne side.', 'warning');
        } else {
            showToast('Kunne ikke slå push-notifikationer til. Prøv igen eller kontakt support.', 'error');
        }
    };

    const tierBadgeVariant = tier === 'PREMIUM' ? 'warning' : tier === 'PRO' ? 'info' : 'neutral';

    return (
        <AppScreen hasBottomNav={false} width="reading" header={{ title: 'Indstillinger', back: '/home' }}>
            <div className="flex flex-col gap-6 mt-2">

                {billingBanner === 'success' && (
                    <Alert
                        variant="success"
                        title="Betaling gennemført!"
                        action={
                            <Button variant="ghost" size="sm" onClick={() => setBillingBanner(null)} aria-label="Luk besked">
                                <XIcon className="w-4 h-4" />
                            </Button>
                        }
                    >
                        Dit abonnement er nu aktivt. Din plan er opgraderet til <strong>{planDetails?.label}</strong>.
                    </Alert>
                )}

                {billingBanner === 'cancelled' && (
                    <Alert
                        variant="warning"
                        title="Betaling annulleret"
                        action={
                            <Button variant="ghost" size="sm" onClick={() => setBillingBanner(null)} aria-label="Luk besked">
                                <XIcon className="w-4 h-4" />
                            </Button>
                        }
                    >
                        Du blev ikke opkrævet. Din nuværende plan er uændret.
                    </Alert>
                )}

                {/* ── Forbrug: lagerplads + AI side om side ───────────────── */}
                <div className="grid grid-cols-2 gap-2.5">
                    <StorageAddonCard compact />
                    <AiUsageCard />
                </div>

                {/* ── Profil ─────────────────────────────────────────────── */}
                <section className="flex flex-col gap-3" aria-label="Profil">
                    <SectionTitle>Profil</SectionTitle>
                    <Card padding="none" className="overflow-hidden">
                        <ListRow
                            leading={
                                <span className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center text-heading font-bold shrink-0" aria-hidden="true">
                                    {user?.initials || <UserIcon className="w-6 h-6" />}
                                </span>
                            }
                            title={user?.name || 'Bruger'}
                            subtitle={
                                <>
                                    @{user?.username || 'brugernavn'}
                                    {user?.jobTitle && user.jobTitle !== 'No title' && <> · {user.jobTitle}</>}
                                </>
                            }
                            onClick={() => setIsEditProfileOpen(true)}
                        />
                        <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-1 text-caption border-t border-border dark:border-border-dark [&>div]:mt-2">
                            <div className="bg-bg-muted dark:bg-bg-dark-muted rounded-control p-2.5">
                                <p className="text-text-secondary dark:text-text-dark-secondary mb-0.5">Bruger ID</p>
                                <p className="font-mono text-text-primary dark:text-text-dark-primary truncate">{user?.id?.slice(0, 8)}…</p>
                            </div>
                            <div className="bg-bg-muted dark:bg-bg-dark-muted rounded-control p-2.5">
                                <p className="text-text-secondary dark:text-text-dark-secondary mb-0.5">Abonnement</p>
                                <Badge variant={tierBadgeVariant}>{planDetails?.label ?? tier}</Badge>
                            </div>
                            <div className="bg-bg-muted dark:bg-bg-dark-muted rounded-control p-2.5">
                                <p className="text-text-secondary dark:text-text-dark-secondary mb-0.5">Status</p>
                                <span className={cn('inline-flex items-center gap-1 font-semibold', isPaidTier ? 'text-success' : 'text-text-tertiary dark:text-text-dark-tertiary')}>
                                    <span className={cn('w-1.5 h-1.5 rounded-full', isPaidTier ? 'bg-success' : 'bg-border-strong dark:bg-border-dark-strong')}></span>
                                    {isPaidTier ? 'Aktiv' : 'Gratis'}
                                </span>
                            </div>
                            <div className="bg-bg-muted dark:bg-bg-dark-muted rounded-control p-2.5">
                                <p className="text-text-secondary dark:text-text-dark-secondary mb-0.5">Rolle</p>
                                <p className="font-semibold text-text-primary dark:text-text-dark-primary">
                                    {user?.teamRole === 'leader' ? '👑 Team leder' : user?.teamRole === 'staff' ? '👤 Team Staff' : '🔵 Enkeltprofil'}
                                </p>
                            </div>
                            <div className="bg-bg-muted dark:bg-bg-dark-muted rounded-control p-2.5 col-span-2">
                                <p className="text-text-secondary dark:text-text-dark-secondary mb-0.5">Profil oprettet</p>
                                <p className="font-semibold text-text-primary dark:text-text-dark-primary">
                                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('da-DK', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                                </p>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* ── Organisation (BYG 3.0 Phase 2) ─────────────────────── */}
                <OrganisationSection />

                {/* ── Administration (admin) — dashboard + AI-orkestrering ── */}
                {user?.appRole === 'admin' && (
                    <section className="flex flex-col gap-3" aria-label="Administration">
                        <SectionTitle>Administration</SectionTitle>
                        <Card padding="none" className="overflow-hidden">
                            <ListRow
                                leading={
                                    <svg className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                                    </svg>
                                }
                                title="Admin Dashboard"
                                subtitle="Brugere, virksomheder, AI-orkestrering & værktøjer"
                                onClick={() => navigate('/admin')}
                            />
                        </Card>
                    </section>
                )}

                {/* ── Udseende ───────────────────────────────────────────── */}
                <section className="flex flex-col gap-3" aria-label="Udseende">
                    <SectionTitle>Udseende</SectionTitle>
                    <Card padding="none" className="overflow-hidden">
                        <div className="p-3 border-b border-border dark:border-border-dark">
                            <SegmentedControl
                                label="Tema"
                                value={theme}
                                onChange={(mode) => setTheme(mode as 'light' | 'dark' | 'system')}
                                options={[
                                    { label: 'Lys', value: 'light' },
                                    { label: 'Mørk', value: 'dark' },
                                    { label: 'System', value: 'system' },
                                ]}
                            />
                        </div>
                        <SwitchRow
                            icon={<EyeIcon className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />}
                            title="Transparent menu"
                            subtitle="Gør bundmenuen gennemsigtig ved inaktivitet"
                            control={
                                <Switch
                                    checked={transparentMenu}
                                    onChange={() => setTransparentMenu(!transparentMenu)}
                                    aria-label="Transparent menu"
                                />
                            }
                        />
                    </Card>
                </section>

                {/* ── Abonnement ─────────────────────────────────────────── */}
                <section className="flex flex-col gap-3" aria-label="Abonnement">
                    <SectionTitle>Abonnement</SectionTitle>
                    <Card padding="none" className="overflow-hidden divide-y divide-border dark:divide-border-dark">
                        <ListRow
                            data-testid="settings-subscription-button"
                            leading={<FileTextIcon className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />}
                            title="Abonnement"
                            subtitle="Se planer eller skift plan"
                            trailing={<Badge variant={tierBadgeVariant}>{planDetails?.label ?? tier}</Badge>}
                            onClick={() => setIsSubscriptionOpen(true)}
                        />
                        <ListRow
                            leading={
                                <svg className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                                </svg>
                            }
                            title="Moduler"
                            subtitle="Udvid din BygSmart — se og aktivér moduler"
                            onClick={() => navigate('/moduler')}
                        />

                        {isPaidTier && (
                            <>
                                <ListRow
                                    leading={
                                        <svg className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                                        </svg>
                                    }
                                    title={isPortalLoading ? 'Åbner portal…' : 'Administrer abonnement'}
                                    subtitle="Kortoplysninger, fakturaer & opsigelse"
                                    trailing={isPortalLoading ? <Spinner className="h-4 w-4 text-text-tertiary dark:text-text-dark-tertiary" /> : undefined}
                                    disabled={isPortalLoading}
                                    onClick={handleOpenPortal}
                                />
                                <ListRow
                                    leading={
                                        <svg className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                                        </svg>
                                    }
                                    title="Team"
                                    subtitle={user?.teamRole === 'leader' ? 'Administrer dit team' : 'Opret og administrer team'}
                                    onClick={() => navigate('/team')}
                                />
                            </>
                        )}

                        {/* SMTP entry — gated on isSmtpOwner only (Premium/Enterprise owners),
                            so Enterprise owners reach it even though isPaidTier excludes them. */}
                        {isSmtpOwner && (
                            <ListRow
                                leading={
                                    <svg className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                                    </svg>
                                }
                                title="E-mail (SMTP)"
                                subtitle="Konfigurer din egen SMTP-server"
                                onClick={handleOpenSmtp}
                            />
                        )}
                    </Card>
                </section>

                {/* ── App ────────────────────────────────────────────────── */}
                <section className="flex flex-col gap-3" aria-label="App">
                    <SectionTitle>App</SectionTitle>
                    <Card padding="none" className="overflow-hidden divide-y divide-border dark:divide-border-dark">
                        <SwitchRow
                            icon={
                                <svg className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                                </svg>
                            }
                            title="Push-notifikationer"
                            subtitle={
                                pushStatus === 'enabled' ? '✓ Aktiveret'
                                : pushStatus === 'denied' ? '⚠ Blokeret — tillad i browserindstillinger'
                                : pushStatus === 'unsupported' ? 'Tilføj appen til hjemmeskærmen på iPhone'
                                : 'Modtag beskeder fra BygSmart'
                            }
                            control={
                                <Switch
                                    checked={pushStatus === 'enabled'}
                                    onChange={handleTogglePush}
                                    disabled={isEnablingPush}
                                    aria-label="Push-notifikationer"
                                />
                            }
                        />
                        <ListRow
                            leading={
                                <svg className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                                </svg>
                            }
                            title="E-mail notifikationer"
                            subtitle="Vælg hvilke hændelser du får e-mail og push om"
                            onClick={() => navigate('/settings/notifications')}
                        />
                        <ListRow
                            leading={<FileTextIcon className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />}
                            title="Hjælp & Manual"
                            onClick={() => navigate('/help')}
                        />
                        <ListRow
                            leading={<FileTextIcon className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />}
                            title="Se Logs"
                            onClick={() => navigate('/logs')}
                        />
                    </Card>
                </section>

                {/* ── Sikkerhed ──────────────────────────────────────────── */}
                <section className="flex flex-col gap-3" aria-label="Sikkerhed">
                    <SectionTitle>Sikkerhed</SectionTitle>
                    <Card padding="none" className="overflow-hidden">
                        <ListRow
                            leading={
                                <svg className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                </svg>
                            }
                            title="To-faktor-godkendelse"
                            subtitle="Beskyt din konto med en authenticator-app"
                            onClick={() => setIsMfaOpen(true)}
                        />
                    </Card>
                </section>

                {/* ── Module-contributed blocks (Integrationer m.fl.) ───── */}
                {settingsSections.map((c) => {
                    const Section = getSectionComponent(c);
                    return (
                        <React.Suspense key={c.id} fallback={null}>
                            <Section />
                        </React.Suspense>
                    );
                })}

                {/* ── Data & konto (farezone) ────────────────────────────── */}
                <section className="flex flex-col gap-3" aria-label="Data og konto">
                    <SectionTitle danger>Data & konto</SectionTitle>
                    <Card padding="none" className="overflow-hidden border-danger/40 divide-y divide-danger/20">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 min-h-11 text-left hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark transition-colors duration-150"
                        >
                            <svg className="w-5 h-5 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                            </svg>
                            <span className="text-label font-semibold text-danger grow">Log ud</span>
                            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-danger/50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            data-testid="settings-delete-account-open-button"
                            onClick={handleOpenDeleteAccount}
                            className="w-full flex items-center gap-3 px-4 py-3 min-h-11 text-left hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark transition-colors duration-150"
                        >
                            <XIcon className="w-5 h-5 text-danger shrink-0" />
                            <span className="min-w-0 grow">
                                <span className="block text-label font-semibold text-danger">Slet min konto</span>
                                <span className="block text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">Permanent og kan ikke fortrydes</span>
                            </span>
                            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-danger/50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </button>
                    </Card>
                    <p className="text-center text-caption text-text-secondary dark:text-text-dark-secondary mt-2">
                        v{__APP_VERSION__}
                    </p>
                </section>
            </div>

            {isEditProfileOpen && user && (
                <EditProfileModal
                    initialName={user.name}
                    initialInitials={user.initials}
                    initialEmail={user.email ?? ''}
                    initialJobTitle={user.jobTitle}
                    initialCompanyName={user.companyName}
                    initialCvr={user.cvr}
                    initialAddress={user.address}
                    initialPhone={user.phone}
                    onClose={() => setIsEditProfileOpen(false)}
                    onSave={handleUpdateProfile}
                />
            )}

            {isMfaOpen && (
                <MfaEnrollModal onClose={() => setIsMfaOpen(false)} />
            )}

            {isSubscriptionOpen && (
                <SubscriptionModal
                    preselectTier={preselectTier}
                    onClose={() => { setIsSubscriptionOpen(false); setPreselectTier(null); }}
                />
            )}

            <Modal
                open={isSmtpModalOpen}
                onClose={() => setIsSmtpModalOpen(false)}
                title="E-mail (SMTP)"
                footer={<Button variant="secondary" fullWidth onClick={() => setIsSmtpModalOpen(false)}>Luk</Button>}
            >
                <div className="space-y-4">
                    <p className="text-body text-text-secondary dark:text-text-dark-secondary">
                        Som abonnementsejer kan du angive din egen SMTP-server til udgående e-mails (fx overdragelsesrapporter). Hvis felterne er tomme, bruges systemets standard SMTP-server.
                    </p>
                    <SmtpForm
                        scope="custom"
                        config={smtpConfig}
                        loading={smtpLoading}
                        loadError={smtpLoadError}
                        onRetryLoad={loadSmtpConfig}
                        saving={smtpSaving}
                        testing={smtpTesting}
                        sendingTest={smtpSendingTest}
                        saveResult={smtpSaveResult}
                        testResult={smtpTestResult}
                        sendTestResult={smtpSendTestResult}
                        onSave={handleSaveSmtp}
                        onTestConnection={handleTestSmtp}
                        onSendTestEmail={handleSendTestSmtp}
                    />
                </div>
            </Modal>

            <Modal
                open={isDeleteModalOpen}
                onClose={() => !isDeletingAccount && setIsDeleteModalOpen(false)}
                title="Slet konto permanent"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={isDeletingAccount}
                        >
                            Annuller
                        </Button>
                        <Button
                            variant="danger"
                            data-testid="settings-delete-account-confirm-button"
                            onClick={handleDeleteAccount}
                            loading={isDeletingAccount}
                            disabled={deleteConfirmation.trim().toUpperCase() !== 'SLET'}
                        >
                            {isDeletingAccount ? 'Sletter…' : 'Slet konto'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Alert variant="danger" title="Dette kan ikke fortrydes">
                        Dette sletter din konto permanent. Egne projekter og data bliver fjernet, aktive Stripe-abonnementer bliver annulleret, og handlingen kan ikke fortrydes.
                    </Alert>
                    <div>
                        <p className="text-label text-text-secondary dark:text-text-dark-secondary mb-2">
                            Skriv <span className="font-bold">SLET</span> for at bekræfte:
                        </p>
                        <Input
                            data-testid="settings-delete-account-input"
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            placeholder="SLET"
                            autoComplete="off"
                            autoFocus
                        />
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                isOpen={showLogoutConfirm}
                title="Log ud"
                message="Er du sikker på, at du vil logge ud?"
                confirmLabel="Log ud"
                onConfirm={() => { logout(); navigate('/login'); }}
                onCancel={() => setShowLogoutConfirm(false)}
            />
        </AppScreen>
    );
};

export default SettingsPage;
