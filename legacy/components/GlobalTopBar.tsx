import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useMatch } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useChat } from '../modules/ai';
import { useModuleGate } from '../core/entitlements/ModuleGate';
import { Avatar, Badge } from './ui';
import { NotificationBell } from './dashboard/NotificationBell';
import OrgSwitcher from './org/OrgSwitcher';
import { SubscriptionModal } from './settings/SubscriptionModal';
import { ConnectionManagerModal } from './profile/ConnectionManagerModal';
import { InviteModal } from './InviteModal';
import { BuildingIcon, UsersIcon, SettingsIcon, SparklesIcon, LogOutIcon, BrainIcon, SendIcon } from './icons';

/**
 * Global top bar — profile menu, subscription (tier) badge and notification bell,
 * fixed to the top of the viewport on every in-app page (rendered by MainLayout).
 * Offset to the right of the desktop nav rail.
 */
const GlobalTopBar: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { tier } = useSubscription();
    const { isChatOpen, setChatOpen } = useChat();
    // The AI chat is project-scoped — only show its trigger inside a project.
    const inProject = !!useMatch('/project-detail/:id');
    const aiEnabled = useModuleGate('ai');

    const [menuOpen, setMenuOpen] = useState(false);
    const [subscriptionOpen, setSubscriptionOpen] = useState(false);
    const [connectionOpen, setConnectionOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const initials = user?.initials || user?.name?.slice(0, 2).toUpperCase() || 'XX';
    const itemClass = 'flex items-center gap-2 w-full min-h-11 p-3 text-label font-semibold text-text-primary dark:text-text-dark-primary text-left transition-colors hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50';

    const handleLogout = () => { setMenuOpen(false); logout(); navigate('/login'); };

    return (
        <>
            <header className="fixed top-0 inset-x-0 md:left-[88px] z-[90] min-h-12 pt-safe flex items-center justify-between gap-2 px-3 border-b border-border bg-bg dark:border-border-dark dark:bg-bg-dark-surface">
                {/* Profile avatar + menu, with Invite right next to it */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="relative shrink-0" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setMenuOpen(v => !v)}
                            className="flex items-center justify-center rounded-full"
                            title="Profil og indstillinger"
                            aria-label="Profil og indstillinger"
                            aria-haspopup="menu"
                        >
                            <Avatar name={user?.name || initials} size="sm" />
                        </button>
                        {menuOpen && (
                            <div className="absolute left-0 top-full mt-2 w-56 bg-bg dark:bg-bg-dark-surface rounded-card shadow-modal border border-border dark:border-border-dark z-50 animate-scale-in overflow-hidden" role="menu">
                                <div className="p-3 border-b border-border dark:border-border-dark">
                                    <p className="text-label font-bold text-text-primary dark:text-text-dark-primary truncate">{user?.name || 'Bruger'}</p>
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary truncate">@{user?.username}</p>
                                </div>
                                {user?.appRole === 'admin' && (
                                    <button type="button" role="menuitem" onClick={() => { navigate('/admin'); setMenuOpen(false); }} className={itemClass}>
                                        <BuildingIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" /> Admin Dashboard
                                    </button>
                                )}
                                <button type="button" role="menuitem" onClick={() => { setConnectionOpen(true); setMenuOpen(false); }} className={itemClass}>
                                    <UsersIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" /> Mit Netværk
                                </button>
                                <button type="button" role="menuitem" onClick={() => { navigate('/team'); setMenuOpen(false); }} className={itemClass}>
                                    <UsersIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" /> Team
                                </button>
                                <button type="button" role="menuitem" onClick={() => { navigate('/settings'); setMenuOpen(false); }} className={itemClass}>
                                    <SettingsIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" /> Indstillinger
                                </button>
                                <button type="button" role="menuitem" onClick={() => { setSubscriptionOpen(true); setMenuOpen(false); }} className={itemClass}>
                                    <SparklesIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" /> Abonnement
                                </button>
                                <button type="button" role="menuitem" onClick={handleLogout} className="flex items-center gap-2 w-full min-h-11 p-3 text-label font-semibold text-danger text-left transition-colors hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark">
                                    <LogOutIcon className="w-4 h-4" /> Log ud
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Invite a colleague to BygSmart */}
                    <button
                        type="button"
                        onClick={() => setInviteOpen(true)}
                        className="flex w-10 h-10 shrink-0 items-center justify-center rounded-control border border-border bg-bg text-brand-primary hover:bg-bg-subtle dark:border-border-dark dark:bg-bg-dark-surface dark:hover:bg-bg-dark-muted"
                        title="Invitér til BygSmart"
                        aria-label="Invitér til BygSmart"
                    >
                        <SendIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Active-org switcher — renders only with >1 membership */}
                <OrgSwitcher />

                {/* Tier badge · AI chat (in project) · notifications */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => setSubscriptionOpen(true)}
                        className="flex items-center px-0.5"
                        title="Se abonnementer"
                        aria-label="Se abonnementer"
                    >
                        <Badge variant="brand">{tier}</Badge>
                    </button>
                    {inProject && aiEnabled && (
                        <button
                            type="button"
                            onClick={() => setChatOpen(!isChatOpen)}
                            aria-label="AI-assistent"
                            aria-pressed={isChatOpen}
                            title="AI-assistent"
                            className={`flex flex-col w-10 h-10 items-center justify-center rounded-control border transition-colors ${
                                isChatOpen
                                    ? 'border-brand-border bg-brand-subtle text-brand-primary dark:border-brand-border-dark dark:bg-brand-subtle-dark'
                                    : 'border-border bg-bg text-brand-primary hover:bg-bg-subtle dark:border-border-dark dark:bg-bg-dark-surface dark:hover:bg-bg-dark-muted'
                            }`}
                        >
                            <BrainIcon className="w-4 h-4" />
                            <span className="text-[8px] font-extrabold leading-none tracking-wide mt-0.5">AI</span>
                        </button>
                    )}
                    <NotificationBell />
                </div>
            </header>

            {connectionOpen && <ConnectionManagerModal onClose={() => setConnectionOpen(false)} />}
            {subscriptionOpen && <SubscriptionModal onClose={() => setSubscriptionOpen(false)} />}
            {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
        </>
    );
};

export default GlobalTopBar;
