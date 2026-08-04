import React from 'react';
import { Modal } from '../../../components/ui';
import { TaskWorkspaceContent } from './TaskWorkspaceContent';

// Thin overlay wrapper around the shared task workspace — opened from task
// lists (ProjectTasksTab, GlobalTasksPage) so browsing a list never navigates
// away from it. Modal's own `title` is left unset; TaskWorkspaceContent
// renders its own header in modal mode. `size="xl"`/no sizing overrides here
// are an interim choice — the dedicated ~80vw/80vh "workspace" size lands in
// a later phase once the edit-mode toggle and breadcrumb header are built.
export const TaskWorkspaceModal: React.FC<{
    taskId: string;
    onClose: () => void;
}> = ({ taskId, onClose }) => (
    <Modal open onClose={onClose} size="xl">
        <TaskWorkspaceContent taskId={taskId} mode="modal" onClose={onClose} />
    </Modal>
);
