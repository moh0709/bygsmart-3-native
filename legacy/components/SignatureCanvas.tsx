import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
    /** Called whenever the signature changes; null when the canvas is cleared. */
    onSignatureChange?: (dataUrl: string | null) => void;
    width?: number;
    height?: number;
    disabled?: boolean;
    label?: string;
}

/**
 * Touch- and mouse-capable signature canvas.
 * Passes the PNG dataURL up via onSignatureChange on every stroke end.
 */
const SignatureCanvas: React.FC<Props> = ({
    onSignatureChange,
    width = 400,
    height = 160,
    disabled = false,
    label = 'Tegn din underskrift herunder',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [isEmpty, setIsEmpty] = useState(true);

    // Init canvas context once.
    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    const getPos = (
        e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
        canvas: HTMLCanvasElement
    ): { x: number; y: number } => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            const t = e.touches[0];
            return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const onStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        drawing.current = true;
        const pos = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const onMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!drawing.current || disabled) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const pos = getPos(e, canvas);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const onEnd = useCallback(() => {
        if (!drawing.current) return;
        drawing.current = false;
        const canvas = canvasRef.current;
        if (!canvas) return;
        setIsEmpty(false);
        onSignatureChange?.(canvas.toDataURL('image/png'));
    }, [onSignatureChange]);

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
        onSignatureChange?.(null);
    };

    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">{label}</p>
            <div
                className={`rounded-xl overflow-hidden border-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'} ${isEmpty ? 'border-dashed border-border-strong bg-bg-subtle dark:bg-bg-dark-muted' : 'border-border-strong bg-bg dark:bg-bg-dark-surface'}`}
                style={{ touchAction: 'none' }}
            >
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    className="w-full block"
                    style={{ background: 'transparent', touchAction: 'none' }}
                    onMouseDown={onStart}
                    onMouseMove={onMove}
                    onMouseUp={onEnd}
                    onMouseLeave={onEnd}
                    onTouchStart={onStart}
                    onTouchMove={onMove}
                    onTouchEnd={onEnd}
                />
            </div>
            <div className="flex items-center justify-between min-h-[20px]">
                <span className={`text-xs ${isEmpty ? 'text-text-tertiary dark:text-text-dark-tertiary' : 'text-success-strong dark:text-success font-medium'}`}>
                    {isEmpty ? 'Ingen underskrift endnu' : '✓ Underskrift registreret'}
                </span>
                {!isEmpty && !disabled && (
                    <button
                        type="button"
                        onClick={clear}
                        className="text-xs text-danger-strong dark:text-danger hover:opacity-80 font-medium transition-opacity"
                    >
                        Ryd
                    </button>
                )}
            </div>
        </div>
    );
};

export default SignatureCanvas;
