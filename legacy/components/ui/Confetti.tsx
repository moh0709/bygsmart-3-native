
import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
    isActive: boolean;
    onComplete?: () => void;
}

export const Confetti: React.FC<ConfettiProps> = ({ isActive, onComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        if (!isActive || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles: any[] = [];
        const colors = ['#1E5FFF', '#FFB020', '#1BB55C', '#E5484D', '#F5A524'];
        const particleCount = 150;

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                w: Math.random() * 10 + 5,
                h: Math.random() * 10 + 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20 - 5,
                gravity: 0.5,
                drag: 0.96,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10
            });
        }

        let animationFrameId: number;
        let opacity = 1;

        const render = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (opacity <= 0) {
                if (onComplete) onComplete();
                return;
            }

            particles.forEach(p => {
                p.vx *= p.drag;
                p.vy *= p.drag;
                p.vy += p.gravity;
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotationSpeed;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });

            // Fade out towards end
            opacity -= 0.005;

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [isActive, onComplete]);

    if (!isActive) return null;

    return (
        <canvas 
            ref={canvasRef} 
            className="fixed inset-0 z-[100] pointer-events-none"
        />
    );
};
