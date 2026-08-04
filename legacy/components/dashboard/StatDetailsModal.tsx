import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, ListRow, Modal } from '../ui';
import type { BadgeVariant } from '../ui';

export interface StatDetailsItem {
    id: string;
    title: string;
    subtitle?: string;
    link: string;
    icon?: React.FC<{className?: string}>;
    chip?: { label: string, color: string };
}

/** Maps legacy chip colour names (HomePage callers) onto kit Badge variants. */
const CHIP_VARIANTS: Record<string, BadgeVariant> = {
    blue: 'info',
    red: 'danger',
    yellow: 'warning',
    green: 'success',
    purple: 'brand',
    gray: 'neutral',
};

export const StatDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: StatDetailsItem[];
}> = ({ isOpen, onClose, title, items }) => {
    const navigate = useNavigate();

    const handleItemClick = (link: string) => {
        onClose();
        navigate(link.startsWith('#') ? link.substring(1) : link);
    };

    return (
        <Modal open={isOpen} onClose={onClose} title={title} size="sm">
            {items.length > 0 ? (
                <div className="-mx-5 divide-y divide-border dark:divide-border-dark">
                    {items.map(item => (
                        <ListRow
                            key={item.id}
                            leading={item.icon ? (
                                <span
                                    className="flex w-9 h-9 items-center justify-center rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light"
                                    aria-hidden="true"
                                >
                                    <item.icon className="w-5 h-5" />
                                </span>
                            ) : undefined}
                            title={item.title}
                            subtitle={item.subtitle}
                            trailing={item.chip ? (
                                <Badge variant={CHIP_VARIANTS[item.chip.color] ?? 'neutral'}>{item.chip.label}</Badge>
                            ) : undefined}
                            onClick={() => handleItemClick(item.link)}
                        />
                    ))}
                </div>
            ) : (
                <p className="py-8 text-center text-body text-text-secondary dark:text-text-dark-secondary">
                    Ingen elementer at vise.
                </p>
            )}
        </Modal>
    );
};
