import React, { useState, useMemo } from 'react';
import { manualData, ManualSection } from '../data/manualData';
import { SearchIcon, ChevronDownIcon, ChevronRightIcon, ArrowLeftIcon, SendIcon } from '../components/icons';
import { AppScreen, Button, Card, EmptyState, Input, ListRow, Modal, cn } from '../components/ui';

const HelpPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['start'])); // Open 'Start' by default
    const [selectedArticle, setSelectedArticle] = useState<{sectionTitle: string, title: string, content: string} | null>(null);

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    // Flatten all articles into a single list for linear navigation
    const flatArticles = useMemo(() => {
        const articles: {sectionTitle: string, title: string, content: string}[] = [];
        manualData.forEach(section => {
            section.articles.forEach(article => {
                articles.push({ ...article, sectionTitle: section.title });
            });
        });
        return articles;
    }, []);

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return manualData;

        const lowerQuery = searchQuery.toLowerCase();
        return manualData.map(section => {
            // Check if section title matches
            if (section.title.toLowerCase().includes(lowerQuery)) return section;

            // Check if any articles match
            const matchingArticles = section.articles.filter(article =>
                article.title.toLowerCase().includes(lowerQuery) ||
                article.content.toLowerCase().includes(lowerQuery)
            );

            if (matchingArticles.length > 0) {
                return { ...section, articles: matchingArticles };
            }

            return null;
        }).filter(Boolean) as ManualSection[];
    }, [searchQuery]);

    // Auto-expand if searching
    React.useEffect(() => {
        if (searchQuery.trim()) {
            const allIds = filteredData.map(s => s.id);
            setExpandedSections(new Set(allIds));
        }
    }, [searchQuery, filteredData]);

    const renderContent = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (line.startsWith('* ')) {
                // Bullet point
                const content = line.substring(2);
                const parts = content.split('**');
                return (
                    <li key={i} className="flex items-start gap-2 mb-2 ml-4 text-body text-text-secondary dark:text-text-dark-secondary list-none">
                        <span className="mt-2 w-1.5 h-1.5 bg-brand-primary rounded-full shrink-0" aria-hidden="true"></span>
                        <span>
                            {parts.map((part, idx) =>
                                idx % 2 === 1 ? <strong key={idx} className="text-text-primary dark:text-text-dark-primary">{part}</strong> : part
                            )}
                        </span>
                    </li>
                );
            }
            if (!line.trim()) return <div key={i} className="h-3"></div>;

            // Regular paragraph with bold support
            const parts = line.split('**');
            return (
                <p key={i} className="mb-2 text-body text-text-secondary dark:text-text-dark-secondary">
                    {parts.map((part, idx) =>
                        idx % 2 === 1 ? <strong key={idx} className="text-text-primary dark:text-text-dark-primary">{part}</strong> : part
                    )}
                </p>
            );
        });
    };

    // Calculate previous and next articles
    const getNavigation = () => {
        if (!selectedArticle) return { prev: null, next: null };
        const currentIndex = flatArticles.findIndex(a => a.title === selectedArticle.title && a.sectionTitle === selectedArticle.sectionTitle);

        return {
            prev: currentIndex > 0 ? flatArticles[currentIndex - 1] : null,
            next: currentIndex < flatArticles.length - 1 ? flatArticles[currentIndex + 1] : null
        };
    };

    const { prev, next } = getNavigation();

    return (
        <AppScreen hasBottomNav={false} header={{ title: 'Hjælp & Manual', back: true }}>
            <div className="mt-2 space-y-4">
                {/* Search */}
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none z-[1]" aria-hidden="true" />
                    <Input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Søg i manualen…"
                        aria-label="Søg i manualen"
                        className="pl-10"
                    />
                </div>

                {/* FAQ accordions */}
                {filteredData.map(section => {
                    const expanded = expandedSections.has(section.id);
                    return (
                        <Card key={section.id} padding="none" className="overflow-hidden">
                            <button
                                type="button"
                                onClick={() => toggleSection(section.id)}
                                aria-expanded={expanded}
                                className="flex w-full min-h-11 items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-bg-subtle active:bg-bg-muted dark:hover:bg-bg-dark-muted/50 dark:active:bg-bg-dark-muted"
                            >
                                <span className="flex items-center gap-3 min-w-0">
                                    <span className="shrink-0 w-9 h-9 rounded-control bg-brand-subtle dark:bg-brand-subtle-dark text-brand-primary dark:text-brand-light flex items-center justify-center" aria-hidden="true">
                                        <section.icon className="w-5 h-5" />
                                    </span>
                                    <span className="text-label font-bold text-text-primary dark:text-text-dark-primary truncate">{section.title}</span>
                                </span>
                                <ChevronDownIcon
                                    className={cn(
                                        'w-5 h-5 shrink-0 text-text-tertiary dark:text-text-dark-tertiary transition-transform duration-150',
                                        expanded && 'rotate-180'
                                    )}
                                    aria-hidden="true"
                                />
                            </button>

                            {expanded && (
                                <div className="border-t border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark bg-bg-subtle/60 dark:bg-bg-dark-muted/30">
                                    {section.articles.map((article, idx) => (
                                        <ListRow
                                            key={idx}
                                            title={article.title}
                                            onClick={() => setSelectedArticle({ sectionTitle: section.title, ...article })}
                                        />
                                    ))}
                                </div>
                            )}
                        </Card>
                    );
                })}

                {filteredData.length === 0 && (
                    <Card padding="none">
                        <EmptyState
                            icon={<SearchIcon />}
                            title={`Ingen resultater for "${searchQuery}"`}
                            description="Prøv at søge med et andet ord."
                        />
                    </Card>
                )}

                {/* Contact */}
                <Card padding="lg" className="text-center">
                    <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Brug for mere hjælp?</h2>
                    <p className="mt-1 text-label text-text-secondary dark:text-text-dark-secondary max-w-sm mx-auto">
                        Fandt du ikke svar i manualen? Skriv til os, så hjælper vi dig videre.
                    </p>
                    <div className="mt-4 flex justify-center">
                        <Button
                            iconLeft={<SendIcon className="w-4 h-4" aria-hidden="true" />}
                            onClick={() => { window.location.href = 'mailto:support@bygsmart.dk?subject=' + encodeURIComponent('BYG SMART — Support'); }}
                        >
                            Kontakt support
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Article detail */}
            {selectedArticle && (
                <Modal
                    open
                    onClose={() => setSelectedArticle(null)}
                    size="lg"
                    title={selectedArticle.title}
                    description={selectedArticle.sectionTitle}
                    footer={
                        (prev || next) ? (
                            <div className="flex w-full items-center justify-between gap-3">
                                {prev ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => setSelectedArticle(prev)}
                                        iconLeft={<ArrowLeftIcon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                                        className="min-w-0 max-w-[48%]"
                                    >
                                        <span className="truncate">{prev.title}</span>
                                    </Button>
                                ) : <span aria-hidden="true" />}
                                {next ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => setSelectedArticle(next)}
                                        iconRight={<ChevronRightIcon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                                        className="min-w-0 max-w-[48%]"
                                    >
                                        <span className="truncate">{next.title}</span>
                                    </Button>
                                ) : <span aria-hidden="true" />}
                            </div>
                        ) : undefined
                    }
                >
                    <div className="max-w-none">
                        {renderContent(selectedArticle.content)}
                    </div>
                </Modal>
            )}
        </AppScreen>
    );
};

export default HelpPage;
