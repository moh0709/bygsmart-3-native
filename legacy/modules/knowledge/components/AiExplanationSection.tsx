import React from 'react';
import ReactMarkdown from 'react-markdown';
import { SparklesIcon, ChevronDownIcon, CheckCircleIcon } from '../../../components/icons';
import { Alert, Badge, Button, Card, Spinner, cn } from '../../../components/ui';

export interface AiExplanationContent {
    explanation: string;
    checklist: string[];
    requirements: string[];
    tags: string[];
}

export interface AIState {
    content: AiExplanationContent;
    verification?: {
        date: string;
    };
}

interface AiExplanationSectionProps {
    isOpen: boolean;
    onToggle: () => void;
    aiState: AIState | null;
    isLoading: boolean;
    error: string | null;
    isVerifying: boolean;
    onVerify: () => void;
    checkedItems: Set<number>;
    onToggleItem: (index: number) => void;
}

export const AiExplanationSection: React.FC<AiExplanationSectionProps> = ({
    isOpen, onToggle, aiState, isLoading, error, isVerifying, onVerify, checkedItems, onToggleItem
}) => {
    return (
        <Card padding="none" data-ref-id="regulation-ai-explanation-card">
            <div className="flex items-center gap-2 pr-3">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={isOpen}
                    className="flex grow min-w-0 items-center gap-2 px-4 py-3 min-h-11 text-left"
                >
                    <SparklesIcon className="w-5 h-5 shrink-0 text-brand-primary dark:text-brand-light" aria-hidden="true" />
                    <span className="text-label font-bold text-text-primary dark:text-text-dark-primary">AI Forklaring</span>
                    <ChevronDownIcon
                        className={cn(
                            'w-4 h-4 shrink-0 text-text-tertiary dark:text-text-dark-tertiary transition-transform duration-150',
                            isOpen && 'rotate-180'
                        )}
                        aria-hidden="true"
                    />
                </button>
                {aiState?.verification ? (
                    <Badge variant="success" className="shrink-0">
                        <CheckCircleIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        Evalueret {aiState.verification.date}
                    </Badge>
                ) : aiState ? (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onVerify}
                        loading={isVerifying}
                        iconLeft={<CheckCircleIcon className="w-4 h-4" aria-hidden="true" />}
                        className="shrink-0 text-brand-primary dark:text-brand-light"
                    >
                        AI Check
                    </Button>
                ) : null}
            </div>

            {isOpen && (
                <div className="px-4 pb-4 pt-4 border-t border-border dark:border-border-dark space-y-4">
                    {isLoading && (
                        <div role="status" className="flex flex-col items-center gap-2 py-6 text-label text-text-secondary dark:text-text-dark-secondary">
                            <Spinner className="h-6 w-6 text-brand-primary" />
                            Genererer AI-forklaring…
                        </div>
                    )}
                    {error && <Alert variant="danger">{error}</Alert>}
                    {aiState?.content && (
                        <div className="space-y-4 animate-fade-in">
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">
                                Denne AI-genererede forklaring er et supplement og ikke en erstatning for den originale tekst.
                            </p>

                            <Alert variant="info" title="Passer til dit projekt" icon={null}>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-text-secondary dark:text-text-dark-secondary">
                                    <ReactMarkdown>{aiState.content.explanation}</ReactMarkdown>
                                </div>
                            </Alert>

                            <section aria-label="Tjekliste">
                                <h4 className="flex items-center gap-2 text-label font-bold text-text-primary dark:text-text-dark-primary mb-2">
                                    <CheckCircleIcon className="w-5 h-5 text-brand-primary dark:text-brand-light" aria-hidden="true" />
                                    Tjekliste
                                </h4>
                                <div className="space-y-1">
                                    {aiState.content.checklist.map((item, index) => {
                                        const checked = checkedItems.has(index);
                                        return (
                                            <button
                                                key={index}
                                                type="button"
                                                aria-pressed={checked}
                                                onClick={() => onToggleItem(index)}
                                                className="flex w-full min-h-11 items-start gap-3 py-1.5 text-left group"
                                            >
                                                <span
                                                    className={cn(
                                                        'mt-0.5 w-5 h-5 rounded-md shrink-0 border-2 flex items-center justify-center transition-colors duration-150',
                                                        checked
                                                            ? 'bg-brand-primary border-brand-primary'
                                                            : 'bg-bg border-border-strong group-hover:border-brand-primary dark:bg-bg-dark-surface dark:border-border-dark-strong'
                                                    )}
                                                    aria-hidden="true"
                                                >
                                                    {checked && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 9">
                                                            <path d="M1 4.5L4.5 8L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    )}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'text-label',
                                                        checked
                                                            ? 'line-through text-text-secondary dark:text-text-dark-secondary'
                                                            : 'text-text-primary dark:text-text-dark-primary'
                                                    )}
                                                >
                                                    {item}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section aria-label="Hovedkrav">
                                <h4 className="text-label font-bold text-text-primary dark:text-text-dark-primary mb-2">Hovedkrav</h4>
                                <ul className="list-disc list-inside space-y-1 text-label text-text-secondary dark:text-text-dark-secondary">
                                    {aiState.content.requirements.map((req, i) => (
                                        <li key={i}>{req}</li>
                                    ))}
                                </ul>
                            </section>

                            <div className="flex flex-wrap gap-2">
                                {aiState.content.tags.map(tag => (
                                    <Badge key={tag}>#{tag}</Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
