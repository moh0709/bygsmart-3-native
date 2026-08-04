import React from 'react';
import type { Task } from '../../../../types';
import {
    Badge,
    Card,
    cn,
} from '../../../../components/ui';
import { STEPPER_STAGES } from './constants';
import { stepperIndexFor } from './helpers';

export const StatusStepper: React.FC<{ task: Task }> = ({ task }) => {
    const current = stepperIndexFor(task);
    const allDone = current === STEPPER_STAGES.length - 1;
    return (
        <Card padding="sm" role="group" aria-label={`Opgaveforløb — nuværende trin: ${STEPPER_STAGES[current]}`}>
            <ol className="flex items-start">
                {STEPPER_STAGES.map((label, i) => {
                    const filled = i < current || (allDone && i === current);
                    const isCurrent = i === current && !allDone;
                    return (
                        <li key={label} className="relative flex flex-1 flex-col items-center" aria-current={isCurrent ? 'step' : undefined}>
                            {i > 0 && (
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'absolute top-[6px] left-[calc(-50%+10px)] right-[calc(50%+10px)] h-0.5 rounded-full',
                                        current >= i ? 'bg-brand-primary' : 'bg-border dark:bg-border-dark'
                                    )}
                                />
                            )}
                            <span className="flex h-3.5 w-3.5 items-center justify-center">
                                {filled ? (
                                    <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
                                ) : isCurrent ? (
                                    <span className="h-3.5 w-3.5 rounded-full border-[3px] border-brand-primary bg-bg dark:bg-bg-dark-surface" />
                                ) : (
                                    <span className="h-2.5 w-2.5 rounded-full bg-border-strong dark:bg-border-dark-strong" />
                                )}
                            </span>
                            <span
                                className={cn(
                                    'mt-1.5 text-caption',
                                    isCurrent
                                        ? 'font-semibold text-text-primary dark:text-text-dark-primary'
                                        : filled
                                            ? 'text-text-secondary dark:text-text-dark-secondary'
                                            : 'text-text-tertiary dark:text-text-dark-tertiary'
                                )}
                            >
                                {label}
                                {filled && <span className="sr-only"> (fuldført)</span>}
                            </span>
                        </li>
                    );
                })}
            </ol>
            {(task.status === 'Forfalden' || task.status === 'Annulleret') && (
                <div className="mt-2 flex justify-center">
                    <Badge variant={task.status === 'Forfalden' ? 'danger' : 'neutral'} dot>
                        {task.status === 'Forfalden' ? 'Forfalden — deadline overskredet' : 'Annulleret'}
                    </Badge>
                </div>
            )}
        </Card>
    );
};
