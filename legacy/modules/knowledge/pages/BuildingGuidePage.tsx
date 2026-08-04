
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGuideById } from '../services/guideData';
import { CheckCircleIcon, ChevronRightIcon } from '../../../components/icons';
import { AppScreen, Button, Card, EmptyState } from '../../../components/ui';

const BuildingGuidePage: React.FC = () => {
    const { guideId } = useParams<{ guideId: string }>();
    const navigate = useNavigate();
    const guide = getGuideById(guideId || '');

    if (!guide) {
        return (
            <AppScreen hasBottomNav={false} header={{ title: 'Guide', back: true }}>
                <Card padding="none">
                    <EmptyState
                        title="Guide ikke fundet"
                        description="Guiden findes ikke eller er blevet fjernet."
                        action={<Button onClick={() => navigate('/home')}>Tilbage til Hjem</Button>}
                    />
                </Card>
            </AppScreen>
        );
    }

    const { title, description, icon: Icon, guideSteps, recommendations, regulations } = guide;

    return (
        <AppScreen hasBottomNav={false} header={{ title, back: true }}>
            <main className="mt-2 space-y-4">
                {/* Hero */}
                <Card padding="lg" className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-brand-subtle dark:bg-brand-subtle-dark text-brand-primary dark:text-brand-light flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                        <Icon className="w-8 h-8" />
                    </div>
                    <h2 className="text-title text-text-primary dark:text-text-dark-primary">{title}</h2>
                    <p className="mt-2 text-body text-text-secondary dark:text-text-dark-secondary max-w-xl mx-auto">{description}</p>
                </Card>

                {/* Steps */}
                <Card padding="lg">
                    <h3 className="text-heading text-text-primary dark:text-text-dark-primary mb-4">Trin-for-trin Guide</h3>
                    <ol className="space-y-6">
                        {guideSteps.map((step, index) => (
                            <li key={index} className="flex items-start gap-4">
                                <span
                                    className="shrink-0 w-8 h-8 mt-0.5 rounded-full bg-brand-primary text-white text-label font-bold flex items-center justify-center"
                                    aria-hidden="true"
                                >
                                    {index + 1}
                                </span>
                                <div className="min-w-0">
                                    <h4 className="text-body font-semibold text-text-primary dark:text-text-dark-primary">{step.title}</h4>
                                    <p className="mt-1 text-body text-text-secondary dark:text-text-dark-secondary">{step.content}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </Card>

                {/* Recommendations */}
                <Card padding="lg">
                    <h3 className="text-heading text-text-primary dark:text-text-dark-primary mb-4">Gode Råd &amp; Anbefalinger</h3>
                    <ul className="space-y-3">
                        {recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5 text-success" aria-hidden="true" />
                                <span className="text-body text-text-secondary dark:text-text-dark-secondary">{rec}</span>
                            </li>
                        ))}
                    </ul>
                </Card>

                {/* Related regulations */}
                <Card padding="none">
                    <h3 className="text-heading text-text-primary dark:text-text-dark-primary px-4 sm:px-5 pt-4 sm:pt-5 pb-3">Relevante Regler</h3>
                    <div className="divide-y divide-border dark:divide-border-dark border-t border-border dark:border-border-dark">
                        {regulations.map((reg) => (
                            <div key={reg.id} className="px-4 sm:px-5 py-3">
                                <button
                                    type="button"
                                    onClick={() => navigate(`/regulation/${reg.id}`)}
                                    className="flex w-full min-h-11 items-center justify-between gap-3 text-left group"
                                >
                                    <span className="text-label font-semibold text-brand-primary dark:text-brand-light group-hover:underline">
                                        {reg.title}
                                    </span>
                                    <ChevronRightIcon className="w-4 h-4 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" aria-hidden="true" />
                                </button>
                                <ul className="mt-1 list-disc list-inside space-y-1 text-label text-text-secondary dark:text-text-dark-secondary">
                                    {reg.rules.map((rule, index) => <li key={index}>{rule}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                </Card>
            </main>
        </AppScreen>
    );
};

export default BuildingGuidePage;
