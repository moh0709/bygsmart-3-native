import React, { useState } from 'react';
import type { ProviderId } from '../services/integrationAuth';
import { IntegrationConnectModal } from './IntegrationConnectModal';
import { SectionTitle } from '../../../components/settings/SectionTitle';
import { Badge, Card, ListRow, cn } from '../../../components/ui';
import { GoogleIcon, DropboxIcon, OneDriveIcon, BoxIcon } from '../../../components/icons';

interface IntegrationProps {
    id: ProviderId;
    name: string;
    icon: React.FC<{ className?: string }>;
    color: string;
}

/**
 * "Integrationer" settings block (formerly inline in SettingsPage) —
 * contributed via the settingsSections slot so it disappears with the
 * integrations module's entitlement.
 */
export const IntegrationsSettingsSection: React.FC = () => {
    const [connections, setConnections] = useState<Record<string, boolean>>(() => ({
        google: localStorage.getItem('bygSmart-google-connected') === 'true',
        dropbox: localStorage.getItem('bygSmart-dropbox-connected') === 'true',
        onedrive: localStorage.getItem('bygSmart-onedrive-connected') === 'true',
        box: localStorage.getItem('bygSmart-box-connected') === 'true',
    }));
    const [activeModal, setActiveModal] = useState<ProviderId | null>(null);

    const integrations: IntegrationProps[] = [
        { id: 'google', name: 'Google Drive', icon: GoogleIcon, color: 'text-brand-primary' },
        { id: 'dropbox', name: 'Dropbox', icon: DropboxIcon, color: 'text-brand-primary' },
        { id: 'onedrive', name: 'OneDrive', icon: OneDriveIcon, color: 'text-brand-primary' },
        { id: 'box', name: 'Box', icon: BoxIcon, color: 'text-brand-primary' },
    ];

    const handleDisconnect = (id: string) => {
        setConnections(prev => ({ ...prev, [id]: false }));
        localStorage.removeItem(`bygSmart-${id}-connected`);
        sessionStorage.removeItem(`bygSmart-${id}-token`);
    };

    return (
        <section className="flex flex-col gap-3" aria-label="Integrationer">
            <SectionTitle>Integrationer</SectionTitle>
            <Card padding="none" className="overflow-hidden divide-y divide-border dark:divide-border-dark">
                {integrations.map(integration => (
                    <ListRow
                        key={integration.id}
                        leading={
                            <span className="w-8 h-8 bg-bg-muted dark:bg-bg-dark-muted rounded-control flex items-center justify-center">
                                <integration.icon className={cn('w-5 h-5', integration.color)} />
                            </span>
                        }
                        title={integration.name}
                        trailing={
                            connections[integration.id]
                                ? <Badge variant="success" dot>Forbundet</Badge>
                                : <Badge>Ikke forbundet</Badge>
                        }
                        onClick={() => setActiveModal(integration.id)}
                    />
                ))}
            </Card>
            {activeModal && (
                <IntegrationConnectModal
                    isOpen={!!activeModal}
                    isConnected={connections[activeModal]}
                    integration={integrations.find(i => i.id === activeModal)!}
                    onClose={() => setActiveModal(null)}
                    onConnect={() => {}}
                    onDisconnect={() => handleDisconnect(activeModal)}
                />
            )}
        </section>
    );
};
