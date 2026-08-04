import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PartnerInvite, PartnerNegotiationMessage } from '../../../types';
import {
    acceptInvite, cancelInvite, declineInvite, formatOre, kronerToOre,
    listNegotiationMessages, sendNegotiationMessage, subscribeToNegotiation,
    uploadNegotiationAttachment, NEGOTIATION_ATTACHMENT_ACCEPT,
} from '../services/partners';
import { Badge, Button, Input, Skeleton, cn } from '../../../components/ui';
import { SendIcon, InfoIcon, PaperclipIcon, FileIcon, XIcon } from '../../../components/icons';
import { OPEN_STATUSES, PARTNER_STATUS_META, formatDateTimeDa } from './partnerStatus';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { resolveFileUrl } from '../../../utils/fileUtils';

interface NegotiationThreadProps {
    invite: PartnerInvite;
    /** Called when the invitation changes (accept/decline/realtime update). */
    onInviteUpdated?: (invite: PartnerInvite) => void;
    className?: string;
}

const OFFER_KINDS = ['offer', 'counter_offer'] as const;

/** Fullscreen image lightbox — click anywhere to close. Portaled above the modal. */
const ImageLightbox: React.FC<{ url: string; alt: string; onClose: () => void }> = ({ url, alt, onClose }) => {
    return createPortal(
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 animate-fade-in cursor-zoom-out"
            onClick={onClose}
            role="button"
            tabIndex={0}
            aria-label="Luk billede"
        >
            <img
                src={url}
                alt={alt}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                onClick={onClose}
            />
        </div>,
        document.body
    );
};

/** Renders a message attachment: inline image thumbnail (opens a lightbox) or a file chip. */
const AttachmentPreview: React.FC<{ path?: string; name?: string; type?: string; mine?: boolean }> = ({ path, name, type, mine }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    useEffect(() => {
        let active = true;
        if (path) resolveFileUrl(path).then(u => { if (active) setUrl(u); }).catch(() => undefined);
        return () => { active = false; };
    }, [path]);

    if (!path) return null;
    const isImage = (type ?? '').startsWith('image/');

    if (isImage) {
        if (!url) {
            return <div className="mt-2 h-28 w-40 animate-pulse rounded-lg bg-bg-muted dark:bg-bg-dark-muted" />;
        }
        return (
            <>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                    className="mt-2 block rounded-lg overflow-hidden cursor-zoom-in"
                    aria-label="Åbn billede i fuld skærm"
                >
                    <img src={url} alt={name ?? 'Vedhæftning'} className="max-h-52 max-w-full rounded-lg border border-border dark:border-border-dark object-cover" />
                </button>
                {lightboxOpen && <ImageLightbox url={url} alt={name ?? 'Vedhæftning'} onClose={() => setLightboxOpen(false)} />}
            </>
        );
    }

    // Non-image files (PDF / Word / Excel): open in a new tab without disturbing
    // the negotiation modal. stopPropagation keeps the click off the card/modal.
    return (
        <a
            href={url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            download={name}
            onClick={(e) => e.stopPropagation()}
            className={cn(
                'mt-2 flex items-center gap-2 rounded-lg border p-2 text-label transition-colors',
                mine ? 'border-white/30 hover:bg-white/10' : 'border-border dark:border-border-dark hover:bg-bg-muted dark:hover:bg-bg-dark-muted',
                !url && 'pointer-events-none opacity-70'
            )}
        >
            <FileIcon className="w-5 h-5 shrink-0" />
            <span className="truncate">{name ?? 'Vedhæftet fil'}</span>
        </a>
    );
};

/**
 * Chat thread for a partner invitation: messages and offers/counter-offers
 * rendered distinctly, with accept/decline actions per role and live updates
 * via Supabase Realtime. Settled state shows the agreed price prominently.
 */
export const NegotiationThread: React.FC<NegotiationThreadProps> = ({
    invite: inviteProp,
    onInviteUpdated,
    className,
}) => {
    const { user } = useAuth();
    const { showToast, showMessageBanner } = useToast();

    const [invite, setInvite] = useState<PartnerInvite>(inviteProp);
    const [messages, setMessages] = useState<PartnerNegotiationMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [amountKr, setAmountKr] = useState('');
    const [sending, setSending] = useState(false);
    const [acting, setActing] = useState(false);
    /** Offer awaiting my reply: the amount composer hides behind "Nyt modtilbud". */
    const [showOfferInput, setShowOfferInput] = useState(false);
    /** Info panel (summary + negotiation ID) toggle. */
    const [showInfo, setShowInfo] = useState(false);
    /** File selected in the composer, pending send. */
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const endRef = useRef<HTMLDivElement>(null);

    const isPartner = user?.id === invite.partnerId;
    const isOpen = OPEN_STATUSES.includes(invite.status);
    const statusMeta = PARTNER_STATUS_META[invite.status];

    // Keep local invite in sync if the parent passes a fresh one
    useEffect(() => { setInvite(inviteProp); }, [inviteProp]);

    const applyInviteUpdate = useCallback((updated: PartnerInvite) => {
        setInvite(prev => ({ ...prev, ...updated, partnerName: prev.partnerName ?? updated.partnerName, projectName: prev.projectName ?? updated.projectName }));
        onInviteUpdated?.(updated);
    }, [onInviteUpdated]);

    // Initial load
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        listNegotiationMessages(invite.id)
            .then(loaded => { if (!cancelled) setMessages(loaded); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [invite.id]);

    // Realtime updates
    useEffect(() => {
        const unsubscribe = subscribeToNegotiation(invite.id, event => {
            if (event.type === 'message' && event.message) {
                const incoming = event.message;
                if (incoming.senderId !== user?.id) {
                    const senderName = isPartner
                        ? (invite.inviterName ?? 'Afsender')
                        : (invite.partnerName ?? 'Partner');
                    const preview = incoming.body
                        ? incoming.body.slice(0, 80)
                        : 'Nyt tilbud modtaget';
                    showMessageBanner(senderName, preview);
                }
                setMessages(prev => (prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]));
            } else if (event.type === 'invite_updated' && event.invite) {
                applyInviteUpdate(event.invite);
            }
        });
        return unsubscribe;
    }, [invite.id, applyInviteUpdate, user?.id, isPartner, invite.inviterName, invite.partnerName, showMessageBanner]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (messages.length > 0) {
            const timer = setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            return () => clearTimeout(timer);
        }
    }, [messages.length]);

    const latestOffer = useMemo(
        () => [...messages].reverse().find(m => (OFFER_KINDS as readonly string[]).includes(m.kind) && m.amountOre !== null),
        [messages]
    );
    const canAccept = isOpen && !!latestOffer && latestOffer.senderId !== user?.id;

    const appendOptimistic = (message: PartnerNegotiationMessage, tempId: string) => {
        setMessages(prev => prev.map(m => (m.id === tempId ? message : m)));
    };

    const removeOptimistic = (tempId: string) => {
        setMessages(prev => prev.filter(m => m.id !== tempId));
    };

    const handleSendMessage = async () => {
        if ((!text.trim() && !pendingFile) || !user || sending) return;
        const body = text.trim();
        const file = pendingFile;
        const tempId = `temp-${Date.now()}`;
        setSending(true);
        setText('');
        setPendingFile(null);
        setMessages(prev => [...prev, {
            id: tempId,
            partnerInviteId: invite.id,
            senderId: user.id,
            kind: 'message',
            body,
            amountOre: null,
            createdAt: new Date().toISOString(),
            attachmentName: file?.name,
            attachmentType: file?.type,
        }]);
        try {
            const attachment = file ? await uploadNegotiationAttachment(invite.id, file) : undefined;
            const saved = await sendNegotiationMessage(invite.id, 'message', body, undefined, attachment);
            appendOptimistic(saved, tempId);
        } catch (err) {
            removeOptimistic(tempId);
            setText(body);
            setPendingFile(file);
            showToast(err instanceof Error ? err.message : 'Beskeden kunne ikke sendes. Prøv igen.', 'error');
        } finally {
            setSending(false);
        }
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        // Reset the input so selecting the same file again re-triggers change.
        e.target.value = '';
        if (!file) return;
        setPendingFile(file);
    };

    const handleSendOffer = async () => {
        const amountOre = kronerToOre(amountKr);
        if (amountOre <= 0 || !user || sending) return;
        const kind = latestOffer && latestOffer.senderId !== user.id ? 'counter_offer' : 'offer';
        const body = text.trim();
        const tempId = `temp-${Date.now()}`;
        setSending(true);
        setAmountKr('');
        setText('');
        setMessages(prev => [...prev, {
            id: tempId,
            partnerInviteId: invite.id,
            senderId: user.id,
            kind,
            body,
            amountOre,
            createdAt: new Date().toISOString(),
        }]);
        try {
            const saved = await sendNegotiationMessage(invite.id, kind, body, amountOre);
            appendOptimistic(saved, tempId);
            setShowOfferInput(false);
        } catch {
            removeOptimistic(tempId);
            setAmountKr((amountOre / 100).toString());
            setText(body);
            showToast('Tilbuddet kunne ikke sendes. Prøv igen.', 'error');
        } finally {
            setSending(false);
        }
    };

    const handleAccept = async () => {
        if (!latestOffer || latestOffer.amountOre === null || acting) return;
        setActing(true);
        try {
            await acceptInvite(invite.id, latestOffer.amountOre);
            const updated: PartnerInvite = {
                ...invite,
                status: 'accepted',
                agreedPriceOre: latestOffer.amountOre,
                settledAt: new Date().toISOString(),
            };
            applyInviteUpdate(updated);
            showToast('Aftalen er indgået og prisen registreret.', 'success');
        } catch {
            showToast('Aftalen kunne ikke accepteres. Prøv igen.', 'error');
        } finally {
            setActing(false);
        }
    };

    const handleDeclineOrCancel = async () => {
        if (acting) return;
        setActing(true);
        try {
            if (isPartner) {
                await declineInvite(invite.id);
                applyInviteUpdate({ ...invite, status: 'declined' });
                showToast('Invitationen er afvist.', 'info');
            } else {
                await cancelInvite(invite.id);
                applyInviteUpdate({ ...invite, status: 'cancelled' });
                showToast('Invitationen er annulleret.', 'info');
            }
        } catch {
            showToast('Handlingen mislykkedes. Prøv igen.', 'error');
        } finally {
            setActing(false);
        }
    };

    const renderMessage = (message: PartnerNegotiationMessage) => {
        const mine = message.senderId === user?.id;
        const isOffer = (OFFER_KINDS as readonly string[]).includes(message.kind);

        // System events: accept / decline — centered timeline badges
        if (message.kind === 'accept' || message.kind === 'decline') {
            return (
                <div key={message.id} className="flex justify-center my-2">
                    <div className="text-center">
                        <Badge variant={message.kind === 'accept' ? 'success' : 'danger'} dot>
                            {message.kind === 'accept'
                                ? `Tilbud accepteret${message.amountOre !== null ? ` · ${formatOre(message.amountOre, invite.currency)}` : ''}`
                                : 'Invitation afvist'}
                        </Badge>
                        <p className="mt-1 text-caption text-text-tertiary dark:text-text-dark-tertiary">
                            {formatDateTimeDa(message.createdAt)}
                        </p>
                    </div>
                </div>
            );
        }

        // Offers / counter-offers — distinct amount cards in the timeline
        if (isOffer) {
            const isCounter = message.kind === 'counter_offer';
            const isAgreed = invite.status === 'accepted'
                && message.amountOre !== null
                && message.amountOre === invite.agreedPriceOre
                && message.id === latestOffer?.id;
            return (
                <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div
                        className={cn(
                            'max-w-[85%] w-full sm:w-auto sm:min-w-[240px] rounded-card border-2 p-3.5 shadow-card',
                            isAgreed
                                ? 'border-success-border dark:border-success/30 bg-success-subtle dark:bg-success-subtle-dark'
                                : isCounter
                                    ? 'border-warning-border dark:border-warning/30 bg-warning-subtle dark:bg-warning-subtle-dark'
                                    : 'border-brand-border dark:border-brand-border-dark bg-bg dark:bg-bg-dark-surface'
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <Badge variant={isAgreed ? 'success' : isCounter ? 'warning' : 'brand'}>
                                {isAgreed ? 'Accepteret' : isCounter ? 'Modtilbud' : 'Tilbud'}
                            </Badge>
                            <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary">
                                {formatDateTimeDa(message.createdAt)}
                            </span>
                        </div>
                        <p className="mt-1.5 text-title text-text-primary dark:text-text-dark-primary">
                            {formatOre(message.amountOre, invite.currency)}
                        </p>
                        {message.body && (
                            <p className="mt-1 text-label text-text-secondary dark:text-text-dark-secondary whitespace-pre-wrap break-words">
                                {message.body}
                            </p>
                        )}
                    </div>
                </div>
            );
        }

        // Plain messages — chat bubbles
        return (
            <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                    className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2.5',
                        mine
                            ? 'bg-brand-primary text-white rounded-br-md'
                            : 'bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark text-text-primary dark:text-text-dark-primary rounded-bl-md'
                    )}
                >
                    {message.body && (
                        <p className="text-body whitespace-pre-wrap break-words">{message.body}</p>
                    )}
                    <AttachmentPreview
                        path={message.attachmentPath}
                        name={message.attachmentName}
                        type={message.attachmentType}
                        mine={mine}
                    />
                    <p
                        className={cn(
                            'mt-1 text-caption',
                            mine ? 'text-white/70' : 'text-text-tertiary dark:text-text-dark-tertiary'
                        )}
                    >
                        {formatDateTimeDa(message.createdAt)}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className={cn('flex flex-col', className)}>
            {/* Status header */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border dark:border-border-dark">
                <div className="min-w-0">
                    <p className="text-body font-semibold text-text-primary dark:text-text-dark-primary truncate">
                        {isPartner
                            ? (invite.projectName ?? 'Forhandling')
                            : (invite.partnerName ?? 'Partner')}
                    </p>
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">
                        {isPartner && invite.inviterName ? `Inviteret af ${invite.inviterName}` : 'Forhandlingstråd'}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusMeta.variant} dot>{statusMeta.label}</Badge>
                    <button
                        type="button"
                        onClick={() => setShowInfo(v => !v)}
                        aria-label="Vis oplysninger om forhandlingen"
                        aria-expanded={showInfo}
                        className={cn(
                            'flex w-9 h-9 items-center justify-center rounded-full border transition-colors',
                            showInfo
                                ? 'border-brand-border bg-brand-subtle text-brand-primary dark:border-brand-border-dark dark:bg-brand-subtle-dark'
                                : 'border-border text-text-secondary hover:text-text-primary hover:bg-bg-subtle dark:border-border-dark dark:text-text-dark-secondary dark:hover:text-text-dark-primary'
                        )}
                    >
                        <InfoIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Info panel: summary stats + the negotiation's ID. */}
            {showInfo && (
                <div className="mt-3 rounded-card border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted/40 p-3.5">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-caption">
                        <div className="col-span-2">
                            <dt className="text-text-tertiary dark:text-text-dark-tertiary">Forhandlings-ID</dt>
                            <dd className="mt-0.5 flex items-center gap-2">
                                <code className="font-mono text-label break-all select-all text-text-primary dark:text-text-dark-primary">{invite.id}</code>
                                <button
                                    type="button"
                                    onClick={() => { navigator.clipboard?.writeText(invite.id).then(() => showToast('ID kopieret.', 'success')).catch(() => undefined); }}
                                    className="shrink-0 text-brand-primary hover:underline text-caption font-semibold"
                                >
                                    Kopiér
                                </button>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-text-tertiary dark:text-text-dark-tertiary">Status</dt>
                            <dd className="mt-0.5 font-medium text-text-primary dark:text-text-dark-primary">{statusMeta.label}</dd>
                        </div>
                        <div>
                            <dt className="text-text-tertiary dark:text-text-dark-tertiary">Beskeder</dt>
                            <dd className="mt-0.5 font-medium text-text-primary dark:text-text-dark-primary">{messages.length}</dd>
                        </div>
                        {invite.projectName && (
                            <div>
                                <dt className="text-text-tertiary dark:text-text-dark-tertiary">Projekt</dt>
                                <dd className="mt-0.5 font-medium text-text-primary dark:text-text-dark-primary truncate">{invite.projectName}</dd>
                            </div>
                        )}
                        {invite.taskCount !== undefined && (
                            <div>
                                <dt className="text-text-tertiary dark:text-text-dark-tertiary">Opgaver</dt>
                                <dd className="mt-0.5 font-medium text-text-primary dark:text-text-dark-primary">{invite.taskCount}</dd>
                            </div>
                        )}
                        {(invite.inviterName || invite.partnerName) && (
                            <div className="col-span-2">
                                <dt className="text-text-tertiary dark:text-text-dark-tertiary">Parter</dt>
                                <dd className="mt-0.5 font-medium text-text-primary dark:text-text-dark-primary">
                                    {(invite.inviterName ?? 'Bygherre')} · {(invite.partnerName ?? 'Underleverandør')}
                                </dd>
                            </div>
                        )}
                        <div>
                            <dt className="text-text-tertiary dark:text-text-dark-tertiary">Oprettet</dt>
                            <dd className="mt-0.5 font-medium text-text-primary dark:text-text-dark-primary">{formatDateTimeDa(invite.createdAt)}</dd>
                        </div>
                        {invite.agreedPriceOre !== null && (
                            <div>
                                <dt className="text-text-tertiary dark:text-text-dark-tertiary">Aftalt pris</dt>
                                <dd className="mt-0.5 font-semibold text-success-strong dark:text-success">{formatOre(invite.agreedPriceOre, invite.currency)}</dd>
                            </div>
                        )}
                    </dl>
                </div>
            )}

            {/* Settled banner */}
            {invite.status === 'accepted' && invite.agreedPriceOre !== null && (
                <div
                    role="status"
                    className="mt-3 rounded-card border border-success-border dark:border-success/30 bg-success-subtle dark:bg-success-subtle-dark p-4 text-center"
                >
                    <p className="text-caption font-semibold uppercase tracking-wide text-success-strong dark:text-success">Aftale indgået</p>
                    <p className="mt-1 text-title text-success-strong dark:text-success">
                        {formatOre(invite.agreedPriceOre, invite.currency)}
                    </p>
                    {invite.settledAt && (
                        <p className="mt-0.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                            Afsluttet {formatDateTimeDa(invite.settledAt)}
                        </p>
                    )}
                </div>
            )}

            {/* Messages */}
            <div className="grow min-h-[180px] max-h-[45vh] overflow-y-auto py-3 space-y-2.5" aria-live="polite">
                {loading ? (
                    <div className="space-y-2.5">
                        <Skeleton className="h-14 w-3/4" />
                        <Skeleton className="h-14 w-2/3 ml-auto" />
                        <Skeleton className="h-14 w-3/5" />
                    </div>
                ) : messages.length === 0 ? (
                    <p className="text-label text-text-tertiary dark:text-text-dark-tertiary text-center py-6">
                        Ingen beskeder endnu. Start forhandlingen herunder.
                    </p>
                ) : (
                    <>
                        {messages.map(renderMessage)}
                        {isOpen && latestOffer && (
                            <div className="flex justify-center pt-1">
                                <Badge>
                                    {canAccept ? 'Afventer dit svar' : 'Afventer svar fra modparten'}
                                </Badge>
                            </div>
                        )}
                    </>
                )}
                <div ref={endRef} />
            </div>

            {/* Composer */}
            {isOpen ? (
                <div className="pt-3 border-t border-border dark:border-border-dark space-y-2.5">
                    {/* Quick actions — an offer awaits my reply */}
                    {canAccept && latestOffer && (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="primary"
                                loading={acting}
                                onClick={handleAccept}
                                className="grow"
                            >
                                Accepter {formatOre(latestOffer.amountOre, invite.currency)}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowOfferInput(prev => !prev)}
                                aria-expanded={showOfferInput}
                            >
                                Nyt modtilbud
                            </Button>
                            <Button
                                variant="ghost"
                                loading={acting}
                                onClick={handleDeclineOrCancel}
                                className="text-danger hover:text-danger"
                            >
                                {isPartner ? 'Afvis' : 'Annuller'}
                            </Button>
                        </div>
                    )}

                    {/* Amount composer — always available when no offer awaits; behind "Nyt modtilbud" otherwise */}
                    {(!canAccept || showOfferInput) && (
                        <div className="flex items-end gap-2">
                            <Input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={amountKr}
                                onChange={e => setAmountKr(e.target.value)}
                                placeholder="Beløb i DKK"
                                aria-label="Tilbudsbeløb i DKK"
                                className="grow"
                            />
                            <Button
                                variant="outline"
                                onClick={handleSendOffer}
                                disabled={kronerToOre(amountKr) <= 0 || sending}
                            >
                                {canAccept ? 'Send modtilbud' : 'Afgiv tilbud'}
                            </Button>
                        </div>
                    )}

                    {/* Selected-attachment chip (before sending) */}
                    {pendingFile && (
                        <div className="flex items-center gap-2 rounded-lg border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted/40 px-2.5 py-2">
                            <FileIcon className="w-4 h-4 shrink-0 text-text-secondary dark:text-text-dark-secondary" />
                            <span className="grow truncate text-label text-text-primary dark:text-text-dark-primary">{pendingFile.name}</span>
                            <button
                                type="button"
                                onClick={() => setPendingFile(null)}
                                aria-label="Fjern vedhæftning"
                                className="shrink-0 text-text-tertiary hover:text-danger transition-colors"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Message composer — attach + input + 44px send icon-button */}
                    <div className="flex items-end gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={NEGOTIATION_ATTACHMENT_ACCEPT}
                            aria-label="Vedhæft fil"
                            className="hidden"
                            onChange={handleFileSelected}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={sending}
                            aria-label="Vedhæft fil (billede, PDF, Word, Excel)"
                            title="Vedhæft fil"
                            className="w-11 px-0 shrink-0"
                            iconLeft={<PaperclipIcon className="w-5 h-5" />}
                        />
                        <Input
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder="Skriv en besked…"
                            aria-label="Besked"
                            className="grow"
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={(!text.trim() && !pendingFile) || sending}
                            loading={sending && !amountKr}
                            aria-label="Send besked"
                            className="w-11 px-0 shrink-0"
                            iconLeft={<SendIcon className="w-5 h-5" />}
                        />
                    </div>

                    {!canAccept && (
                        <Button variant="danger" fullWidth onClick={handleDeclineOrCancel} loading={acting}>
                            {isPartner ? 'Afvis invitation' : 'Annuller invitation'}
                        </Button>
                    )}
                </div>
            ) : invite.status !== 'accepted' ? (
                <p className="pt-3 border-t border-border dark:border-border-dark text-label text-text-tertiary dark:text-text-dark-tertiary text-center">
                    Forhandlingen er lukket ({statusMeta.label.toLowerCase()}).
                </p>
            ) : null}
        </div>
    );
};

export default NegotiationThread;
