/**
 * Script para gerar links de pagamento para cobranças vencidas
 * O cliente pode usar esses links para pagar com cartão
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const BASE_URL = 'https://api.asaas.com/v3';

async function asaasRequest(endpoint) {
    const res = await fetch(BASE_URL + endpoint, {
        headers: { 'access_token': ASAAS_API_KEY }
    });
    return res.json();
}

async function main() {
    console.log('\n========================================');
    console.log('🔗 GERANDO LINKS DE PAGAMENTO');
    console.log('========================================\n');

    // Buscar todos os pagamentos OVERDUE
    const result = await asaasRequest('/payments?status=OVERDUE&limit=100');
    const overduePayments = result.data || [];

    console.log(`Encontrados ${overduePayments.length} pagamentos vencidos\n`);

    const links = [];

    for (const payment of overduePayments) {
        // Buscar dados do cliente
        const customer = await asaasRequest('/customers/' + payment.customer);

        console.log('----------------------------------------');
        console.log(`👤 Cliente: ${customer.name}`);
        console.log(`📧 Email: ${customer.email}`);
        console.log(`💰 Valor: R$ ${payment.value?.toFixed(2)}`);
        console.log(`📅 Vencimento: ${payment.dueDate}`);
        console.log(`🔗 Link de pagamento: ${payment.invoiceUrl}`);
        console.log('');

        links.push({
            name: customer.name,
            email: customer.email,
            value: payment.value,
            dueDate: payment.dueDate,
            invoiceUrl: payment.invoiceUrl,
            paymentId: payment.id
        });
    }

    // Resumo para copiar/colar
    console.log('\n========================================');
    console.log('📋 RESUMO PARA ENVIAR AOS CLIENTES');
    console.log('========================================\n');

    for (const link of links) {
        console.log(`📨 ${link.name} (${link.email})`);
        console.log(`   Valor: R$ ${link.value?.toFixed(2)} - Vencido em: ${link.dueDate}`);
        console.log(`   Link: ${link.invoiceUrl}`);
        console.log('');
    }

    // Template de mensagem
    console.log('\n========================================');
    console.log('📝 MODELO DE MENSAGEM PARA ENVIAR');
    console.log('========================================\n');

    console.log('Olá [NOME],\n');
    console.log('Identificamos que o pagamento da sua assinatura do Controlar está pendente.');
    console.log('Por favor, regularize o pagamento no link abaixo:\n');
    console.log('[LINK]\n');
    console.log('Valor: R$ XX,XX');
    console.log('Vencimento original: XX/XX/XXXX\n');
    console.log('Após o pagamento, seu acesso será restaurado automaticamente.');
    console.log('Qualquer dúvida, estamos à disposição!\n');
    console.log('Atenciosamente,');
    console.log('Equipe Controlar');

    console.log('\n✅ Script finalizado!\n');
}

main().catch(console.error);
