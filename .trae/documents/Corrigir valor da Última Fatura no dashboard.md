## Diagnóstico
- O card **“Última Fatura”** no dashboard usa `selectedCard.currentBill.totalAmount` e `selectedCard.currentBill.dueDate` quando existem, e só cai no cálculo local (invoiceBuilder) como fallback. Isso faz um valor “antigo/stale” da Pluggy (ex.: R$ 783,40 e vencimento 07/01/2026) sobrescrever o valor correto calculado pelas transações.
- O problema fica mais visível quando a Pluggy ainda não atualizou a lista de bills para o mês novo, ou quando a seleção do bill “atual” no sync não bate com o ciclo calculado.
- Pontos onde isso acontece:
  - Card/summary do cartão: [CreditCardTable.tsx:L1002-L1039](file:///c:/Users/de/Desktop/Controlar-/components/CreditCardTable.tsx#L1002-L1039) e UI: [CreditCardTable.tsx:L2034-L2083](file:///c:/Users/de/Desktop/Controlar-/components/CreditCardTable.tsx#L2034-L2083)
  - Cards globais: [StatsCards.tsx:L605-L651](file:///c:/Users/de/Desktop/Controlar-/components/StatsCards.tsx#L605-L651)

## Correção (Back-end sync Pluggy)
- Ajustar a lógica de seleção/gravação de bills para reduzir chance de `currentBill` ficar “parado no mês anterior”:
  - Usar `bill.state` (como definido em [types.ts:L295-L306](file:///c:/Users/de/Desktop/Controlar-/types.ts#L295-L306)) ao invés de `bill.status` quando escolher e salvar status.
  - Trocar a comparação `b.dueDate >= todayStr` (string) por comparação real de datas (`new Date(b.dueDate).getTime()`), para não errar quando o formato não for ISO.
  - Definir `currentBill` como o bill “a pagar” mais provável:
    - Prioridade 1: `state === 'OPEN'`.
    - Prioridade 2: menor `dueDate` futura.
    - Fallback: bill mais recente.
  - Arquivo-alvo: [pluggy.js](file:///c:/Users/de/Desktop/Controlar-/api/pluggy.js#L1870-L2012)

## Correção (Front-end: não deixar dado stale sobrescrever cálculo)
- No dashboard do cartão e nos cards globais:
  - Parar de “preferir sempre” o valor do `currentBill.totalAmount`.
  - Só usar `currentBill` quando ele for coerente com o ciclo calculado:
    - `dueDate` do `currentBill` deve estar **próximo** do `invoiceSummary.lastDueDate` (ex.: diferença <= 15 dias) e/ou bater o mês-chave.
    - Divergência do total deve ser pequena (ex.: <= R$ 1,00 ou <= 1%).
  - Caso contrário, exibir `invoiceBuilder.closedInvoice.total` e `invoiceBuilder.closedInvoice.dueDate` (fonte consistente com as transações e com o pagamento “não rotativo”).
  - Arquivos-alvo:
    - [CreditCardTable.tsx](file:///c:/Users/de/Desktop/Controlar-/components/CreditCardTable.tsx#L1002-L1039)
    - [StatsCards.tsx](file:///c:/Users/de/Desktop/Controlar-/components/StatsCards.tsx#L605-L651)

## Ajuste opcional (InvoiceBuilder: datas de início do período)
- Revisar o cálculo de `lastInvoiceStart/currentInvoiceStart` no modo automático para usar **dia seguinte** ao fechamento anterior (consistente com o modo manual), reduzindo chance de “puxar” transações do ciclo errado quando `closingDay` é 1.
- Arquivo-alvo: [invoiceBuilder.ts:L437-L490](file:///c:/Users/de/Desktop/Controlar-/services/invoiceBuilder.ts#L437-L490)

## Validação
- Adicionar testes em [invoiceBuilder.test.ts](file:///c:/Users/de/Desktop/Controlar-/services/invoiceBuilder.test.ts) cobrindo:
  - Caso `closingDay=1` e `dueDay=7` (garantir vencimento no mês correto e alocação de transações nos períodos).
  - Caso com pagamento detectado (“Pagamento recebido”) marcando a fatura fechada como paga.
- Rodar suíte de testes (vitest) e validar no UI:
  - “Última Fatura” deve mostrar o valor calculado do ciclo correto e o vencimento coerente com o período.

## Observações de segurança
- Não vou usar nem registrar as credenciais que você enviou. A correção vai ser feita via código + validação local.
