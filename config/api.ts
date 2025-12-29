// API Configuration
// Switch between Vercel (serverless) and Railway (dedicated server) backends

// For Vercel backend (default - same domain)
// export const API_BASE = '/api';

// For Railway backend (dedicated server)
// export const API_BASE = 'https://YOUR_RAILWAY_URL.railway.app/api';

// Auto-detect based on environment variable
const RAILWAY_API_URL = import.meta.env.VITE_API_URL;

export const API_BASE = RAILWAY_API_URL || '/api';

// Helper to check if using external API
export const isExternalApi = () => API_BASE.startsWith('http');

// API endpoints
export const API_ENDPOINTS = {
    // Pluggy
    pluggy: {
        createToken: `${API_BASE}/pluggy/create-token`,
        sync: `${API_BASE}/pluggy/sync`,
        triggerSync: `${API_BASE}/pluggy/trigger-sync`,
        items: `${API_BASE}/pluggy/items`,
        itemsStatus: `${API_BASE}/pluggy/items-status`,
        deleteItem: (itemId: string) => `${API_BASE}/pluggy/item/${itemId}`,
    },
    // Asaas
    asaas: {
        subscription: `${API_BASE}/asaas/subscription`,
        cancelSubscription: `${API_BASE}/asaas/cancel-subscription`,
        validateCard: `${API_BASE}/asaas/validate-card`,
    },
    // Email
    email: {
        send: `${API_BASE}/send-email`,
        sendAll: `${API_BASE}/send-email-all`,
    },
    // AI
    ai: {
        chat: `${API_BASE}/ai/chat`,
    },
} as const;
