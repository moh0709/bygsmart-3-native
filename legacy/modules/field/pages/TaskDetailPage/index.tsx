import React from 'react';
import { useParams } from 'react-router-dom';
import { TaskWorkspaceContent } from '../../components/TaskWorkspaceContent';

// Thin route wrapper — all task-workspace behaviour (data loading, tabs,
// check-in/out, handover, chat, documentation) lives in the shared
// TaskWorkspaceContent so the same experience can later be opened as an
// overlay modal from task lists (ProjectTasksTab, GlobalTasksPage) without
// duplicating it.
const TaskDetailPage: React.FC = () => {
    const { taskId } = useParams<{ taskId: string }>();
    return <TaskWorkspaceContent taskId={taskId!} />;
};

export default TaskDetailPage;
