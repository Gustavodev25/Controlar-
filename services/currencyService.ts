/**
 * Currency Exchange Service
 * Serviço de conversão de moedas em tempo real
 * Usa a API gratuita exchangerate-api.com
 */

interface ExchangeRates {
    base: string;
    rates: Record<string, number>;
    lastUpdated: number;
}

// Cache das cotações (válido por 1 hora)
let cachedRates: ExchangeRates | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora em ms

/**
 * Busca as cotações de câmbio em tempo real
 * @returns Promise com as cotações
 */
export const fetchExchangeRates = async (): Promise<ExchangeRates> => {
    // Retorna cache se ainda válido
    if (cachedRates && Date.now() - cachedRates.lastUpdated < CACHE_DURATION) {
        return cachedRates;
    }

    try {
        // API gratuita de câmbio - base USD
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');

        if (!response.ok) {
            throw new Error('Falha ao buscar cotações');
        }

        const data = await response.json();

        cachedRates = {
            base: 'USD',
            rates: data.rates,
            lastUpdated: Date.now()
        };

        // Log removed

        return cachedRates;
    } catch (error) {
        console.error('[ExchangeService] Erro ao buscar cotações:', error);

        // Fallback com cotação aproximada se API falhar
        if (!cachedRates) {
            cachedRates = {
                base: 'USD',
                rates: {
                    BRL: 5.39, // Cotação aproximada de fallback
                    EUR: 0.92,
                    GBP: 0.79,
                    USD: 1
                },
                lastUpdated: Date.now()
            };
        }

        return cachedRates;
    }
};

/**
 * Converte um valor de uma moeda para outra
 * @param amount - Valor a converter
 * @param fromCurrency - Moeda de origem (ex: 'USD')
 * @param toCurrency - Moeda de destino (ex: 'BRL')
 * @returns Valor convertido
 */
export const convertCurrency = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string = 'BRL'
): Promise<number> => {
    if (fromCurrency === toCurrency) {
        return amount;
    }

    const rates = await fetchExchangeRates();

    // Converter de qualquer moeda para USD primeiro, depois para destino
    let valueInUSD = amount;

    if (fromCurrency !== 'USD') {
        const fromRate = rates.rates[fromCurrency];
        if (!fromRate) {
            console.warn(`[ExchangeService] Moeda não encontrada: ${fromCurrency}`);
            return amount;
        }
        valueInUSD = amount / fromRate;
    }

    // Converter de USD para moeda de destino
    const toRate = rates.rates[toCurrency];
    if (!toRate) {
        console.warn(`[ExchangeService] Moeda não encontrada: ${toCurrency}`);
        return amount;
    }

    return valueInUSD * toRate;
};

/**
 * Retorna a cotação atual de uma moeda em relação ao BRL
 * @param currency - Código da moeda (ex: 'USD')
 * @returns Cotação em BRL
 */
export const getExchangeRate = async (currency: string): Promise<number> => {
    if (currency === 'BRL') return 1;

    const rates = await fetchExchangeRates();
    const brlRate = rates.rates.BRL || 5.39;
    const currencyRate = rates.rates[currency] || 1;

    // Retorna quantos BRL vale 1 unidade da moeda
    return brlRate / currencyRate;
};

/**
 * Hook de cotação síncrono (usa cache)
 * Para uso em renderização sem await
 */
export const getExchangeRateSync = (currency: string): number => {
    if (currency === 'BRL') return 1;

    if (!cachedRates) {
        // Dispara busca assíncrona para popular cache
        fetchExchangeRates();
        // Retorna valor de fallback
        const fallbackRates: Record<string, number> = {
            USD: 5.39,
            EUR: 5.85,
            GBP: 6.80
        };
        return fallbackRates[currency] || 5.39;
    }

    const brlRate = cachedRates.rates.BRL || 5.39;
    const currencyRate = cachedRates.rates[currency] || 1;

    return brlRate / currencyRate;
};

/**
 * Formata valor com conversão para BRL
 * @param amount - Valor na moeda original
 * @param fromCurrency - Moeda original
 * @returns String formatada em BRL
 */
export const formatWithConversion = (amount: number, fromCurrency: string): string => {
    const rate = getExchangeRateSync(fromCurrency);
    const convertedAmount = Math.abs(amount) * rate;

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(convertedAmount);
};
