## Objetivo
- Na tela **Fatura do Cartão**, adicionar na coluna **Ações** um novo ícone de **Estorno**.
- Ao clicar, abrir um modal usando [UniversalModal.tsx](file:///c:/Users/de/Desktop/Controlar-/components/UniversalModal.tsx) perguntando se o usuário quer **estornar o valor total** ou **um valor personalizado**.
- Ao confirmar, criar uma **nova transação de estorno** vinculada ao mesmo cartão/conta e com as mesmas informações essenciais da transação original.

## Onde Alterar
- UI da tabela/ações e modal: [CreditCardTable.tsx](file:///c:/Users/de/Desktop/Controlar-/components/CreditCardTable.tsx)
- Cálculo/representação em faturas (para refletir “income” como crédito/estorno): [invoiceBuilder.ts](file:///c:/Users/de/Desktop/Controlar-/services/invoiceBuilder.ts)
- Tipos (opcional, para flags extras): [types.ts](file:///c:/Users/de/Desktop/Controlar-/types.ts)

## UX / Fluxo do Modal
- Adicionar um botão/ícone (ex.: RotateCcw/CornerUpLeft) na coluna **Ações** para transações elegíveis (não pagamento/encargo/ajuste; e desabilitar se já estiver pareada como estorno).
- Ao clicar:
  - Abrir **UniversalModal** com título “Estornar transação”.
  - Mostrar resumo da transação (descrição, data, valor).
  - Mostrar “tabs” (botões estilizados) com 2 opções:
    - **Valor total** (selecionado por padrão)
    - **Valor personalizado** (mostra um input de moeda)
  - Validar valor personalizado (min > 0; max <= valor da transação).
  - Confirmar/Cancelar.

## Regra de Negócio (O que será criado)
- Interpretação do pedido “duas transações dão zero”:
  - A transação original é uma **despesa**.
  - O estorno será criado como **income** (crédito) com valor igual ao total ou ao valor parcial.
  - Assim, **despesa (−X) + estorno (+X) = 0** (ou parcialmente se customizado).
- Ao criar o estorno:
  - `type: 'income'`
  - `amount: valorEscolhido`
  - `date: mesma data da transação original` (para cair na mesma fatura e parear com mais consistência)
  - `description: 'Estorno - ' + descrição original` (mantendo “mesmas informações” e facilitando identificação)
  - `category: mesma categoria` (ou manter a categoria original por padrão)
  - `cardId/accountId: mesmo cartão` (garante aparecer na fatura do cartão)
  - Não copiar metadados de parcelamento (`installmentNumber/totalInstallments`) para evitar efeitos colaterais no motor de parcelas.
  - Se for transação internacional, copiar `currencyCode` e ajustar `amountOriginal` de forma proporcional quando for valor personalizado (mantém consistência do indicador de moeda).

## Ajuste Necessário no Cálculo de Faturas
- Hoje, o [transactionToInvoiceItem](file:///c:/Users/de/Desktop/Controlar-/services/invoiceBuilder.ts#L491-L529) força praticamente tudo como `expense` (exceto pagamento), o que impediria o estorno de reduzir a fatura.
- Ajustar `transactionToInvoiceItem` para:
  - Continuar tratando **pagamento** via `isCreditCardPayment(tx)` como `income` com `isPayment`.
  - Para demais transações:
    - Se `tx.type === 'income'`, gerar `InvoiceItem.type = 'income'` e `amount = +abs(tx.amount)`.
    - Se `tx.type === 'expense'`, manter `InvoiceItem.type = 'expense'` e `amount = -abs(tx.amount)`.
- Isso garante que estornos criados no modal afetem o total corretamente (inclusive parcial).

## Tipagem / Flags (Opcional, mas recomendado)
- Em [types.ts](file:///c:/Users/de/Desktop/Controlar-/types.ts), preencher “Refund & Adjustment Flags” com campos opcionais para controle de UI (ex.: `_syntheticRefund?: boolean`, `refundOfId?: string`).
- Isso permite:
  - Desabilitar o botão de estorno se a transação já tiver estorno ligado.
  - Filtrar/identificar estornos com segurança (sem depender só de descrição).

## Persistência
- Reutilizar `onAdd` já passado ao CreditCardTable (hoje chama `handleAddTransaction` e persiste na coleção principal).
- Garantir que o payload do estorno inclua `accountId/cardId` do cartão para aparecer no tab de cartão.

## Verificação
- Rodar o fluxo no UI:
  - Criar estorno total e verificar que a fatura passa a “zerar” para aquela compra.
  - Criar estorno parcial e verificar redução proporcional.
- Adicionar/atualizar testes em [invoiceBuilder.test.ts](file:///c:/Users/de/Desktop/Controlar-/services/invoiceBuilder.test.ts) para cobrir `tx.type === 'income'` reduzindo total da fatura.

## Entregáveis
- Novo ícone de estorno + modal com tabs em [CreditCardTable.tsx](file:///c:/Users/de/Desktop/Controlar-/components/CreditCardTable.tsx).
- Ajuste no motor de faturas em [invoiceBuilder.ts](file:///c:/Users/de/Desktop/Controlar-/services/invoiceBuilder.ts) para respeitar `income` como crédito (sem confundir com pagamento).
- (Opcional) Campos extras em [types.ts](file:///c:/Users/de/Desktop/Controlar-/types.ts) para marcar estornos sintéticos e vincular ao lançamento original.