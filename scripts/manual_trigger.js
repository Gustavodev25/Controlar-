// Script to manually trigger Pluggy Sync via the new backend flow
// Usage: node scripts/manual_trigger.js

import fetch from 'node-fetch'; 

const BASE_URL = 'http://localhost:3000/api/pluggy';
const USER_ID = 'kx7nssUhM5eZXk1fm2es4VJfV4p1'; 

async function run() {
  try {
    console.log(`>>> Buscando Item IDs no Banco de Dados para o usuário ${USER_ID}...`);
    
    // 1. Fetch Item IDs from DB (Bypassing Pluggy /items 401)
    const itemsRes = await fetch(`${BASE_URL}/db-items/${USER_ID}`);
    const itemsData = await itemsRes.json();

    if (!itemsData.success) {
      console.error('❌ Erro ao buscar itens do banco:', itemsData);
      return;
    }

    if (!itemsData.itemIds || itemsData.itemIds.length === 0) {
      console.log('⚠️ Nenhuma conexão (itemId) encontrada no banco de dados para este usuário.');
      return;
    }

    console.log(`✅ Encontrados ${itemsData.itemIds.length} items:`, itemsData.itemIds);

    // 2. Trigger Sync for each item
    for (const itemId of itemsData.itemIds) {
      console.log(`
🔄 Disparando sincronização para Item ID: ${itemId}`);
      
      const triggerRes = await fetch(`${BASE_URL}/trigger-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });

      const triggerData = await triggerRes.json();
      
      if (triggerData.success) {
        console.log('✅ Comando enviado com sucesso!');
        console.log('⏳ A Pluggy iniciará a atualização. Aguarde os logs do Webhook no terminal do servidor.');
      } else {
        console.error('❌ Falha ao disparar:', triggerData);
      }
    }

  } catch (error) {
    console.error('Erro de execução:', error.message);
    console.log('Certifique-se de que o servidor está rodando em localhost:3000');
  }
}

run();
