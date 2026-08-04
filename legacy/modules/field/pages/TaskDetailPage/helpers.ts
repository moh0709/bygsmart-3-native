import type { Task } from '../../../../types';

// ─── Format elapsed seconds as H:MM:SS or MM:SS ──────────────────────────────

export const formatElapsed = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const stepperIndexFor = (task: Task): number => {
    if (task.handoverStatus === 'accepted' || task.status === 'Udført') return 3;
    if (task.handoverStatus === 'submitted') return 2;
    if (task.status === 'Igangværende' || task.status === 'Forfalden' || task.handoverStatus === 'rejected') return 1;
    return 0;
};
