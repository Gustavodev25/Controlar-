
// Script de Simulação: Confirmação de Assinaturas
// Este script simula a lógica exata que implementamos no sistema para confirmar pagamentos.

console.log("🚀 Iniciando Simulação de Confirmação de Assinaturas...\n");

// 1. Definição da Lógica (Cópia da implementação real)
const normalizeDescription = (desc) => {
    if (!desc) return '';
    return desc
        .toLowerCase()
        .replace(/\d{2}\/\d{2}/g, '')
        .replace(/\d+x/gi, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const processedResult = [];

const simulateSync = (subscriptionName, transactionDesc, transactionDate, closingDay) => {
    console.log(`\n---------------------------------------------------`);
    console.log(`🧪 TESTE: Assinatura "${subscriptionName}"`);
    console.log(`   Transação: "${transactionDesc}" em ${transactionDate}`);
    console.log(`   Dia Fechamento Cartão: ${closingDay}`);

    const subNameNorm = normalizeDescription(subscriptionName);
    const txDescNorm = normalizeDescription(transactionDesc);

    // 1. Match de Nome
    const isMatch = txDescNorm.includes(subNameNorm);

    if (!isMatch) {
        console.log(`❌ Não combinou (Nomes diferentes)`);
        return;
    }
    console.log(`✅ MATCH de Nome confirmado!`);

    // 2. Cálculo do Mês da Fatura
    const txDate = new Date(transactionDate);
    const day = txDate.getDate();
    let invoiceMonthDate = new Date(transactionDate);

    // Lógica de virada de fatura
    if (day > closingDay) {
        console.log(`   📅 Data (${day}) é DEPOIS do fechamento (${closingDay}). Vai para o próximo mês.`);
        invoiceMonthDate.setMonth(invoiceMonthDate.getMonth() + 1);
    } else {
        console.log(`   📅 Data (${day}) é ANTES do fechamento (${closingDay}). Fica no mês atual.`);
    }

    const paidMonthKey = `${invoiceMonthDate.getFullYear()}-${String(invoiceMonthDate.getMonth() + 1).padStart(2, '0')}`;
    console.log(`🎯 Mês Confirmado (Pago): ${paidMonthKey}`);
};

// ==========================================
// CENÁRIOS DE TESTE
// ==========================================

// Cenário 1: Netflix no meio do mês, antes do fechamento
simulateSync(
    "Netflix",
    "Netflix.com Sao Paulo",
    "2024-02-05",
    10 // Fechamento dia 10
);

// Cenário 2: Spotify cobrado DEPOIS do fechamento (fatura vira)
simulateSync(
    "Spotify",
    "Spotify Premium",
    "2024-02-15",
    10 // Fechamento dia 10
);

// Cenário 3: Amazon Prime em um cartão com fechamento dia 1 (compra dia 2)
simulateSync(
    "Amazon Prime",
    "Amazon Prime Channels",
    "2024-03-02",
    1 // Fechamento dia 1
);

// Cenário 4: Não deve confirmar (nomes nada a ver)
simulateSync(
    "Globoplay",
    "Uber *Trip Warning",
    "2024-02-15",
    10
);

console.log("\n✅ Simulação Concluída!");
