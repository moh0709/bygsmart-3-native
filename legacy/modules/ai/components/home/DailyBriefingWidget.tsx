import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Project } from '../../../../types';
import { generateDailyBriefing, generateAdvancedBriefing, QuotaExceededError } from '../../services/gemini';
import AdvancedBriefingModal from '../AdvancedBriefingModal';
import { useAuth } from '../../../../contexts/AuthProvider';
import { useToast } from '../../../../contexts/ToastContext';
import { Button, Card, Skeleton, SkeletonText, cn } from '../../../../components/ui';
import { SparklesIcon, RefreshCwIcon } from '../../../../components/icons';
import { WeatherWidget } from '../../../../components/dashboard/WeatherWidget';
import { isCacheStale } from '../../../../components/dashboard/homeHelpers';

/**
 * "Dagens briefing" — AI briefing card with compact weather + Pro briefing
 * modal (formerly HomePage section 6, incl. its two cache effects).
 */
export const DailyBriefingWidget: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [briefing, setBriefing] = useState('');
    const [isBriefingLoading, setIsBriefingLoading] = useState(true);
    const [forceRefresh, setForceRefresh] = useState(0);
    const [briefingExpanded, setBriefingExpanded] = useState(false); // collapsed (clamped) by default
    const [activeProjects, setActiveProjects] = useState<Project[]>([]);

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [advancedContent, setAdvancedContent] = useState('');
    const [isGeneratingAdvanced, setIsGeneratingAdvanced] = useState(false);
    const [forceRefreshAdvanced, setForceRefreshAdvanced] = useState(0);

    // Active projects feed the weather strip. projects is the base module, so
    // this reverse edge stays dynamic (no module cycle).
    useEffect(() => {
        if (!user) return;
        let alive = true;
        import('../../../projects')
            .then((m) => m.getProjects(user.id))
            .then((projects) => { if (alive) setActiveProjects(projects.filter(p => p.status === 'I gang')); })
            .catch((e) => console.error('DailyBriefingWidget projects fetch failed:', e));
        return () => { alive = false; };
    }, [user]);

    // Daily briefing with per-slot caching (morning/afternoon/evening).
    useEffect(() => {
        const BRIEFING_CACHE_KEY = 'bygSmartDailyBriefing';
        const fetchBriefing = async () => {
            setIsBriefingLoading(true);
            try {
                const cached = localStorage.getItem(BRIEFING_CACHE_KEY);
                const data = cached ? JSON.parse(cached) : null;

                if (forceRefresh > 0 || !data || isCacheStale(data.timestamp)) {
                    const briefingText = await generateDailyBriefing(user?.name?.split(' ')[0]);
                    setBriefing(briefingText);
                    localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify({ content: briefingText, timestamp: Date.now() }));
                } else {
                    setBriefing(data.content);
                }
            } catch (error) {
                console.error('Failed to load/generate daily briefing:', error);
                if (error instanceof QuotaExceededError) {
                    showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
                    setBriefing('Du har nået din daglige AI-grænse. Opgrader for mere.');
                } else {
                    setBriefing('Kunne ikke indlæse dagens briefing.');
                }
            } finally {
                setIsBriefingLoading(false);
            }
        };
        fetchBriefing();
    }, [forceRefresh]);

    // Advanced briefing when the modal opens, with caching.
    useEffect(() => {
        if (!isAdvancedOpen) return;
        const ADV_BRIEFING_CACHE_KEY = 'bygSmartAdvancedBriefing_global';
        const fetchAdvancedBriefing = async () => {
            setIsGeneratingAdvanced(true);
            try {
                const cached = localStorage.getItem(ADV_BRIEFING_CACHE_KEY);
                const data = cached ? JSON.parse(cached) : null;

                if (forceRefreshAdvanced > 0 || !data || isCacheStale(data.timestamp)) {
                    const content = await generateAdvancedBriefing(user?.name?.split(' ')[0]);
                    setAdvancedContent(content);
                    localStorage.setItem(ADV_BRIEFING_CACHE_KEY, JSON.stringify({ content, timestamp: Date.now() }));
                } else {
                    setAdvancedContent(data.content);
                }
            } catch (e) {
                console.error('Failed to generate advanced briefing:', e);
                if (e instanceof QuotaExceededError) {
                    showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
                    setAdvancedContent('Du har nået din daglige AI-grænse. Opgrader for mere.');
                } else {
                    setAdvancedContent('Fejl under generering af briefing.');
                }
            } finally {
                setIsGeneratingAdvanced(false);
            }
        };
        fetchAdvancedBriefing();
    }, [isAdvancedOpen, forceRefreshAdvanced]);

    return (
        <section className="mt-6" aria-label="Dagens briefing">
            {isBriefingLoading ? (
                <Card role="status" aria-label="Genererer dagens briefing…">
                    <div className="flex items-start gap-3">
                        <Skeleton className="w-9 h-9 rounded-control shrink-0" />
                        <div className="flex-1">
                            <SkeletonText lines={2} />
                        </div>
                    </div>
                    <span className="sr-only">Genererer dagens briefing…</span>
                </Card>
            ) : (
                <Card padding="md">
                    <div className="flex items-center gap-3">
                        <span className="flex w-9 h-9 shrink-0 items-center justify-center rounded-control rich-hero-ai" aria-hidden="true">
                            <SparklesIcon className="w-5 h-5" />
                        </span>
                        <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Dagens briefing</h2>
                    </div>

                    {/* Compact weather inside the briefing card */}
                    <div className="mt-3">
                        <WeatherWidget projects={activeProjects} />
                    </div>

                    <div
                        className={cn(
                            'mt-3 text-body text-text-secondary dark:text-text-dark-secondary',
                            !briefingExpanded && 'line-clamp-4'
                        )}
                    >
                        <ReactMarkdown components={{ p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} /> }}>
                            {briefing}
                        </ReactMarkdown>
                    </div>
                    {briefing.length > 160 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 -ml-2"
                            onClick={() => setBriefingExpanded(e => !e)}
                            aria-expanded={briefingExpanded ? 'true' : 'false'}
                        >
                            {briefingExpanded ? 'Vis mindre' : 'Vis mere'}
                        </Button>
                    )}

                    <div className="mt-3 pt-3 border-t border-border dark:border-border-dark flex items-center justify-between gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            iconLeft={<SparklesIcon className="w-4 h-4" />}
                            onClick={() => { setForceRefreshAdvanced(0); setIsAdvancedOpen(true); }}
                            className="rich-hero-ai border-transparent"
                        >
                            Få Pro Briefing
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<RefreshCwIcon className={cn('w-4 h-4', isBriefingLoading && 'animate-spin')} />}
                            onClick={() => setForceRefresh(c => c + 1)}
                            disabled={isBriefingLoading}
                            aria-label="Opdater dagens briefing"
                        >
                            Opdater
                        </Button>
                    </div>
                </Card>
            )}

            <AdvancedBriefingModal
                isOpen={isAdvancedOpen}
                onClose={() => setIsAdvancedOpen(false)}
                content={advancedContent}
                isLoading={isGeneratingAdvanced}
                title="Avanceret Daglig Briefing"
                onRefresh={() => setForceRefreshAdvanced(c => c + 1)}
            />
        </section>
    );
};
