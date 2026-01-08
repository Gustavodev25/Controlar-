/**
 * Utmify Service - Envia dados de vendas para rastreamento
 * 
 * API: https://api.utmify.com.br/api-credentials/orders
 * Docs: https://docs.utmify.com.br
 */

import axios from 'axios';

const UTMIFY_API_URL = 'https://api.utmify.com.br/api-credentials/orders';
const UTMIFY_API_TOKEN = process.env.UTMIFY_API_TOKEN || 'TK4etjqIpXqxGfhl0WQAfwM8K1yQx5OW9lqq';

/**
 * Envia uma venda confirmada para o Utmify
 * 
 * @param {Object} saleData - Dados da venda
 * @param {string} saleData.orderId - ID único do pedido (payment.id ou subscription.id)
 * @param {string} saleData.paymentMethod - Método de pagamento: 'credit_card', 'pix', 'boleto'
 * @param {string} saleData.status - Status: 'paid', 'refunded', 'pending'
 * @param {number} saleData.valueInCents - Valor total em centavos
 * @param {Object} saleData.customer - Dados do cliente
 * @param {string} saleData.customer.name - Nome do cliente
 * @param {string} saleData.customer.email - E-mail do cliente
 * @param {string} saleData.customer.phone - Telefone do cliente
 * @param {string} saleData.customer.document - CPF/CNPJ do cliente
 * @param {Object} saleData.product - Dados do produto/plano
 * @param {string} saleData.product.id - ID do plano
 * @param {string} saleData.product.name - Nome do plano
 * @param {Object} saleData.utmData - Parâmetros UTM capturados
 */
export async function sendSaleToUtmify(saleData) {
    if (!UTMIFY_API_TOKEN) {
        console.warn('>>> [UTMIFY] Token não configurado. Ignorando envio.');
        return null;
    }

    try {
        const now = new Date().toISOString();

        const payload = {
            orderId: saleData.orderId,
            platform: 'api',
            paymentMethod: saleData.paymentMethod || 'credit_card',
            status: saleData.status || 'paid',
            createdAt: now,
            approvedDate: now,
            refundedAt: null,
            customer: {
                name: saleData.customer?.name || '',
                email: saleData.customer?.email || '',
                phone: saleData.customer?.phone?.replace(/\D/g, '') || '',
                document: saleData.customer?.document?.replace(/\D/g, '') || ''
            },
            products: [
                {
                    id: saleData.product?.id || 'pro',
                    name: saleData.product?.name || 'Plano Pro',
                    planId: saleData.product?.id || 'pro',
                    quantity: 1,
                    priceInCents: saleData.valueInCents || 0
                }
            ],
            trackingParameters: {
                src: saleData.utmData?.utm_source || saleData.utmData?.src || '',
                sck: saleData.utmData?.sck || saleData.utmData?.utm_campaign || '',
                utm_source: saleData.utmData?.utm_source || '',
                utm_medium: saleData.utmData?.utm_medium || '',
                utm_campaign: saleData.utmData?.utm_campaign || '',
                utm_content: saleData.utmData?.utm_content || '',
                utm_term: saleData.utmData?.utm_term || ''
            },
            commission: {
                totalPriceInCents: saleData.valueInCents || 0,
                gatewayFeeInCents: 0,
                totalCommissionInCents: saleData.valueInCents || 0
            }
        };

        console.log(`>>> [UTMIFY] Enviando venda ${saleData.orderId}...`);

        const response = await axios.post(UTMIFY_API_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-token': UTMIFY_API_TOKEN
            },
            timeout: 10000 // 10 segundos
        });

        console.log(`>>> [UTMIFY] Venda enviada com sucesso:`, response.data);
        return response.data;

    } catch (error) {
        // Log do erro mas não bloqueia o fluxo principal
        console.error(`>>> [UTMIFY] Erro ao enviar venda:`, error.response?.data || error.message);
        return null;
    }
}

/**
 * Envia estorno para o Utmify
 */
export async function sendRefundToUtmify(orderId) {
    if (!UTMIFY_API_TOKEN) {
        console.warn('>>> [UTMIFY] Token não configurado. Ignorando envio de estorno.');
        return null;
    }

    try {
        const payload = {
            orderId: orderId,
            status: 'refunded',
            refundedAt: new Date().toISOString()
        };

        console.log(`>>> [UTMIFY] Enviando estorno ${orderId}...`);

        const response = await axios.post(UTMIFY_API_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-token': UTMIFY_API_TOKEN
            },
            timeout: 10000
        });

        console.log(`>>> [UTMIFY] Estorno enviado com sucesso:`, response.data);
        return response.data;

    } catch (error) {
        console.error(`>>> [UTMIFY] Erro ao enviar estorno:`, error.response?.data || error.message);
        return null;
    }
}

export default { sendSaleToUtmify, sendRefundToUtmify };
