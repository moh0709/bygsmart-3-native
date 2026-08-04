import React, { useState, useEffect, useRef } from 'react';

const AnimatedNumber: React.FC<{ value: number, precision?: number }> = ({ value, precision = 2 }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const prevValueRef = useRef(0);

    useEffect(() => {
        let startTimestamp: number | null = null;
        const duration = 500;
        const startValue = prevValueRef.current;
        const endValue = value;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = startValue + progress * (endValue - startValue);
            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                prevValueRef.current = endValue;
            }
        };

        requestAnimationFrame(step);

        return () => {
             prevValueRef.current = value;
        }

    }, [value]);

    return <span className="tabular-nums">{displayValue.toFixed(precision)}</span>;
};

export default AnimatedNumber;
