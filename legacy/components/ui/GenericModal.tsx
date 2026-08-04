import React from 'react';
import { Modal } from './Modal';

interface ModalProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  'data-ref-id'?: string;
  fullScreen?: boolean;
}

/**
 * Legacy API kept for existing call sites; now a thin wrapper around the
 * accessible `Modal` primitive (focus trap, ESC, scroll lock, bottom-sheet on
 * mobile). Prefer using `Modal` from `components/ui` directly in new code.
 */
export const GenericModal: React.FC<ModalProps> = ({
  title,
  onClose,
  children,
  footer,
  'data-ref-id': dataRefId,
  fullScreen = false,
}) => (
  <Modal
    open
    onClose={onClose}
    title={title}
    footer={footer}
    size={fullScreen ? 'full' : 'md'}
    className={fullScreen ? 'h-[92dvh]' : undefined}
    data-ref-id={dataRefId}
  >
    {children}
  </Modal>
);
