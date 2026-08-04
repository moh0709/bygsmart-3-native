import React, { useEffect, useState } from 'react';
import type { TimeEntry } from '../../../../types';
import { getMyTimeEntriesForDay } from '../../services/timeEntries';
import { Card } from '../../../../components/ui';
import { nfHours } from '../../../../components/dashboard/homeHelpers';
import { ClockIcon } from '../../../../components/icons';

/**
 * Worker "Dagens timer" summary card (formerly inline in HomePage's worker
 * view). The active check-in line comes from field via dynamic import —
 * field's barrel carries the heavy workspace components, and field is not
 * required for the hours themselves (fail-soft to no check-in line).
 */
export const TodayHoursWidget: React.FC = () => {
    const [todaysHours, setTodaysHours] = useState(0);
    const [activeCheckIn, setActiveCheckIn] = useState<{ taskId: string; taskTitle: string; projectName?: string; checkedInAt: string } | null>(null);

    useEffect(() => {
        let alive = true;
        getMyTimeEntriesForDay()
            .then((entries) => { if (alive) setTodaysHours(entries.reduce((sum: number, e: TimeEntry) => sum + e.hours, 0)); })
            .catch((e) => console.error('TodayHoursWidget hours fetch failed:', e));
        import('../../../field')
            .then((m) => m.getMyActiveCheckIn())
            .then((checkIn) => { if (alive) setActiveCheckIn(checkIn); })
            .catch(() => undefined);
        return () => { alive = false; };
    }, []);

    return (
        <section className="mt-6" aria-label="Dagens timer">
            <Card padding="md">
                <div className="flex items-center gap-3">
                    <span className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary" aria-hidden="true">
                        <ClockIcon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-title text-text-primary dark:text-text-dark-primary">
                            {nfHours.format(todaysHours)} t i dag
                        </p>
                        {activeCheckIn && (
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                                Tjekket ind på {activeCheckIn.taskTitle}
                                {activeCheckIn.projectName ? ` · ${activeCheckIn.projectName}` : ''}
                            </p>
                        )}
                    </div>
                </div>
            </Card>
        </section>
    );
};
