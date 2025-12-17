# Visualização de Projeção de Cupons

Esta funcionalidade permite visualizar a projeção de pagamentos futuros dos assinantes, considerando as regras complexas de cupons (Descontos Progressivos, Fixos ou Porcentagem).

## Como Usar

1. Acesse o Painel Admin (`/admin`).
2. Vá para a aba **Assinaturas**.
3. No canto superior direito, você verá um alternador de visualização:
   - **Lista**: Visualização padrão com status e detalhes.
   - **Projeção (Cupons)**: Nova visualização em tabela mensal.

## Como Funciona a Lógica

A projeção é calculada em tempo real baseada nos dados do usuário e do cupom:

1. **Start Date**: O sistema usa a data de início da assinatura (`startDate`) para determinar em qual "mês de vida" a assinatura está (Mês 1, Mês 2, etc.).
   - *Nota*: Para assinaturas antigas sem `startDate`, o sistema usa a `nextBillingDate` como base aproximada. Novas assinaturas salvam a data exata.

2. **Aplicação do Cupom**:
   - **Progressivo**: O sistema verifica a regra específica para o mês da assinatura (ex: Mês 1 = 100%, Mês 2 = 50%).
   - **Fixo/Porcentagem**: Aplica o desconto padrão em todos os meses futuros.

3. **Colunas**: As colunas representam os próximos 12 meses a partir de hoje. O valor exibido na célula é o valor estimado que será cobrado naquela fatura.

## Arquivos Modificados

- `components/AdminSubscriptions.tsx`: Implementação da tabela e lógica de cálculo.
- `components/SubscriptionPage.tsx`: Atualizado para salvar `couponUsed` e `startDate` no momento da compra.
- `services/database.ts`: Adicionada função `getCouponById`.
- `types.ts`: Atualizada interface de User para incluir novos campos.
