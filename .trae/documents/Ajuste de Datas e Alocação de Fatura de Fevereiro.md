## **Análise do Problema**
O usuário relatou que a "Fatura Atual" está zerada, apesar de existirem transações em fevereiro. 
Pela imagem, o período da fatura atual está como **29/jan a 25/fevereiro**. Como hoje é 29/jan, qualquer transação de fevereiro (antes do dia 25) deveria aparecer nesta fatura. 

A causa provável é uma inconsistência entre o dia de fechamento real do banco (que foi 28 no mês passado) e o dia de fechamento configurado no sistema (que parece ser 25). Isso está criando um conflito na alocação das transações.

## **Passos para Solução**

### **1. Ajustar Lógica de Períodos no `invoiceBuilder.ts`**
- Revisar a função [calculateInvoicePeriodDates](file:///c:/Users/de/Desktop/Controlar-/services/invoiceBuilder.ts#L229) para garantir que a transição entre um fechamento no dia 28 e o próximo no dia 25 não crie lacunas ou ignore transações.
- Garantir que `currentClosingDate` sempre aponte para o fechamento futuro correto em relação a `today`.

### **2. Corrigir Alocação de Transações no `buildInvoices`**
- Reforçar a lógica de filtragem em [buildInvoices](file:///c:/Users/de/Desktop/Controlar-/services/invoiceBuilder.ts#L624) para que transações simples e parceladas que ocorram em fevereiro sejam corretamente capturadas pelo `currentMonthKey` (2026-02).
- Validar se a comparação de `txDateNum` está abrangendo corretamente o início de fevereiro.

### **3. Sincronizar Regras de Parcelamento**
- Ajustar o [installmentService.ts](file:///c:/Users/de/Desktop/Controlar-/services/installmentService.ts) para que a regra de "Melhor dia de compra" use o `billingDay` dinâmico calculado a partir dos dados reais do banco, evitando que compras de fevereiro sejam jogadas para março.

### **4. Verificação**
- Inserir logs temporários para validar os intervalos `currentStartNum` e `currentEndNum`.
- Confirmar que o total da fatura reflete a soma correta após as mudanças.

**Deseja que eu inicie a correção da lógica de datas e alocação agora?**
