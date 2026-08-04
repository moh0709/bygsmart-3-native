import React, { useState } from 'react';
import { CheckCircleFilledIcon, LinkIcon } from '../../../components/icons';
import { ProviderId, initiateAuthFlow } from '../services/integrationAuth';
import { Button, Modal, cn } from '../../../components/ui';

interface IntegrationProps {
    id: ProviderId;
    name: string;
    icon: React.FC<{ className?: string }>;
    color: string;
}

export const IntegrationConnectModal: React.FC<{
    isOpen: boolean;
    isConnected: boolean;
    integration: IntegrationProps;
    onClose: () => void;
    onConnect: () => void;
    onDisconnect: () => void;
}> = ({ isOpen, isConnected, integration, onClose, onConnect, onDisconnect }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleConnectClick = () => {
        setIsLoading(true);
        // This initiates the real OAuth flow which redirects the page
        initiateAuthFlow(integration.id);
    };

    const handleDisconnectAction = () => {
        if (window.confirm(`Er du sikker på, at du vil afbryde forbindelsen til ${integration.name}?`)) {
            onDisconnect();
            onClose();
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="sm"
            title={
                <span className="inline-flex items-center gap-2">
                    <integration.icon className={cn('w-5 h-5', integration.color)} />
                    {integration.name}
                </span>
            }
        >
            {isConnected ? (
                <div className="text-center py-4">
                    <div className="w-16 h-16 bg-success-subtle dark:bg-success-subtle-dark rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircleFilledIcon className="w-8 h-8 text-success" />
                    </div>
                    <h4 className="text-heading text-text-primary dark:text-text-dark-primary">Forbundet</h4>
                    <p className="text-label text-text-secondary dark:text-text-dark-secondary mt-1">Din konto er synkroniseret.</p>
                    <div className="mt-6">
                        <Button
                            variant="outline"
                            fullWidth
                            onClick={handleDisconnectAction}
                            className="border-danger/40 text-danger hover:bg-danger-subtle dark:border-danger/40 dark:text-danger dark:hover:bg-danger-subtle-dark"
                        >
                            Afbryd forbindelse
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="text-center">
                        <p className="text-body font-medium text-text-primary dark:text-text-dark-primary mb-2">Forbind din konto</p>
                        <p className="text-label text-text-secondary dark:text-text-dark-secondary">
                            Giv BYG SMART adgang til at hente og gemme filer direkte i din {integration.name}.
                        </p>
                    </div>

                    <Button
                        fullWidth
                        onClick={handleConnectClick}
                        loading={isLoading}
                        iconLeft={<LinkIcon className="w-4 h-4" />}
                    >
                        {isLoading ? 'Forbinder...' : `Forbind med ${integration.name}`}
                    </Button>

                    <p className="text-caption text-center text-text-secondary dark:text-text-dark-secondary">
                        Ved at forbinde accepterer du, at vi kan læse filer fra din valgte mappe.
                    </p>
                </div>
            )}
        </Modal>
    );
};
