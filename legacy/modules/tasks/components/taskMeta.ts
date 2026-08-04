import type { TaskStatus } from '../../../types';
import type { BadgeVariant } from '../../../components/ui';

// Pure status metadata, split out of taskCards.tsx so the module barrel can
// export it without dragging the card components (and their partners-barrel
// chain) into every service consumer's chunk graph.

/** Status → kit Badge variant (Design System 2.0). */
export const STATUS_VARIANT: Record<TaskStatus, BadgeVariant> = {
    'To Do': 'neutral',
    'Igangværende': 'info',
    'Udført': 'success',
    'Forfalden': 'danger',
    'Annulleret': 'neutral',
};

export const statusLabel = (status: TaskStatus): string =>
    status === 'To Do' ? 'Ikke startet' : status;
