import React, { useState, useEffect } from 'react';
import { resolveFileUrl } from '../../../../utils/fileUtils';
import { cn } from '../../../../components/ui';

export const ResolvedImage: React.FC<{ src: string; alt: string; className?: string; onClick?: () => void }> = ({ src, alt, className, onClick }) => {
    const [resolvedSrc, setResolvedSrc] = useState('');
    useEffect(() => {
        let active = true;
        resolveFileUrl(src).then(url => { if (active) setResolvedSrc(url); });
        return () => { active = false; };
    }, [src]);
    if (!resolvedSrc) return <div className={cn('animate-pulse bg-bg-muted dark:bg-bg-dark-muted', className)}></div>;
    return <img src={resolvedSrc} alt={alt} className={className} onClick={onClick} />;
};
