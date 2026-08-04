import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getRegulationById } from '../services/regulations';
import type { Regulation } from '../../../types';
import { MoreVerticalIcon, CopyIcon, ChevronDownIcon, SendIcon } from '../../../components/icons';
import { generateRegulationExplanation, verifyRegulationExplanation, QuotaExceededError } from '../../ai';
import { AiExplanationSection, AIState } from '../components/AiExplanationSection';
import { ModuleGate } from '../../../core/entitlements/ModuleGate';
import DOMPurify from 'dompurify';
import { useToast } from '../../../contexts/ToastContext';
import { AppScreen, Alert, Badge, Button, Card, EmptyState, Input, Modal, SkeletonList, cn } from '../../../components/ui';

const RegulationDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [regulation, setRegulation] = useState<Regulation | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFullTextOpen, setIsFullTextOpen] = useState(false);
    const [isAiExplanationOpen, setIsAiExplanationOpen] = useState(false);

    // AI Content State
    const [aiState, setAiState] = useState<AIState | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [checkedAiItems, setCheckedAiItems] = useState<Set<number>>(new Set());

    const { showToast } = useToast();

    // Share Modal State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareEmail, setShareEmail] = useState('');

    useEffect(() => {
        const fetchRegulation = async () => {
            if (id) {
                setLoading(true);
                const data = await getRegulationById(id);
                setRegulation(data || null);
                setLoading(false);

                // Check for cached AI content
                const cachedAi = localStorage.getItem(`bygSmart-ai-explanation-${id}`);
                if (cachedAi) {
                    try {
                        setAiState(JSON.parse(cachedAi));
                    } catch (e) {
                        console.error("Failed to parse cached AI content", e);
                        localStorage.removeItem(`bygSmart-ai-explanation-${id}`);
                    }
                }
            }
        };
        fetchRegulation();
    }, [id]);

    useEffect(() => {
        if (isAiExplanationOpen && !aiState && regulation) {
            const fetchAiExplanation = async () => {
                setIsAiLoading(true);
                setAiError(null);
                try {
                    const content = await generateRegulationExplanation(regulation.title, regulation.snippet, regulation.body_html);
                    const newState = { content };
                    setAiState(newState);
                    localStorage.setItem(`bygSmart-ai-explanation-${regulation.id}`, JSON.stringify(newState));
                } catch (error) {
                    console.error("Failed to generate AI explanation:", error);
                    if (error instanceof QuotaExceededError) {
                        showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
                        setAiError("Du har nået din daglige AI-grænse. Opgrader for mere.");
                    } else {
                        setAiError("Kunne ikke generere AI-forklaring. Prøv igen.");
                    }
                } finally {
                    setIsAiLoading(false);
                }
            };
            fetchAiExplanation();
        }
    }, [isAiExplanationOpen, aiState, regulation]);

    const handleToggleAiCheckItem = (index: number) => {
        setCheckedAiItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleCopy = (text: string, subject: string) => {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`${subject} kopieret til udklipsholder!`, 'success');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Kunne ikke kopiere.', 'error');
        });
    };

    const handleVerifyExplanation = async () => {
        if (!regulation || !aiState?.content) return;
        setIsVerifying(true);
        try {
            const verificationResult = await verifyRegulationExplanation(regulation, aiState.content);
            if (verificationResult.is_correct) {
                const verificationDate = new Date().toLocaleDateString('da-DK');
                const newState = {
                    ...aiState,
                    verification: { date: verificationDate }
                };
                setAiState(newState);
                localStorage.setItem(`bygSmart-ai-explanation-${regulation.id}`, JSON.stringify(newState));
                showToast('AI Check succesfuld!', 'success');
            } else {
                setAiError(`AI Check fandt uoverensstemmelser: ${verificationResult.reasoning}`);
                showToast('AI Check fandt uoverensstemmelser.', 'warning');
            }
        } catch (error) {
            console.error("Verification failed:", error);
            if (error instanceof QuotaExceededError) {
                showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
            } else {
                showToast("AI Check kunne ikke gennemføres.", 'error');
            }
        } finally {
            setIsVerifying(false);
        }
    };

    // --- Helper functions for copying ---
    const htmlToText = (html: string) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = DOMPurify.sanitize(html);
        return tempDiv.textContent || tempDiv.innerText || '';
    };

    const formatCitationForCopy = (reg: Regulation) => {
        return `Kilde: Bygningsreglementet 2018\nKapitel: ${reg.chapter}\nTitel: ${reg.title}\nVersion: ${reg.version}\nLink: ${reg.source_url}`;
    };

    const formatContentForEmail = () => {
        if (!regulation) return '';
        let body = `Regulering: ${regulation.title}\n\n`;
        body += `Hovedpunkt:\n${regulation.snippet}\n\n`;
        body += `Fuld Tekst:\n${htmlToText(regulation.body_html.replace(/<span.*?<\/span>/g, ''))}\n\n`;
        body += `Kilde:\nBygningsreglementet 2018\nKapitel: ${regulation.chapter}\nVersion: ${regulation.version}\nLink: ${regulation.source_url}`;
        return body;
    }

    const handleSendShareEmail = () => {
        if (!regulation || !shareEmail) return;
        const subject = `Delt fra BYG SMART: ${regulation.title}`;
        const body = formatContentForEmail();
        window.location.href = `mailto:${shareEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setIsShareModalOpen(false);
        setShareEmail('');
    };

    /** 44px icon-button for the copy affordances on each card. */
    const CopyButton: React.FC<{ onCopy: () => string; subject: string; className?: string }> = ({ onCopy, subject, className }) => (
        <button
            type="button"
            onClick={() => handleCopy(onCopy(), subject)}
            aria-label={`Kopier ${subject}`}
            className={cn(
                'shrink-0 inline-flex w-11 h-11 items-center justify-center rounded-control',
                'text-text-tertiary hover:text-text-primary hover:bg-bg-muted',
                'dark:text-text-dark-tertiary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted',
                'transition-colors duration-150',
                className
            )}
        >
            <CopyIcon className="w-5 h-5" aria-hidden="true" />
        </button>
    );

    if (loading) {
        return (
            <AppScreen width="reading" hasBottomNav={false} header={{ title: 'Regulering', back: true }}>
                <SkeletonList count={3} label="Indlæser regulering…" />
            </AppScreen>
        );
    }

    if (!regulation) {
        return (
            <AppScreen width="reading" hasBottomNav={false} header={{ title: 'Regulering', back: true }}>
                <Card padding="none">
                    <EmptyState
                        title="Regulering ikke fundet"
                        description="Reguleringen findes ikke eller er blevet fjernet."
                    />
                </Card>
            </AppScreen>
        );
    }

    return (
        <AppScreen
            width="reading"
            hasBottomNav={false}
            header={{
                title: regulation.chapter,
                back: true,
                actions: (
                    <button
                        type="button"
                        aria-label="Del regulering"
                        data-ref-id="regulation-more-options-button"
                        onClick={() => setIsShareModalOpen(true)}
                        className="shrink-0 flex w-10 h-10 items-center justify-center rounded-control border border-border bg-bg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors duration-150 dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:hover:text-text-dark-primary"
                    >
                        <MoreVerticalIcon className="w-5 h-5" aria-hidden="true" />
                    </button>
                ),
            }}
        >
            <article className="mt-2 space-y-5">
                {/* § reference */}
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="brand">{regulation.chapter}</Badge>
                    <Badge>{regulation.section_ref}</Badge>
                </div>

                <h2 className="text-title text-text-primary dark:text-text-dark-primary" data-ref-id="regulation-title">
                    {regulation.title}
                </h2>

                <Alert
                    variant="info"
                    title="Hovedpunkt"
                    data-ref-id="regulation-main-point"
                    action={<CopyButton onCopy={() => regulation.snippet} subject="Hovedpunkt" className="-my-2 -mr-2" />}
                >
                    <span className="text-body">{regulation.snippet}</span>
                </Alert>

                <Card padding="none" data-ref-id="regulation-full-text-card">
                    <div className="flex items-center pr-2">
                        <button
                            type="button"
                            onClick={() => setIsFullTextOpen(!isFullTextOpen)}
                            aria-expanded={isFullTextOpen}
                            className="flex grow min-w-0 items-center justify-between gap-3 px-4 py-3 min-h-11 text-left"
                        >
                            <span className="text-label font-bold text-text-primary dark:text-text-dark-primary">Læs hele teksten</span>
                            <ChevronDownIcon
                                className={cn(
                                    'w-5 h-5 shrink-0 text-text-tertiary dark:text-text-dark-tertiary transition-transform duration-150',
                                    isFullTextOpen && 'rotate-180'
                                )}
                                aria-hidden="true"
                            />
                        </button>
                        <CopyButton onCopy={() => htmlToText(regulation.body_html)} subject="Fuld tekst" />
                    </div>
                    {isFullTextOpen && (
                        <div
                            className="px-4 pb-4 text-body text-text-secondary dark:text-text-dark-secondary prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(regulation.body_html) }}
                            data-ref-id="regulation-full-text-content"
                        />
                    )}
                </Card>

                <Card padding="md" data-ref-id="regulation-citation-card" className="relative">
                    <CopyButton
                        onCopy={() => formatCitationForCopy(regulation)}
                        subject="Citering"
                        className="absolute top-2 right-2"
                    />
                    <h3 className="text-label font-bold text-text-primary dark:text-text-dark-primary">Citering</h3>
                    <div className="grid grid-cols-3 gap-2 text-label mt-4">
                        <span className="text-text-secondary dark:text-text-dark-secondary">Kilde</span>
                        <span className="col-span-2 font-medium text-text-primary dark:text-text-dark-primary">Bygningsreglementet 2018</span>
                        <span className="text-text-secondary dark:text-text-dark-secondary">Kapitel</span>
                        <span className="col-span-2 font-medium text-text-primary dark:text-text-dark-primary">{regulation.chapter}</span>
                        <span className="text-text-secondary dark:text-text-dark-secondary">Version</span>
                        <span className="col-span-2 font-medium text-text-primary dark:text-text-dark-primary">{regulation.version}</span>
                        <span className="text-text-secondary dark:text-text-dark-secondary">Link</span>
                        <a
                            href={regulation.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="col-span-2 font-medium text-brand-primary dark:text-brand-light hover:underline truncate"
                        >
                            {regulation.source_url.replace('https://www.', '')}
                        </a>
                    </div>
                </Card>

                {/* "Forklar med AI" toggle + content is an embedded ai-module feature —
                    hide entirely when ai isn't entitled; the regulation content above
                    (full text, citation, share) works fully without it. */}
                <ModuleGate moduleId="ai" mode="hide">
                    <AiExplanationSection
                        isOpen={isAiExplanationOpen}
                        onToggle={() => setIsAiExplanationOpen(!isAiExplanationOpen)}
                        aiState={aiState}
                        isLoading={isAiLoading}
                        error={aiError}
                        isVerifying={isVerifying}
                        onVerify={handleVerifyExplanation}
                        checkedItems={checkedAiItems}
                        onToggleItem={handleToggleAiCheckItem}
                    />
                </ModuleGate>
            </article>

            <Modal
                open={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                title="Del Regulering"
                description="Indtast email for at dele denne regulering."
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsShareModalOpen(false)}>Annuller</Button>
                        <Button
                            iconLeft={<SendIcon className="w-4 h-4" aria-hidden="true" />}
                            onClick={handleSendShareEmail}
                            disabled={!shareEmail}
                        >
                            Send via Email
                        </Button>
                    </>
                }
            >
                <Input
                    type="email"
                    label="Modtagerens email"
                    value={shareEmail}
                    onChange={e => setShareEmail(e.target.value)}
                    placeholder="modtager@eksempel.dk"
                />
            </Modal>
        </AppScreen>
    );
};

export default RegulationDetailPage;
