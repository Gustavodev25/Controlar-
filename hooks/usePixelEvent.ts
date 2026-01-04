import { useCallback } from 'react';

declare global {
    interface Window {
        fbq: any;
    }
}

// Gera um eventID único para deduplicação com a API de Conversões
const generateEventId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const usePixelEvent = () => {
    const trackEvent = useCallback((eventName: string, data: Record<string, any> = {}, customEventId?: string) => {
        if (typeof window !== 'undefined' && window.fbq) {
            // Usa o eventID customizado ou gera um novo
            const eventID = customEventId || generateEventId();

            window.fbq('track', eventName, data, { eventID });
            console.log('Meta Pixel event:', eventName, data, 'eventID:', eventID);

            return eventID; // Retorna o eventID para usar na API de Conversões
        } else {
            console.warn('Meta Pixel (fbq) não encontrado');
            return null;
        }
    }, []);

    return { trackEvent };
};
