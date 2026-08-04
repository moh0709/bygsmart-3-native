import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    danger?: boolean;
    /** Show a spinner on the confirm button while the action runs. */
    loading?: boolean;
}

/**
 * Reusable confirmation dialog — replaces window.confirm() throughout the app.
 * Built on the kit Modal (focus trap, Escape, focus restore, bottom-sheet on
 * mobile) — same public API as the legacy implementation.
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Bekræft',
    cancelLabel = 'Annuller',
    onConfirm,
    onCancel,
    danger = false,
    loading = false,
}) => (
    <Modal
        open={isOpen}
        onClose={onCancel}
        title={title}
        size="sm"
        footer={
            <>
                <Button variant="ghost" onClick={onCancel}>
                    {cancelLabel}
                </Button>
                <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
                    {confirmLabel}
                </Button>
            </>
        }
    >
        <p className="text-body text-text-secondary dark:text-text-dark-secondary">{message}</p>
    </Modal>
);

export default ConfirmDialog;
