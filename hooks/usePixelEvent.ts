import { useCallback } from 'react';

declare global {
    interface Window {
        fbq: any;
    }
}

export const usePixelEvent = () => {
    const trackEvent = useCallback((eventName: string, data: Record<string, any> = {}) => {
        if (typeof window !== 'undefined' && window.fbq) {
            window.fbq('track', eventName, data);
            console.log('Meta Pixel event:', eventName, data);
        } else {
            console.warn('Meta Pixel (fbq) não encontrado');
        }
    }, []);

    return { trackEvent };
};
