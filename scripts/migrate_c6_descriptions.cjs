/**
 * Script de Migração: Enriquecer descrições de transações C6 Bank
 * 
 * Este script atualiza as descrições genéricas como "PIX RECEBIDO" para
 * descrições detalhadas como "Pix Recebido De Giga Advisors Ltda"
 * usando os dados do campo pluggyRaw.paymentData já salvos no Firebase.
 * 
 * Uso: node scripts/migrate_c6_descriptions.cjs
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(__dirname, '../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath)
    });
}

const db = admin.firestore();

// ============================================================
// Função de enriquecimento (mesma lógica do pluggy.js)
// ============================================================
const enrichTransactionDescription = (tx) => {
    if (!tx) return tx?.description || '';

    const originalDesc = tx.description || '';
    const descLower = originalDesc.toLowerCase();
    const paymentData = tx.paymentData;

    // Se não tem paymentData, retorna descrição original
    if (!paymentData) return originalDesc;

    const payerName = paymentData.payer?.name;
    const receiverName = paymentData.receiver?.name;
    const reason = paymentData.reason;

    // Função auxiliar para formatar nome (Title Case)
    const formatName = (name) => {
        if (!name) return null;
        return name
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Detectar tipo de transação e enriquecer descrição
    const isPix = descLower.includes('pix') || paymentData.paymentMethod === 'PIX';
    const isTed = descLower.includes('ted') || paymentData.paymentMethod === 'TED';
    const isTransfer = descLower.includes('transf') || descLower.includes('transfer');
    const isReceived = descLower.includes('recebido') || descLower.includes('recebid') ||
        descLower.includes('credit') || descLower.includes('entrada') ||
        tx.type === 'CREDIT' || tx.amount > 0;
    const isSent = descLower.includes('enviado') || descLower.includes('enviad') ||
        descLower.includes('debit') || descLower.includes('saida') ||
        descLower.includes('saída') || tx.type === 'DEBIT' || tx.amount < 0;

    // Para PIX/Transferências recebidas, usar nome do pagador
    if ((isPix || isTed || isTransfer) && isReceived && payerName) {
        const formattedName = formatName(payerName);
        if (isPix) {
            return `Pix Recebido De ${formattedName}`;
        } else if (isTed) {
            return `TED Recebido De ${formattedName}`;
        } else {
            return `Transferência Recebida De ${formattedName}`;
        }
    }

    // Para PIX/Transferências enviadas, usar nome do recebedor
    if ((isPix || isTed || isTransfer) && isSent && receiverName) {
        const formattedName = formatName(receiverName);
        if (isPix) {
            return `Pix Enviado Para ${formattedName}`;
        } else if (isTed) {
            return `TED Enviado Para ${formattedName}`;
        } else {
            return `Transferência Enviada Para ${formattedName}`;
        }
    }

    // Se tem reason (motivo da transferência), usar como descrição adicional
    if (reason && reason.trim().length > 0) {
        // Se a descrição original é muito genérica, usar reason como base
        if (descLower === 'pix recebido' || descLower === 'pix enviado' ||
            descLower === 'transf enviada pix' || descLower === 'transferencia pix') {
            return reason;
        }
        // Caso contrário, anexar reason se for diferente
        if (!originalDesc.toLowerCase().includes(reason.toLowerCase())) {
            return `${originalDesc} - ${reason}`;
        }
    }

    // Fallback: retorna descrição original
    return originalDesc;
};

// ============================================================
// Função principal de migração
// ============================================================
async function migrateC6Descriptions() {
    console.log('\n========================================');
    console.log('🔄 MIGRAÇÃO: Enriquecer Descrições C6 Bank');
    console.log('========================================\n');

    try {
        // 1. Buscar todos os usuários
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Total de usuários: ${usersSnapshot.size}\n`);

        let totalUsersWithC6 = 0;
        let totalTransactionsUpdated = 0;
        let totalTransactionsSkipped = 0;

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const userName = userData.displayName || userData.email || userId;

            // 2. Verificar se o usuário tem contas C6 Bank
            const accountsSnapshot = await db
                .collection('users')
                .doc(userId)
                .collection('accounts')
                .get();

            const c6Accounts = [];

            for (const accDoc of accountsSnapshot.docs) {
                const accData = accDoc.data();
                const connectorName = (accData.connectorName || accData.institutionName || '').toLowerCase();

                if (connectorName.includes('c6') || connectorName.includes('c 6')) {
                    c6Accounts.push(accDoc.id);
                }
            }

            if (c6Accounts.length === 0) {
                continue; // Usuário não tem contas C6
            }

            totalUsersWithC6++;
            console.log(`\n👤 ${userName}`);
            console.log(`   Contas C6 encontradas: ${c6Accounts.length}`);

            // 3. Buscar transações dessas contas
            let userTransactionsUpdated = 0;
            let userTransactionsSkipped = 0;

            // 3a. Transações regulares - buscar por cada conta individualmente
            for (const accountId of c6Accounts) {
                const txSnapshot = await db
                    .collection('users')
                    .doc(userId)
                    .collection('transactions')
                    .where('accountId', '==', accountId)
                    .get();

                if (txSnapshot.size > 0) {
                    console.log(`   📝 Transações da conta ${accountId.slice(0, 8)}...: ${txSnapshot.size}`);

                    let batch = db.batch();
                    let batchCount = 0;

                    for (const txDoc of txSnapshot.docs) {
                        const txData = txDoc.data();
                        const pluggyRaw = txData.pluggyRaw;

                        if (!pluggyRaw || !pluggyRaw.paymentData) {
                            userTransactionsSkipped++;
                            continue;
                        }

                        const newDescription = enrichTransactionDescription(pluggyRaw);

                        // Só atualiza se a descrição mudou
                        if (newDescription !== txData.description) {
                            batch.update(txDoc.ref, {
                                description: newDescription,
                                descriptionOriginal: txData.description,
                                migratedAt: new Date().toISOString()
                            });
                            batchCount++;
                            userTransactionsUpdated++;

                            // Log de exemplo
                            if (userTransactionsUpdated <= 5) {
                                console.log(`      ✏️ "${txData.description}" → "${newDescription}"`);
                            }

                            // Commit em batches de 450
                            if (batchCount >= 450) {
                                await batch.commit();
                                batch = db.batch();
                                batchCount = 0;
                            }
                        } else {
                            userTransactionsSkipped++;
                        }
                    }

                    if (batchCount > 0) {
                        await batch.commit();
                    }
                }

                // 3b. Transações de cartão de crédito
                const ccTxSnapshot = await db
                    .collection('users')
                    .doc(userId)
                    .collection('creditCardTransactions')
                    .where('cardId', '==', accountId)
                    .get();

                if (ccTxSnapshot.size > 0) {
                    console.log(`   💳 Transações cartão ${accountId.slice(0, 8)}...: ${ccTxSnapshot.size}`);

                    let ccBatch = db.batch();
                    let ccBatchCount = 0;

                    for (const ccDoc of ccTxSnapshot.docs) {
                        const ccData = ccDoc.data();
                        const pluggyRaw = ccData.pluggyRaw;

                        if (!pluggyRaw || !pluggyRaw.paymentData) {
                            userTransactionsSkipped++;
                            continue;
                        }

                        const newDescription = enrichTransactionDescription(pluggyRaw);

                        if (newDescription !== ccData.description) {
                            ccBatch.update(ccDoc.ref, {
                                description: newDescription,
                                descriptionOriginal: ccData.description,
                                migratedAt: new Date().toISOString()
                            });
                            ccBatchCount++;
                            userTransactionsUpdated++;

                            if (userTransactionsUpdated <= 10) {
                                console.log(`      ✏️ "${ccData.description}" → "${newDescription}"`);
                            }

                            if (ccBatchCount >= 450) {
                                await ccBatch.commit();
                                ccBatch = db.batch();
                                ccBatchCount = 0;
                            }
                        } else {
                            userTransactionsSkipped++;
                        }
                    }

                    if (ccBatchCount > 0) {
                        await ccBatch.commit();
                    }
                }
            }

            console.log(`   ✅ Atualizadas: ${userTransactionsUpdated} | Ignoradas: ${userTransactionsSkipped}`);

            totalTransactionsUpdated += userTransactionsUpdated;
            totalTransactionsSkipped += userTransactionsSkipped;
        }

        console.log('\n========================================');
        console.log('📊 RESUMO DA MIGRAÇÃO');
        console.log('========================================');
        console.log(`👥 Usuários com C6 Bank: ${totalUsersWithC6}`);
        console.log(`✅ Transações atualizadas: ${totalTransactionsUpdated}`);
        console.log(`⏭️ Transações ignoradas: ${totalTransactionsSkipped}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('\n❌ ERRO na migração:', error.message);
        console.error(error.stack);
    }

    process.exit(0);
}

// Executar
migrateC6Descriptions();
