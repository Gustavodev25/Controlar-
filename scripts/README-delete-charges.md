# Script para Deletar Cobranças de Usuários Cancelados

## Descrição

Este script identifica todos os usuários com status `canceled` no Firebase e deleta suas cobranças pendentes no Asaas.

## O que o script faz:

1. ✅ Busca todos os usuários com `subscription.status === 'canceled'` no Firebase
2. 🔍 Para cada usuário cancelado, busca cobranças com status `PENDING` no Asaas
3. 🗑️ Deleta todas as cobranças pendentes encontradas
4. 📊 Gera um relatório detalhado do processo

## Como usar:

### 1. Certifique-se de que as variáveis de ambiente estão configuradas:

```bash
ASAAS_API_KEY=sua_chave_aqui
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
VITE_FIREBASE_PROJECT_ID=seu_projeto_id
```

### 2. Execute o script:

```bash
node scripts/delete-canceled-users-charges.js
```

## Segurança:

- ⚠️ O script detecta automaticamente se está em SANDBOX ou PRODUÇÃO baseado na chave API
- 🧪 Se a chave contém 'hmlg', usa o ambiente sandbox
- 🔴 Caso contrário, usa o ambiente de produção

## Exemplo de saída:

```
========================================
🗑️  DELETAR COBRANÇAS DE USUÁRIOS CANCELADOS
========================================

Ambiente: 🔴 PRODUÇÃO
URL: https://www.asaas.com/api/v3

📥 Buscando usuários cancelados no Firebase...
   ✅ Encontrados 15 usuários cancelados

🔄 Processando cobranças pendentes...

   [1/15] João Silva... 🗑️  2 cobrança(s) deletada(s)
   [2/15] Maria Santos... ✅ Sem cobranças pendentes
   [3/15] Pedro Costa... 🗑️  1 cobrança(s) deletada(s)
   ...

========================================
📊 RELATÓRIO FINAL
========================================

Usuários processados: 15
Cobranças deletadas: 8
Usuários sem cobranças: 7
Erros: 0

========================================
🗑️  COBRANÇAS DELETADAS
========================================

✅ João Silva <joao@email.com>
   Cobranças deletadas: 2/2
✅ Pedro Costa <pedro@email.com>
   Cobranças deletadas: 1/1

✅ Processo concluído!
```

## Notas importantes:

- O script NÃO deleta cobranças já pagas ou confirmadas, apenas as PENDENTES
- Usuários com `asaasSubscriptionId` começando com `manual_` são ignorados
- O script adiciona um delay de 300ms entre cada usuário para não sobrecarregar a API do Asaas
- Cobranças duplicadas (encontradas tanto por subscription quanto por customer) são removidas automaticamente

## Troubleshooting:

Se encontrar erros:

1. Verifique se a chave API do Asaas está correta
2. Confirme que o Firebase Service Account tem permissões adequadas
3. Verifique a conexão com a internet
4. Confira se os IDs de assinatura no Firebase correspondem aos do Asaas
