
import { sendSaleToUtmify } from './utmifyService.js'; // Usando sendSale mas com status refunded
import { loadEnv } from './env.js';
import axios from 'axios';

loadEnv();

const UTMIFY_API_URL = 'https://api.utmify.com.br/api-credentials/orders';
const UTMIFY_API_TOKEN = process.env.UTMIFY_API_TOKEN || 'TK4etjqIpXqxGfhl0WQAfwM8K1yQx5OW9lqq';
const TEST_ORDER_ID = 'TEST_ORDER_1767912897757';

console.log(`>>> Enviando payload completo de estorno para ${TEST_ORDER_ID}...`);

async function forceRefund() {
    const now = new Date().toISOString();

    // Payload completo idêntico ao da venda, mas com status refunded
    const payload = {
        orderId: TEST_ORDER_ID,
        platform: 'api',
        paymentMethod: 'credit_card',
        status: 'refunded', // O PULO DO GATO
        createdAt: now,
        approvedDate: now,
        refundedAt: now,
        customer: {
            name: 'Cliente Teste Utmify',
            email: 'teste@utmify.com',
            phone: '11999999999',
            document: '12345678900'
        },
        products: [
            {
                id: 'pro',
                name: 'Plano Pro - Mensal',
                planName: 'Plano Pro - Mensal',
                planId: 'pro',
                quantity: 1,
                priceInCents: 3590
            }
        ],
        trackingParameters: {
            src: 'teste_manual',
            sck: '',
            utm_source: 'teste_manual',
            utm_medium: 'script',
            utm_campaign: 'validacao_api',
            utm_content: '',
            utm_term: ''
        },
        commission: {
            totalPriceInCents: 3590,
            gatewayFeeInCents: 0,
            totalCommissionInCents: 3590,
            userCommissionInCents: 3590
        }
    };

    try {
        const response = await axios.post(UTMIFY_API_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-token': UTMIFY_API_TOKEN
            },
            timeout: 10000
        });
        console.log('✅ ESTORNO ENVIADO COM SUCESSO:', response.data);
    } catch (error) {
        console.error('❌ ERRO:', error.response?.data || error.message);
    }
}

forceRefund();
