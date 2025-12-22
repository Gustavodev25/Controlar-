import { useEffect, useRef } from 'react';

declare global {
    interface Window {
        fbq: any;
    }
}

interface PixelPageViewTrackerProps {
    activeTab: string;
}

export function PixelPageViewTracker({ activeTab }: PixelPageViewTrackerProps) {
    const prevTab = useRef<string | null>(null);

    useEffect(() => {
        // Only track if activeTab has actually changed
        if (activeTab !== prevTab.current) {
            if (typeof window !== 'undefined' && window.fbq) {
                window.fbq('track', 'PageView');
                console.log('Meta Pixel PageView:', activeTab);
            }
            prevTab.current = activeTab;
        }
    }, [activeTab]);

    return null;
}
