import { useEffect, useRef } from 'react';

declare global {
    interface Window {
        fbq: any;
    }
}

// Gera um eventID único para deduplicação com a API de Conversões
const generateEventId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

interface PixelPageViewTrackerProps {
    activeTab: string;
}

export function PixelPageViewTracker({ activeTab }: PixelPageViewTrackerProps) {
    const prevTab = useRef<string | null>(null);

    useEffect(() => {
        // Only track if activeTab has actually changed
        if (activeTab !== prevTab.current) {
            if (typeof window !== 'undefined' && window.fbq) {
                const eventID = generateEventId();
                window.fbq('track', 'PageView', {}, { eventID });
                console.log('Meta Pixel PageView:', activeTab, 'eventID:', eventID);
            }
            prevTab.current = activeTab;
        }
    }, [activeTab]);

    return null;
}
