import React, { useState, useEffect } from 'react';
import { resolveFileUrl } from '../../../../utils/fileUtils';
import { XIcon } from '../../../../components/icons';

// ─── Helper Components ────────────────────────────────────────────────────────

export const ImageViewModal: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
    const [resolvedSrc, setResolvedSrc] = useState('');
    useEffect(() => { resolveFileUrl(src).then(setResolvedSrc); }, [src]);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={onClose}>
            <button
                type="button"
                onClick={onClose}
                aria-label="Luk billedvisning"
                className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20"
            >
                <XIcon className="w-6 h-6" />
            </button>
            {resolvedSrc
                ? <img src={resolvedSrc} alt={alt} className="max-w-full max-h-full object-contain rounded-card" onClick={e => e.stopPropagation()} />
                : <div className="text-white text-label">Indlæser…</div>}
        </div>
    );
};
