
import React, { useState, useEffect, useMemo } from 'react';
import { getLogs, clearLogs } from '../services/api';
import type { LogEntry, LogLevel } from '../types';
import { FileTextIcon, SearchIcon } from '../components/icons';
import {
    AppScreen,
    Button,
    Card,
    Chip,
    EmptyState,
    Input,
    SkeletonList,
    cn,
} from '../components/ui';

const logLevels: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

/** Level → Danish label + semantic tones (no raw palette). */
const LEVELS: Record<LogLevel, { label: string; dot: string; bubble: string; text: string }> = {
    ERROR: {
        label: 'Fejl',
        dot: 'bg-danger',
        bubble: 'bg-danger-subtle dark:bg-danger-subtle-dark',
        text: 'text-danger-strong dark:text-danger',
    },
    WARN: {
        label: 'Advarsel',
        dot: 'bg-warning',
        bubble: 'bg-warning-subtle dark:bg-warning-subtle-dark',
        text: 'text-warning-strong dark:text-warning',
    },
    INFO: {
        label: 'Info',
        dot: 'bg-info',
        bubble: 'bg-info-subtle dark:bg-info-subtle-dark',
        text: 'text-info-strong dark:text-info',
    },
    DEBUG: {
        label: 'Debug',
        dot: 'bg-text-tertiary dark:bg-text-dark-tertiary',
        bubble: 'bg-bg-muted dark:bg-bg-dark-muted',
        text: 'text-text-secondary dark:text-text-dark-secondary',
    },
};

const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dayKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** "I DAG" / "I GÅR" / uppercase Danish date for older days. */
const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return 'I DAG';
    if (sameDay(d, yesterday)) return 'I GÅR';
    return d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
};

const LogPage: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<LogLevel | 'ALL'>('ALL');

    const fetchAndSetLogs = async () => {
        setLoading(true);
        const data = await getLogs();
        setLogs(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchAndSetLogs();
    }, []);

    const handleClearLogs = async () => {
        await clearLogs();
        setLogs([]);
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesFilter = activeFilter === 'ALL' || log.level === activeFilter;
            const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [logs, searchTerm, activeFilter]);

    const levelCounts = useMemo(() => {
        const counts: Record<LogLevel, number> = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
        logs.forEach(log => { counts[log.level] = (counts[log.level] ?? 0) + 1; });
        return counts;
    }, [logs]);

    /** Day-grouped timeline (logs arrive newest-first from the API). */
    const groupedLogs = useMemo(() => {
        const groups: Array<{ key: string; label: string; entries: LogEntry[] }> = [];
        for (const log of filteredLogs) {
            const key = dayKey(log.timestamp);
            const last = groups[groups.length - 1];
            if (last && last.key === key) last.entries.push(log);
            else groups.push({ key, label: dayLabel(log.timestamp), entries: [log] });
        }
        return groups;
    }, [filteredLogs]);

    return (
        <AppScreen
            hasBottomNav={false}
            header={{
                title: 'Aktivitetslog',
                back: true,
                actions: (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:text-danger"
                        onClick={handleClearLogs}
                        disabled={loading || logs.length === 0}
                    >
                        Ryd
                    </Button>
                ),
            }}
        >
            <div className="flex flex-col gap-4 mt-2">
                {/* Search */}
                <div className="relative">
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none z-10" />
                    <Input
                        type="search"
                        aria-label="Søg i loggen"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Søg i loggen…"
                        className="pl-10"
                    />
                </div>

                {/* Level filters */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:-mx-6 md:px-6">
                    <Chip
                        selected={activeFilter === 'ALL'}
                        count={logs.length}
                        onClick={() => setActiveFilter('ALL')}
                    >
                        Alle
                    </Chip>
                    {logLevels.map(level => (
                        <Chip
                            key={level}
                            selected={activeFilter === level}
                            count={levelCounts[level]}
                            onClick={() => setActiveFilter(level)}
                        >
                            {LEVELS[level].label}
                        </Chip>
                    ))}
                </div>

                {/* Timeline */}
                {loading ? (
                    <SkeletonList count={3} label="Indlæser log…" />
                ) : groupedLogs.length === 0 ? (
                    <EmptyState
                        icon={<FileTextIcon className="w-7 h-7" />}
                        title={logs.length === 0 ? 'Ingen logposter endnu' : 'Ingen resultater'}
                        description={
                            logs.length === 0
                                ? 'Aktivitet i appen vises her, efterhånden som den sker.'
                                : 'Prøv en anden søgning eller et andet filter.'
                        }
                    />
                ) : (
                    <div className="flex flex-col gap-5">
                        {groupedLogs.map(group => (
                            <section key={group.key} aria-label={group.label}>
                                <h2 className="text-caption font-bold uppercase tracking-widest text-text-tertiary dark:text-text-dark-tertiary px-1 mb-2">
                                    {group.label}
                                </h2>
                                <Card padding="none" className="overflow-hidden">
                                    <ul className="divide-y divide-border dark:divide-border-dark">
                                        {group.entries.map(log => {
                                            const level = LEVELS[log.level] ?? LEVELS.INFO;
                                            return (
                                                <li key={log.id} className="flex items-start gap-3 px-4 py-3">
                                                    <span
                                                        className={cn(
                                                            'mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                                                            level.bubble
                                                        )}
                                                        aria-hidden="true"
                                                    >
                                                        <span className={cn('w-2 h-2 rounded-full', level.dot)} />
                                                    </span>
                                                    <div className="min-w-0 grow">
                                                        <div className="flex items-baseline justify-between gap-3">
                                                            <span className={cn('text-caption font-bold uppercase tracking-wide', level.text)}>
                                                                {level.label}
                                                            </span>
                                                            <time
                                                                dateTime={log.timestamp}
                                                                className="text-caption text-text-tertiary dark:text-text-dark-tertiary shrink-0"
                                                            >
                                                                {new Date(log.timestamp).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                                                            </time>
                                                        </div>
                                                        <p className="text-label font-mono text-text-primary dark:text-text-dark-primary whitespace-pre-wrap break-words mt-0.5">
                                                            {log.message}
                                                        </p>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </Card>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </AppScreen>
    );
};

export default LogPage;
