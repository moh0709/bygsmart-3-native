import React from 'react';
import TaskInvitationCarousel from '../../../../components/dashboard/TaskInvitationCarousel';

/**
 * "Kræver handling" wrapper for the task-invitation carousel. The carousel is
 * shared legacy code that fetches its own data and renders null when empty —
 * this widget just puts it behind the tasks module's entitlement.
 */
export const TaskInvitesWidget: React.FC = () => <TaskInvitationCarousel />;
