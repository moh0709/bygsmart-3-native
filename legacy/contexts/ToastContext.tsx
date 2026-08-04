import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircleIcon, AlertTriangleIcon, XIcon, InfoIcon, MessageCircleIcon } from '../components/icons';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface MessageBanner {
    id: number;
    senderName: string;
    preview: string;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    showMessageBanner: (senderName: string, preview: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_STYLES: Record<ToastType, { container: string; icon: ReactNode }> = {
    success: {
        container: 'bg-success-subtle dark:bg-success-subtle-dark border-success/30',
        icon: <CheckCircleIcon className="w-5 h-5 text-success" />,
    },
    error: {
        container: 'bg-danger-subtle dark:bg-danger-subtle-dark border-danger/30',
        icon: <AlertTriangleIcon className="w-5 h-5 text-danger" />,
    },
    warning: {
        container: 'bg-warning-subtle dark:bg-warning-subtle-dark border-warning/30',
        icon: <AlertTriangleIcon className="w-5 h-5 text-warning" />,
    },
    info: {
        container: 'bg-info-subtle dark:bg-info-subtle-dark border-info/30',
        icon: <InfoIcon className="w-5 h-5 text-info" />,
    },
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [banners, setBanners] = useState<MessageBanner[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const showMessageBanner = useCallback((senderName: string, preview: string) => {
        const id = Date.now();
        setBanners(prev => [...prev, { id, senderName, preview }]);
        setTimeout(() => {
            setBanners(prev => prev.filter(b => b.id !== id));
        }, 5000);
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const removeBanner = (id: number) => {
        setBanners(prev => prev.filter(b => b.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast, showMessageBanner }}>
            {children}
            {createPortal(
                <>
                    {/* Message banners — slide down from top like mobile notifications */}
                    <div
                        role="status"
                        aria-live="polite"
                        aria-label="Beskeder"
                        className="fixed top-[calc(1rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[110] w-full max-w-sm px-4 pointer-events-none"
                    >
                        {banners.map(banner => (
                            <div
                                key={banner.id}
                                className="pointer-events-auto animate-slide-down flex items-center gap-3 px-4 py-3 rounded-card shadow-modal border border-brand-primary/20 bg-white dark:bg-bg-dark-card backdrop-blur-sm"
                            >
                                <div className="shrink-0 w-9 h-9 rounded-full bg-brand-subtle dark:bg-brand-subtle-dark flex items-center justify-center" aria-hidden="true">
                                    <MessageCircleIcon className="w-5 h-5 text-brand-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-text-primary dark:text-text-dark-primary truncate">
                                        {banner.senderName}
                                    </p>
                                    <p className="text-xs text-text-secondary dark:text-text-dark-secondary truncate">
                                        {banner.preview}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeBanner(banner.id)}
                                    aria-label="Luk"
                                    className="shrink-0 -m-1 p-1.5 rounded-control text-text-tertiary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary transition-colors duration-150"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Bottom toasts */}
                    <div
                        role="status"
                        aria-live="polite"
                        className="fixed bottom-20 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[100] w-full max-w-sm px-4 pointer-events-none"
                    >
                        {toasts.map(toast => (
                            <div
                                key={toast.id}
                                className={`pointer-events-auto animate-slide-up flex items-start gap-3 p-3.5 rounded-card shadow-modal border backdrop-blur-sm ${TOAST_STYLES[toast.type].container}`}
                            >
                                <div className="shrink-0 mt-0.5" aria-hidden="true">{TOAST_STYLES[toast.type].icon}</div>
                                <p className="flex-1 text-sm font-medium text-text-primary dark:text-text-dark-primary">
                                    {toast.message}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => removeToast(toast.id)}
                                    aria-label="Luk"
                                    className="shrink-0 -m-1 p-1.5 rounded-control text-text-tertiary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary transition-colors duration-150"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
