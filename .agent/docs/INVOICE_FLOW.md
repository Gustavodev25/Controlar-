# Sistema de Faturas - Documentação do Fluxo

## Visão Geral

O sistema de faturas do Controlar **monta as faturas localmente** baseado em transações + metadados do cartão. A API da Pluggy **NÃO entrega "fatura pronta"** como um banco mostra no app - ela entrega apenas transações soltas e alguns metadados.

**Arquivo principal:** `services/invoiceBuilder.ts`

---

## 📅 Conceitos Base

### Dia de Fechamento (closingDay)
- É o dia do mês em que a fatura **fecha**
- Valor entre 1 e 28 (evita problemas com meses de 28/30/31 dias)
- Pode vir da API Pluggy (`balanceCloseDate`) ou ser configurado manualmente

### Dia de Vencimento (dueDay)
- É o dia do mês em que a fatura **vence** (prazo para pagamento)
- Geralmente 10 dias após o fechamento
- Se não informado: `dueDay = closingDay + 10`

### MonthKey
- Identificador único da fatura no formato `YYYY-MM`
- Ex: `2026-02` = fatura de fevereiro de 2026
- Baseado no **mês do fechamento** da fatura

---

## 🗂️ Tipos de Fatura

### 1. **Fatura Fechada (closedInvoice)** - Status: `CLOSED`, `PAID`, ou `OVERDUE`
- Fatura do **período anterior** ao atual
- Já fechou, aguardando pagamento ou já paga
- Período: `lastInvoiceStart` até `lastClosingDate`

### 2. **Fatura Atual (currentInvoice)** - Status: `OPEN`
- Fatura do **período corrente**
- Ainda está acumulando transações
- Período: `currentInvoiceStart` até `currentClosingDate`

### 3. **Faturas Futuras (futureInvoices[])** - Status: `FUTURE`
- Projeções de parcelas que ainda vão cair
- Útil para planejamento financeiro

---

## 📊 Cálculo dos Períodos de Fatura

A função `calculateInvoicePeriodDates()` determina todas as datas relevantes:

```typescript
interface InvoicePeriodDates {
  closingDay: number;        // Dia de fechamento (1-28)
  dueDay: number;            // Dia de vencimento

  // Datas de FECHAMENTO
  beforeLastClosingDate: Date;  // Fechamento de 2 meses atrás
  lastClosingDate: Date;        // Fechamento do mês passado (fatura FECHADA)
  currentClosingDate: Date;     // Fechamento do mês atual (fatura ATUAL)
  nextClosingDate: Date;        // Fechamento do próximo mês (futuro)

  // Datas de INÍCIO de cada período
  lastInvoiceStart: Date;       // Início da fatura FECHADA
  currentInvoiceStart: Date;    // Início da fatura ATUAL
  nextInvoiceStart: Date;       // Início da fatura FUTURA

  // Datas de VENCIMENTO
  lastDueDate: Date;            // Vencimento da fatura FECHADA
  currentDueDate: Date;         // Vencimento da fatura ATUAL
  nextDueDate: Date;            // Vencimento da fatura FUTURA

  // Month Keys (identificadores YYYY-MM)
  lastMonthKey: string;         // Ex: "2026-01"
  currentMonthKey: string;      // Ex: "2026-02"
  nextMonthKey: string;         // Ex: "2026-03"
}
```

---

## 🔄 Lógica de Determinação de Data

### Prioridade das Fontes de Dados:

#### **PRIORIDADE 0: Dados REAIS do Banco (currentBill.periodStart/periodEnd)**
```typescript
if (card?.currentBill?.periodStart && card?.currentBill?.periodEnd) {
  closingDay = parseDate(card.currentBill.periodEnd).getDate();
  currentClosingDate = parseDate(card.currentBill.periodEnd);
}
```

#### **PRIORIDADE 1: Data de Vencimento da Fatura (currentBill.dueDate)**
```typescript
if (card?.currentBill?.dueDate) {
  dueDay = parseDate(card.currentBill.dueDate).getDate();
  // Deduz closingDay baseado no closeDate ou -10 dias
}
```

#### **PRIORIDADE 2: Data de Fechamento do Pluggy (balanceCloseDate)**
```typescript
if (card?.balanceCloseDate) {
  closingDay = parseDate(card.balanceCloseDate).getDate();
}
```

#### **PRIORIDADE 3: Cálculo Matemático (Fallback)**
- Usa apenas o `closingDay` configurado (default: 10)
- Calcula baseado na data atual

---

## 📅 Regra de Rotação Automática

**CONCEITO:** Se hoje >= closingDay, a fatura desse mês JÁ FECHOU.

```typescript
// Com carência de 7 dias para conferência
const rotationThreshold = new Date(today);
rotationThreshold.setDate(rotationThreshold.getDate() - 7);

if (today.getDate() < closingDay) {
  // Fatura atual fecha NESTE mês
  currentClosingDate = getClosingDate(ano, mês_atual, closingDay);
} else {
  // Fatura atual já fechou, a "atual" agora é a do PRÓXIMO mês
  currentClosingDate = getClosingDate(ano, mês_seguinte, closingDay);
}
```

### Exemplo Prático:
- **closingDay:** 10
- **Hoje:** 01/02/2026 (dia 1 < dia 10)
  - Fatura **FECHADA:** período 11/12/2025 a 10/01/2026 (vencimento até ~20/01/2026)
  - Fatura **ATUAL:** período 11/01/2026 a 10/02/2026 (vencimento ~20/02/2026)
  - Fatura **FUTURA:** período 11/02/2026 a 10/03/2026

- **Hoje:** 15/02/2026 (dia 15 > dia 10)
  - Fatura **FECHADA:** período 11/01/2026 a 10/02/2026 (já fechou!)
  - Fatura **ATUAL:** período 11/02/2026 a 10/03/2026
  - Fatura **FUTURA:** período 11/03/2026 a 10/04/2026

---

## 🧮 Alocação de Transações

### Para Transações SIMPLES (não parceladas):
Baseado na **DATA da transação**:

```typescript
const txDateNum = dateToNumber(txDate);

if (txDateNum >= lastStartNum && txDateNum <= lastEndNum) {
  // Vai para fatura FECHADA
  closedItems.push(item);
} else if (txDateNum >= currentStartNum && txDateNum <= currentEndNum) {
  // Vai para fatura ATUAL
  currentItems.push(item);
} else if (txDateNum > currentEndNum) {
  // Vai para fatura FUTURA
  futureItemsByMonth[monthKey].push(item);
}
```

### Para Transações PARCELADAS:
Baseado no **referenceMonth da parcela** (calculado pelo installmentService):

```typescript
if (inst.referenceMonth === periods.lastMonthKey) {
  closedItems.push(item);      // Parcela desta fatura
} else if (inst.referenceMonth === periods.currentMonthKey) {
  currentItems.push(item);     // Parcela da fatura atual
} else if (inst.referenceMonth > periods.currentMonthKey) {
  futureItemsByMonth[inst.referenceMonth].push(item); // Parcela futura
}
```

### Override Manual:
```typescript
if (tx.manualInvoiceMonth) {
  // O usuário pode forçar uma transação para uma fatura específica
  // Ignora a lógica de data automática
}
```

---

## 📋 Status da Fatura

Função `determineInvoiceStatus()`:

```typescript
const determineInvoiceStatus = (
  isClosedInvoice: boolean,
  dueDate: Date,
  paidAmount: number,
  total: number,
  billStatus?: string
): InvoiceStatus => {
  const today = new Date();

  if (isClosedInvoice) {
    // Fatura já fechou - verificar pagamento
    if (billStatus === 'CLOSED' || paidAmount >= total * 0.95) {
      return 'PAID';      // ✅ Paga
    }
    if (dueDate < today) {
      return 'OVERDUE';   // ⚠️ Vencida
    }
    return 'CLOSED';      // 🔒 Fechada, aguardando pagamento
  }

  return 'OPEN';          // 📝 Em aberto (acumulando transações)
};
```

### Estados Possíveis:
| Status | Descrição | Ícone |
|--------|-----------|-------|
| `OPEN` | Fatura atual, ainda acumulando | 📝 |
| `CLOSED` | Fechada, aguardando pagamento | 🔒 |
| `PAID` | Paga (total ou quase total) | ✅ |
| `OVERDUE` | Vencida (passou do dueDate) | ⚠️ |
| `FUTURE` | Projeção futura | 🔮 |

---

## 💰 Cálculo do Total

### Regra de Ouro:
```
Total da Fatura = Soma das Transações do Período
```

- **Despesas:** Aumentam o total (valores negativos no sistema)
- **Reembolsos/Estornos:** Reduzem o total (são créditos)
- **Pagamentos de Fatura:** NÃO afetam o total (são apenas informativos)

```typescript
const amtCents = item.isPayment ? 0 : toCents(item.amount);
```

### Cálculo de Juros (Fatura Vencida):
Se `status === 'OVERDUE'`:
```typescript
const charges = calculateLateCharges(overdueAmount, dueDate, today);
closedTotalFinalCents -= toCents(charges.totalCharges);
```

---

## 🔀 Navegação por Offset

O parâmetro `monthOffset` permite navegar entre faturas:

| Offset | Visualização |
|--------|--------------|
| `0` | Mês atual (padrão) |
| `-1` | Mês anterior |
| `+1` | Próximo mês |
| `-2` | 2 meses atrás |

A data de referência é ajustada:
```typescript
const referenceDate = new Date(today);
if (monthOffset !== 0) {
  referenceDate.setMonth(referenceDate.getMonth() + monthOffset);
}
```

---

## 📁 Estrutura de Arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `services/invoiceBuilder.ts` | Lógica principal de montagem de faturas |
| `services/invoiceCalculator.ts` | Funções auxiliares (reexporta do invoiceBuilder) |
| `services/installmentService.ts` | Processamento de parcelas |
| `services/financeService.ts` | Cálculo de juros e multas |
| `utils/dateUtils.ts` | Ajustes de datas (dias úteis) |
| `utils/moneyUtils.ts` | Operações monetárias em centavos |
| `components/CreditCardTable.tsx` | UI de exibição das faturas |

---

## 🎯 Exemplo Visual

```
Timeline do Cartão (closingDay = 10):

   NOV              DEZ              JAN              FEV              MAR
    |                |                |                |                |
    |<-- Período A -->|<-- Período B -->|<-- Período C -->|<-- Período D -->|
    11              10 11             10 11             10 11             10
    
    
Se HOJE = 01/02/2026:
├── Período B (11/12 - 10/01) = Fatura FECHADA (venceu ~20/01)
├── Período C (11/01 - 10/02) = Fatura ATUAL (vai fechar em 10/02)
└── Período D (11/02 - 10/03) = Fatura FUTURA
```

---

## 🔧 Configuração Manual

O usuário pode sobrescrever as datas automáticas:

```typescript
card.manualCurrentClosingDate  // Data de fechamento da fatura atual
card.manualLastClosingDate     // Data de fechamento da fatura anterior
card.manualBeforeLastClosingDate // Data de fechamento de 2 meses atrás
```

Quando configurado, o sistema usa essas datas em vez de calcular automaticamente.

---

## 📝 Notas Importantes

1. **Carência de 7 dias:** O sistema adiciona uma carência para rotação automática, permitindo que faturas recém-fechadas ainda sejam vistas como "Atual" por alguns dias.

2. **Datas são ao meio-dia:** Para evitar problemas de timezone, todas as datas são criadas às 12:00:00.

3. **Meses curtos:** O sistema ajusta automaticamente o dia de fechamento para meses com menos dias (ex: fevereiro).

4. **Dias úteis:** As datas de fechamento e vencimento são ajustadas para o dia útil anterior se caírem em fim de semana ou feriado.
