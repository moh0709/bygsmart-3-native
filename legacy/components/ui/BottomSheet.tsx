import React from 'react';
import { Modal, ModalProps } from './Modal';

export type BottomSheetProps = Omit<ModalProps, 'sheet' | 'sheetOnMobile'>;

/**
 * Bottom sheet on every viewport — grabber handle, slide-up animation,
 * focus trap and Escape handling inherited from Modal.
 * Use for secondary navigation ("Mere"), pickers and quick actions.
 */
export const BottomSheet: React.FC<BottomSheetProps> = (props) => <Modal {...props} sheet />;
