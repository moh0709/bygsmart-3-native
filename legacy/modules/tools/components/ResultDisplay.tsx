
import React, { useState } from 'react';
import AnimatedNumber from './AnimatedNumber';
import { ShoppingCartIcon, CheckSquareIcon, FolderIcon } from '../../../components/icons';
import AddToProjectModal from './AddToProjectModal';
import { Card, Button } from '../../../components/ui';

interface ResultDisplayProps {
    label: string;
    value: number;
    unit: React.ReactNode;
    precision?: number;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ label, value, unit, precision = 2 }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'purchase' | 'task'>('purchase');

    // Helper to convert JSX unit to string if needed, or default
    const getUnitString = (): string => {
        if (typeof unit === 'string') return unit;
        // Fallback for common JSX units used in the app
        // Ideally, we should pass a string unit prop alongside the display unit
        return 'enhed';
    };

    const handleOpenModal = (type: 'purchase' | 'task') => {
        setModalType(type);
        setIsModalOpen(true);
    };

    return (
        <>
            <Card padding="lg">
                <h3 className="text-heading text-text-primary dark:text-text-dark-primary mb-4">{label}</h3>
                <div className="text-center bg-bg-muted dark:bg-bg-dark-muted p-4 rounded-card">
                    <p className="text-caption font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">Resultat</p>
                    <div className="text-display tabular-nums text-brand-primary dark:text-brand-light mt-1 break-words">
                        <AnimatedNumber value={value} precision={precision} />
                        <span className="text-heading ml-1.5 text-text-secondary dark:text-text-dark-secondary">{unit}</span>
                    </div>
                </div>
                {value > 0 && (
                    <div className="mt-5 pt-4 border-t border-border dark:border-border-dark">
                        <p className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3 text-center flex items-center justify-center gap-1">
                            <FolderIcon className="w-3 h-3" /> Gem til projekt
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => handleOpenModal('purchase')}
                                iconLeft={<ShoppingCartIcon className="w-4 h-4" />}
                            >
                                Indkøb
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenModal('task')}
                                iconLeft={<CheckSquareIcon className="w-4 h-4" />}
                            >
                                Opgave
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            <AddToProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                defaultTitle={label}
                defaultValue={parseFloat(value.toFixed(precision))}
                defaultUnit={getUnitString()}
                initialType={modalType}
            />
        </>
    );
};

export default ResultDisplay;
