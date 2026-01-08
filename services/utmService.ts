/**
 * UTM Service - Gerencia captura e persistência de parâmetros UTM
 * 
 * Usado para rastreamento de campanhas de marketing com Utmify
 */

export interface UtmData {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    src?: string;        // Utmify source
    sck?: string;        // Utmify click cookie
}

const UTM_STORAGE_KEY = 'controlar_utm_data';
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'];

/**
 * Captura parâmetros UTM da URL atual e salva no localStorage
 */
export function captureUtmFromUrl(): void {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const utmData: UtmData = {};
        let hasUtm = false;

        UTM_PARAMS.forEach((param) => {
            const value = urlParams.get(param);
            if (value) {
                utmData[param as keyof UtmData] = value;
                hasUtm = true;
            }
        });

        // Apenas salva se houver algum parâmetro UTM
        if (hasUtm) {
            // Adiciona timestamp
            const dataToStore = {
                ...utmData,
                capturedAt: new Date().toISOString()
            };

            localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(dataToStore));
            console.log('[UTM] Parâmetros capturados:', utmData);
        }
    } catch (error) {
        console.warn('[UTM] Erro ao capturar UTMs:', error);
    }
}

/**
 * Recupera parâmetros UTM salvos no localStorage
 */
export function getUtmData(): UtmData | null {
    try {
        const stored = localStorage.getItem(UTM_STORAGE_KEY);
        if (!stored) return null;

        const data = JSON.parse(stored);

        // Verifica se os dados não são muito antigos (30 dias)
        if (data.capturedAt) {
            const capturedDate = new Date(data.capturedAt);
            const daysSinceCaptured = (Date.now() - capturedDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceCaptured > 30) {
                clearUtmData();
                return null;
            }
        }

        // Remove o timestamp antes de retornar
        const { capturedAt, ...utmData } = data;
        return utmData;
    } catch (error) {
        console.warn('[UTM] Erro ao recuperar UTMs:', error);
        return null;
    }
}

/**
 * Limpa os dados de UTM salvos
 */
export function clearUtmData(): void {
    try {
        localStorage.removeItem(UTM_STORAGE_KEY);
    } catch (error) {
        console.warn('[UTM] Erro ao limpar UTMs:', error);
    }
}

/**
 * Verifica se existem UTMs salvos
 */
export function hasUtmData(): boolean {
    return !!localStorage.getItem(UTM_STORAGE_KEY);
}

/**
 * Combina UTMs salvos com dados do cookie do Utmify (se disponível)
 */
export function getCompleteUtmData(): UtmData {
    const savedUtm = getUtmData() || {};

    // Tenta pegar o sck do cookie do Utmify (se o script estiver carregado)
    try {
        const utmifyCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('__utmify='));

        if (utmifyCookie) {
            const cookieValue = utmifyCookie.split('=')[1];
            if (cookieValue && !savedUtm.sck) {
                savedUtm.sck = cookieValue;
            }
        }
    } catch (error) {
        // Ignora erro de cookie
    }

    return savedUtm;
}

export default {
    captureUtmFromUrl,
    getUtmData,
    clearUtmData,
    hasUtmData,
    getCompleteUtmData
};
