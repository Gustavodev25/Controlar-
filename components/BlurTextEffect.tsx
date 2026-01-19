import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface BlurTextEffectProps {
    children: string;
    className?: string;
    triggerOnScroll?: boolean;
}

export const BlurTextEffect: React.FC<BlurTextEffectProps> = ({ children, className = '', triggerOnScroll = true }) => {
    const containerRef = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        if (!containerRef.current) return;

        const chars = containerRef.current.querySelectorAll('span.char');

        gsap.set(chars, { opacity: 0, y: 10, filter: 'blur(8px)' });

        const timeline = gsap.to(chars, {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.3,
            ease: 'power2.out',
            stagger: 0.015,
            scrollTrigger: triggerOnScroll ? {
                trigger: containerRef.current,
                start: 'top 90%',
                toggleActions: 'play none none none',
            } : undefined,
        });

        return () => {
            timeline.kill();
            if (timeline.scrollTrigger) {
                timeline.scrollTrigger.kill();
            }
        };
    }, [children, triggerOnScroll]);

    return (
        <span className={`inline-block ${className}`} ref={containerRef}>
            {children.split(' ').map((word, wordIndex, array) => (
                <span key={`word-${wordIndex}`} className="inline-block whitespace-nowrap">
                    {word.split('').map((char, charIndex) => (
                        <span key={`char-${wordIndex}-${charIndex}`} className="char inline-block">
                            {char}
                        </span>
                    ))}
                    {wordIndex < array.length - 1 && (
                        <span className="char inline-block">&nbsp;</span>
                    )}
                </span>
            ))}
        </span>
    );
};
