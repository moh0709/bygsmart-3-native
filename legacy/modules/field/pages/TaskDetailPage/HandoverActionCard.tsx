import React from 'react';
import type { Task } from '../../../../types';
import { CheckIcon, FileTextIcon } from '../../../../components/icons';
import {
    Alert,
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    cn,
} from '../../../../components/ui';
import { HANDOVER_STEPS } from './constants';

// ─── HandoverActionCard — guided handover sequence ───────────────────────────

export const HandoverActionCard: React.FC<{
    task: Task;
    isDone: boolean;
    isOwnerOrManager: boolean;
    hasReport: boolean;
    onOpenReport: () => void;
    onFaerdigmeld: () => void;
    onGodkend: () => void;
    onAfvis: () => void;
}> = ({ task, isDone, isOwnerOrManager, hasReport, onOpenReport, onFaerdigmeld, onGodkend, onAfvis }) => {
    const currentStep = isDone ? HANDOVER_STEPS.length : task.handoverStatus === 'submitted' ? 1 : 0;
    return (
        <Card>
            <CardHeader className="mb-3">
                <CardTitle>Aflevering</CardTitle>
                {isDone ? (
                    <Badge variant="success" dot>Godkendt</Badge>
                ) : task.handoverStatus === 'submitted' ? (
                    <Badge variant="warning" dot>Afventer godkendelse</Badge>
                ) : task.handoverStatus === 'rejected' ? (
                    <Badge variant="danger" dot>Afvist</Badge>
                ) : null}
            </CardHeader>

            <ol className="mb-4 space-y-2.5">
                {HANDOVER_STEPS.map((step, i) => {
                    const done = i < currentStep;
                    const isCurrent = i === currentStep;
                    return (
                        <li key={step.title} className="flex items-center gap-3" aria-current={isCurrent ? 'step' : undefined}>
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-bold',
                                    done
                                        ? 'bg-brand-primary text-white'
                                        : isCurrent
                                            ? 'border-2 border-brand-primary text-brand-primary dark:text-brand-light'
                                            : 'bg-bg-muted text-text-tertiary dark:bg-bg-dark-muted dark:text-text-dark-tertiary'
                                )}
                            >
                                {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                            </span>
                            <span className="min-w-0">
                                <span className={cn(
                                    'block text-label font-semibold',
                                    done || isCurrent
                                        ? 'text-text-primary dark:text-text-dark-primary'
                                        : 'text-text-tertiary dark:text-text-dark-tertiary'
                                )}>
                                    {step.title}
                                    {done && <span className="sr-only"> (fuldført)</span>}
                                </span>
                                <span className="block text-caption text-text-secondary dark:text-text-dark-secondary">{step.desc}</span>
                            </span>
                        </li>
                    );
                })}
            </ol>

            {isDone ? (
                <Alert
                    variant="success"
                    title="Opgaven er godkendt og afsluttet"
                    action={hasReport ? (
                        <Button size="sm" variant="outline" iconLeft={<FileTextIcon className="w-4 h-4" />} onClick={onOpenReport}>
                            Se rapport
                        </Button>
                    ) : undefined}
                >
                    Afleveringsrapporten er fastgjort under Dokumentation.
                </Alert>
            ) : task.handoverStatus === 'submitted' ? (
                <div className="space-y-3">
                    <Alert variant="info" title="Færdigmeldt — afventer godkendelse">
                        {isOwnerOrManager
                            ? 'Gennemgå arbejdet og godkend med din underskrift, eller afvis med en begrundelse.'
                            : 'Opgaven er færdigmeldt og afventer Mesterens godkendelse.'}
                    </Alert>
                    {isOwnerOrManager && (
                        <div className="flex gap-2">
                            <Button fullWidth onClick={onGodkend}>Godkend</Button>
                            <Button fullWidth variant="danger" onClick={onAfvis}>Afvis</Button>
                        </div>
                    )}
                </div>
            ) : task.handoverStatus === 'rejected' ? (
                <div className="space-y-3">
                    <Alert variant="danger" title="Afvist af Mesteren">
                        Genoptag arbejdet og færdigmeld igen, når manglerne er udbedret.
                    </Alert>
                    {!isOwnerOrManager && <Button fullWidth onClick={onFaerdigmeld}>Færdigmeld igen</Button>}
                </div>
            ) : (
                <div className="space-y-3">
                    <Alert variant="info" title={isOwnerOrManager ? 'Afventer færdigmelding' : 'Klar til aflevering?'}>
                        {isOwnerOrManager
                            ? 'Medarbejderen eller partneren færdigmelder opgaven, når arbejdet er udført.'
                            : 'Når arbejdet er udført, færdigmelder du opgaven med din underskrift. Mesteren godkender herefter.'}
                    </Alert>
                    {!isOwnerOrManager && <Button fullWidth onClick={onFaerdigmeld}>Færdigmeld opgave</Button>}
                </div>
            )}
        </Card>
    );
};
