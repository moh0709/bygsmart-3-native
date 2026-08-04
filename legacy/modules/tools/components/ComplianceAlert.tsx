
import React from 'react';
import { CheckCircleIcon, AlertTriangleIcon, LayersIcon } from '../../../components/icons';
import { Alert } from '../../../components/ui';

interface ComplianceAlertProps {
    passed: boolean;
    message: string;
    ruleRef: string;
    isActive: boolean;
}

/**
 * BR18/standard compliance callout — kit `Alert` on semantic success/danger
 * tones with the regulation reference ("Jvf. …") kept as a caption row.
 */
const ComplianceAlert: React.FC<ComplianceAlertProps> = ({ passed, message, ruleRef, isActive }) => {
    if (!isActive) return null;

    return (
        <Alert
            variant={passed ? 'success' : 'danger'}
            title={passed ? 'Overholder reglementet' : 'Overholder ikke standardkrav'}
            icon={passed ? <CheckCircleIcon className="w-5 h-5" /> : <AlertTriangleIcon className="w-5 h-5" />}
            className="mt-4 animate-fade-in"
        >
            <p>{message}</p>
            <p className="mt-2 flex items-center gap-1 text-caption font-semibold text-text-secondary dark:text-text-dark-secondary">
                <LayersIcon className="w-3 h-3" aria-hidden="true" />
                <span>Jvf. {ruleRef}</span>
            </p>
        </Alert>
    );
};

export default ComplianceAlert;
