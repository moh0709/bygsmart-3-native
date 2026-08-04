import React, { useRef, useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { createPortal } from 'react-dom';
import { UploadCloudIcon, GoogleIcon, FileTextIcon, DropboxIcon, OneDriveIcon, BoxIcon } from './icons';
import { CloudFileBrowser } from '../modules/integrations';
import { ProviderId } from '../modules/integrations';
import { useModuleGate } from '../core/entitlements/ModuleGate';

interface FilePickerProps {
    onFileSelect: (file: File) => void;
    multiple?: boolean;
    accept?: string;
    label?: string;
    buttonStyle?: 'primary' | 'secondary' | 'dashed' | 'icon';
    className?: string;
}

const FilePicker: React.FC<FilePickerProps> = ({
    onFileSelect,
    multiple = false,
    accept = "*",
    label = "Vælg fil",
    buttonStyle = 'secondary',
    className = ""
}) => {
    const { showToast } = useToast();
    const integrationsEnabled = useModuleGate('integrations');
    const [isOpen, setIsOpen] = useState(false);
    const [activeCloudProvider, setActiveCloudProvider] = useState<ProviderId | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{top: number, left: number, width: number}>({top:0, left:0, width: 256});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const toggleDropdown = () => {
        if (!isOpen && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            let left = rect.left;
            // Basic viewport check to prevent overflow right
            if (left + 256 > window.innerWidth) {
                left = window.innerWidth - 266;
            }
            
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: left + window.scrollX,
                width: Math.max(256, rect.width) // At least 256px wide
            });
        }
        setIsOpen(!isOpen);
    };

    const handleLocalSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            Array.from(e.target.files).forEach(file => onFileSelect(file));
        }
        setIsOpen(false);
    };

    const handleCloudSelect = (providerId: ProviderId) => {
        // localStorage holds the persisted connected flag (survives sessions)
        // sessionStorage holds the real OAuth token (already read by CloudFileBrowser)
        const connected = localStorage.getItem(`bygSmart-${providerId}-connected`);
        
        if (!connected) {
            showToast(`Du er ikke forbundet til ${providerId}. Gå til Indstillinger > Integrationer for at forbinde.`, 'warning');
            setIsOpen(false);
            return;
        }
        
        setActiveCloudProvider(providerId);
        setIsOpen(false);
    };

    const renderButton = () => {
        if (buttonStyle === 'icon') {
            return (
                <button
                    onClick={toggleDropdown}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary dark:text-text-dark-secondary dark:hover:bg-bg-dark-muted ${className}`}
                    title="Vedhæft fil"
                    type="button"
                >
                    <UploadCloudIcon className="w-5 h-5" />
                </button>
            );
        }

        if (buttonStyle === 'dashed') {
            return (
                <button 
                    type="button"
                    onClick={toggleDropdown}
                    className={`w-full border-2 border-dashed border-border-strong dark:border-border-dark-strong rounded-card p-4 text-center hover:bg-bg-subtle dark:hover:bg-bg-dark-muted transition-colors flex flex-col items-center justify-center gap-2 ${className}`}
                >
                    <UploadCloudIcon className="w-8 h-8 text-text-tertiary dark:text-text-dark-tertiary" />
                    <span className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">{label}</span>
                    <span className="text-xs text-brand-primary dark:text-brand-light bg-brand-subtle dark:bg-brand-subtle-dark px-2 py-1 rounded-full flex items-center gap-1">
                        <GoogleIcon className="w-3 h-3" />
                        Inkl. Sky
                    </span>
                </button>
            );
        }

        const baseClass = "px-4 py-2 min-h-11 rounded-control font-semibold flex items-center justify-center gap-2 transition-colors w-full";
        const styleClass = buttonStyle === 'primary'
            ? "bg-brand-primary text-white hover:bg-brand-strong"
            : "border border-border-strong dark:border-border-dark-strong text-text-secondary dark:text-text-dark-secondary hover:bg-bg-subtle dark:hover:bg-bg-dark-muted";

        return (
            <button 
                type="button"
                onClick={toggleDropdown} 
                className={`${baseClass} ${styleClass} ${className}`}
            >
                <UploadCloudIcon className="w-5 h-5" />
                <span>{label}</span>
            </button>
        );
    };

    const cloudProviders: {id: ProviderId, name: string, icon: any}[] = [
        { id: 'google', name: 'Google Drive', icon: GoogleIcon },
        { id: 'dropbox', name: 'Dropbox', icon: DropboxIcon },
        { id: 'onedrive', name: 'OneDrive', icon: OneDriveIcon },
    ];

    return (
        <>
            <div className={`relative inline-block ${buttonStyle === 'icon' ? 'shrink-0' : 'w-full'}`} ref={wrapperRef}>
                {renderButton()}
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleLocalSelect} 
                    multiple={multiple} 
                    accept={accept} 
                    className="hidden" 
                />

                {isOpen && createPortal(
                    <>
                        <div 
                            className={`fixed inset-0 z-[9998] ${buttonStyle === 'dashed' ? 'bg-black/30 backdrop-blur-sm' : ''}`} 
                            onClick={() => setIsOpen(false)}
                        ></div>
                        <div 
                            className={`fixed z-[9999] bg-bg dark:bg-bg-dark-surface rounded-card shadow-2xl border border-border dark:border-border-dark p-2 animate-fade-in overflow-hidden ${buttonStyle === 'dashed' ? '' : 'mt-2'}`}
                            style={
                                buttonStyle === 'dashed' 
                                ? {
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '300px',
                                    maxWidth: '90vw'
                                }
                                : { 
                                    top: dropdownPosition.top, 
                                    left: dropdownPosition.left,
                                    width: '256px',
                                    maxWidth: '90vw'
                                }
                            }
                        >
                            <div className="text-xs font-bold text-text-secondary dark:text-text-dark-secondary px-3 py-2 uppercase tracking-wider">
                                Vælg kilde
                            </div>
                            
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center gap-3 p-3 hover:bg-bg-subtle dark:hover:bg-bg-dark-muted rounded-control transition-colors text-left"
                            >
                                <div className="bg-bg-muted dark:bg-bg-dark-muted p-2 rounded-control">
                                    <FileTextIcon className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-text-primary dark:text-text-dark-primary">Lokal enhed</p>
                                    <p className="text-xs text-text-secondary dark:text-text-dark-secondary">Billeder eller dokumenter</p>
                                </div>
                            </button>

                            {integrationsEnabled && (
                                <>
                                    <div className="h-px bg-border dark:bg-border-dark my-1 mx-2"></div>

                                    {cloudProviders.map(provider => (
                                        <button
                                            key={provider.id}
                                            onClick={() => handleCloudSelect(provider.id)}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-bg-subtle dark:hover:bg-bg-dark-muted rounded-control transition-colors text-left"
                                        >
                                            <div className="bg-brand-subtle dark:bg-brand-subtle-dark p-2 rounded-control flex-shrink-0">
                                                <provider.icon className="w-5 h-5" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-bold text-text-primary dark:text-text-dark-primary truncate">{provider.name}</p>
                                                <p className="text-xs text-text-secondary dark:text-text-dark-secondary truncate">Importer fra skyen</p>
                                            </div>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    </>,
                    document.body
                )}
            </div>
            
            {integrationsEnabled && activeCloudProvider && (
                <CloudFileBrowser 
                    provider={activeCloudProvider} 
                    onClose={() => setActiveCloudProvider(null)} 
                    onFileSelected={(file) => {
                        onFileSelect(file);
                        setActiveCloudProvider(null);
                    }} 
                />
            )}
        </>
    );
};

export default FilePicker;