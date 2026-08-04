import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '../icons';
import { Notification } from '../../types';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthProvider';
import { Modal, Button, EmptyState, cn } from '../ui';

/**
 * Notification center: bell with unread badge opening a kit Modal
 * (bottom sheet on mobile). Notifications grouped as "Nye" / "Tidligere";
 * team invites are actionable inline (Accepter / Afvis).
 */
export const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [messageModal, setMessageModal] = useState<Notification | null>(null);
    const [inviteActionInProgress, setInviteActionInProgress] = useState<string | null>(null);
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const fetchNotifications = async () => {
        const data = await getNotifications();
        setNotifications(data);
    };

    useEffect(() => {
        fetchNotifications();

        const channel = supabase
            .channel('notifications:bell')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user?.id}`,
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    const handleNotificationClick = async (notification: Notification) => {
        if (notification.type === 'team_invite') {
            // Navigate to the dedicated invite page instead of generic link
            setIsOpen(false);
            if (!notification.isRead) {
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
                await markNotificationAsRead(notification.id);
            }
            navigate('/team-invite');
            return;
        }
        setIsOpen(false);
        if (!notification.isRead) {
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
            await markNotificationAsRead(notification.id);
        }

        // Message notifications (chat mentions) open the message in a modal
        // rather than navigating away — the user can then jump to the full
        // conversation from there.
        if (notification.type === 'task_chat_mention') {
            setMessageModal(notification);
            return;
        }

        navigate(notification.link.startsWith('#') ? notification.link.substring(1) : notification.link);
    };

    const openConversation = (notification: Notification) => {
        const taskId = (notification.metadata?.task_id as string | undefined)
            ?? notification.link.replace(/^#?\/?/, '').replace(/^task\//, '').split('?')[0];
        setMessageModal(null);
        if (taskId) navigate(`/task/${taskId}?tab=chat`);
    };

    const handleInviteAccept = async (notification: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        const seatId = notification.metadata?.seat_id as string | undefined;
        if (!seatId || inviteActionInProgress) return;
        setInviteActionInProgress(seatId);
        try {
            const { error } = await (supabase as any).rpc('accept_team_invite', { p_seat_id: seatId });
            if (error) throw error;
            if (refreshUser) await refreshUser();
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
            await markNotificationAsRead(notification.id);
            setIsOpen(false);
            navigate('/team');
        } catch (err) {
            console.error('accept_team_invite error:', err);
        } finally {
            setInviteActionInProgress(null);
        }
    };

    const handleInviteDecline = async (notification: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        const seatId = notification.metadata?.seat_id as string | undefined;
        if (!seatId || inviteActionInProgress) return;
        setInviteActionInProgress(seatId);
        try {
            const { error } = await (supabase as any).rpc('decline_team_invite', { p_seat_id: seatId });
            if (error) throw error;
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
            await markNotificationAsRead(notification.id);
        } catch (err) {
            console.error('decline_team_invite error:', err);
        } finally {
            setInviteActionInProgress(null);
        }
    };

    const handleMarkAllAsRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        await markAllNotificationsAsRead();
    };

    const rowClasses = (n: Notification) =>
        cn(
            'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast',
            !n.isRead
                ? 'bg-brand-subtle/60 hover:bg-brand-subtle dark:bg-brand-subtle-dark/60 dark:hover:bg-brand-subtle-dark'
                : 'hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50'
        );

    const rowDot = (n: Notification) => (
        <span className="shrink-0 mt-2" aria-hidden="true">
            <span className={cn('block w-2 h-2 rounded-full', !n.isRead ? 'bg-brand-primary' : 'bg-transparent')} />
        </span>
    );

    const rowText = (n: Notification) => (
        <>
            <span
                className={cn(
                    'block text-label',
                    !n.isRead
                        ? 'font-semibold text-text-primary dark:text-text-dark-primary'
                        : 'text-text-secondary dark:text-text-dark-secondary'
                )}
            >
                {n.text}
            </span>
            <span className="block text-caption text-text-tertiary dark:text-text-dark-tertiary mt-1">{n.timestamp}</span>
        </>
    );

    const renderNotification = (n: Notification) => {
        if (n.type === 'team_invite') {
            // Invite rows keep the inline actions as real sibling buttons
            // (never nested inside another button).
            return (
                <div key={n.id} className={rowClasses(n)}>
                    {rowDot(n)}
                    <div className="min-w-0 grow">
                        <button type="button" onClick={() => handleNotificationClick(n)} className="block w-full text-left">
                            {rowText(n)}
                        </button>
                        <div className="flex gap-2 mt-2.5">
                            <Button
                                size="sm"
                                className="flex-1"
                                loading={inviteActionInProgress === (n.metadata?.seat_id as string)}
                                disabled={!!inviteActionInProgress}
                                onClick={e => handleInviteAccept(n, e)}
                            >
                                Accepter
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                disabled={!!inviteActionInProgress}
                                onClick={e => handleInviteDecline(n, e)}
                            >
                                Afvis
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <button key={n.id} type="button" onClick={() => handleNotificationClick(n)} className={rowClasses(n)}>
                {rowDot(n)}
                <span className="min-w-0 grow">{rowText(n)}</span>
            </button>
        );
    };

    const unread = notifications.filter(n => !n.isRead);
    const read = notifications.filter(n => n.isRead);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label={unreadCount > 0 ? `Notifikationer — ${unreadCount} ulæste` : 'Notifikationer'}
                className="relative flex w-10 h-10 items-center justify-center rounded-control border border-border bg-bg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors duration-fast dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:hover:text-text-dark-primary"
            >
                <BellIcon className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span
                        className="absolute -top-1 -right-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white border-2 border-bg-subtle dark:border-bg-dark"
                        aria-hidden="true"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            <Modal
                open={isOpen}
                onClose={() => setIsOpen(false)}
                title="Notifikationer"
                size="sm"
                className="sm:max-h-[80vh]"
            >
                <div className="-mx-5 -mt-1">
                    {notifications.length === 0 ? (
                        <EmptyState
                            icon={<BellIcon className="w-7 h-7" />}
                            title="Ingen notifikationer"
                            description="Du får besked her, når der sker noget i dine projekter."
                        />
                    ) : (
                        <>
                            {unread.length > 0 && (
                                <div className="flex items-center justify-between px-4 pb-1.5">
                                    <p className="text-caption font-bold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                                        Nye · {unread.length}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleMarkAllAsRead}
                                        className="text-caption font-semibold text-brand-primary hover:underline"
                                    >
                                        Marker alle som læst
                                    </button>
                                </div>
                            )}
                            <div className="divide-y divide-border dark:divide-border-dark">
                                {unread.map(renderNotification)}
                            </div>
                            {read.length > 0 && (
                                <>
                                    <p className="px-4 pt-4 pb-1.5 text-caption font-bold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                                        Tidligere
                                    </p>
                                    <div className="divide-y divide-border dark:divide-border-dark">
                                        {read.map(renderNotification)}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </Modal>

            {/* Message viewer — shows a chat-mention message inline. */}
            <Modal
                open={!!messageModal}
                onClose={() => setMessageModal(null)}
                title="Besked"
                size="sm"
            >
                {messageModal && (
                    <div className="space-y-4">
                        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">{messageModal.timestamp}</p>
                        <p className="text-body whitespace-pre-wrap break-words text-text-primary dark:text-text-dark-primary">
                            {messageModal.text}
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setMessageModal(null)}>Luk</Button>
                            <Button onClick={() => openConversation(messageModal)}>Åbn samtale</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};
