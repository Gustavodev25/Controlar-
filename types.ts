export type TransactionType = 'income' | 'expense';

export interface User {
  id?: string;
  name: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  baseSalary?: number;
  salaryPaymentDay?: number | string;
  salaryAdvanceDay?: number;
  salaryAdvancePercent?: number;
  salaryAdvanceValue?: number;
  valeDeductions?: { id: string; name: string; value: string; type: '%' | 'R$' }[];
  valeExemptFromDiscounts?: boolean;
  salaryExemptFromDiscounts?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  subscription?: {
    plan: 'starter' | 'pro' | 'family';
    status: 'active' | 'canceled' | 'past_due' | 'pending_payment' | 'refunded' | 'trial';
    billingCycle: 'monthly' | 'annual';
    nextBillingDate?: string;
    accessUntil?: string; // Data até qual o usuário mantém acesso PRO após cancelamento
    canceledAt?: string; // Data em que foi cancelado
    trialStartedAt?: string; // Data de início do trial (ISO string)
    trialEndsAt?: string; // Data de fim do trial (ISO string)
    installments?: number;
    asaasCustomerId?: string;
    asaasSubscriptionId?: string;
    asaasPaymentId?: string; // ID do último pagamento para estorno
    couponUsed?: string;
    startDate?: string;
    firstMonthOverridePrice?: number; // Override price for month 1 (manual fix)
    couponStartMonth?: string; // Mês de início do cupom (YYYY-MM)
    autoRenew?: boolean;
    paymentFailureReason?: string;
    paymentFailedAt?: string;
    creditCardToken?: string;
    creditCardLast4?: string;
  };
  paymentMethodDetails?: {
    last4: string;
    holder: string;
    expiry: string;
    brand?: string;
  };
  familyGroupId?: string;
  familyRole?: 'owner' | 'member';
  isAdmin?: boolean;
  cpf?: string;
  birthDate?: string;
  address?: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  dailyConnectionCredits?: {
    date: string; // YYYY-MM-DD
    count: number;
  };
  createdAt?: string;
  hasSeenProTutorial?: boolean;
  connectionLogs?: ConnectionLog[];
  dataViewMode?: 'AUTO' | 'MANUAL'; // Preferência de visualização: Auto (Open Finance) ou Manual
  // Preferências de dashboard que devem persistir entre sessões
  dashboardPreferences?: {
    includeOpenFinanceInStats?: boolean;
    cardInvoiceTypes?: Record<string, 'current' | 'next' | 'used_total'>;
  };
}

export interface ConnectionLog {
  id: string;
  os: string;
  browser: string;
  ip: string;
  location: string;
  device: string;
  timestamp: string;
  isCurrent?: boolean;
}

export interface FamilyGroup {
  id: string;
  ownerId: string;
  plan: 'pro' | 'family';
  members: string[]; // User IDs
  invites: {
    token: string;
    createdAt: string;
    status: 'pending' | 'accepted';
    email?: string;
  }[];
}

export interface Member {
  id: string;
  name: string;
  avatarUrl?: string;
  role: 'admin' | 'member';
}

export interface FamilyGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  status: 'active' | 'canceled';
  lastPaymentDate?: string;
  category: string;
  provider?: string;
  paidMonths?: string[]; // Meses em que foi marcada como paga (YYYY-MM), não soma no custo mensal
  // Auto-detection fields
  source?: 'auto_detected' | 'manual'; // Como foi criada
  confirmed?: boolean; // Se usuário confirmou que é assinatura
  detectedAt?: string; // Data de detecção automática
  nickname?: string; // Apelido personalizado para a assinatura
  chargeDay?: number; // Dia da cobrança (1-31)
}

export interface WaitlistEntry {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  goal?: string;
  source?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  memberId?: string;

  date: string; // YYYY-MM-DD
  timestamp?: string; // ISO 8601 completo (com horário e fuso) para ordenação precisa
  description: string;
  amount: number;
  category: string;

  type: TransactionType; // (confirme se seu enum aceita 'income' | 'expense' ou ajuste no backend)
  status: 'completed' | 'pending';

  // Optional flags
  importSource?: string; // e.g. "klavi", "pluggy" - identifies auto-imported transactions
  needsApproval?: boolean;
  ignored?: boolean;
  isSubscription?: boolean;
  paidSubscriptionId?: string;

  providerId?: string; // legacy field, importSource preferred
  providerItemId?: string;

  // Invoice fields (cartão)
  invoiceDate?: string; // Invoice month this transaction belongs to (YYYY-MM-01)
  invoiceDueDate?: string; // Actual due date of the invoice (YYYY-MM-DD)
  dueDate?: string; // alias for invoiceDueDate

  // Account fields
  accountId?: string;
  accountType?: string; // 'CHECKING_ACCOUNT', 'CREDIT_CARD', 'SAVINGS_ACCOUNT'
  isInvestment?: boolean;

  // Credit card specific fields
  cardId?: string;
  cardName?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  isProjected?: boolean; // True for future installments generated by sync

  // ✅ EXTRA (opcionais, recomendados para "bater com o banco" e debug)
  invoiceMonthKey?: string; // "YYYY-MM" (canônico do mês da fatura, facilita filtro)
  pluggyBillId?: string | null; // Bill/Fatura id do Pluggy (quando existir)
  invoiceSource?: 'pluggy_billId' | 'pluggy_month_match' | 'rule_fallback' | string; // origem do cálculo
  pluggyRaw?: any; // JSON bruto/sanitizado da transação (para inspeção no modal)

  // ✅ MOEDA - Transações internacionais (USD, EUR, etc.)
  currencyCode?: string; // Código da moeda (BRL, USD, EUR, etc.)
  amountOriginal?: number; // Valor original na moeda estrangeira (antes da conversão)
  amountInAccountCurrency?: number; // Valor convertido para moeda da conta (BRL)

  // Invoice Manual Override
  manualInvoiceMonth?: string | null; // YYYY-MM overrides the automatic date-based calculation

  // Refund & Adjustment Flags
  _syntheticRefund?: boolean;
  refundOfId?: string;

}


export interface Reminder {
  id: string;
  memberId?: string;
  description: string;
  amount: number;
  dueDate: string;
  category: string;
  type?: TransactionType;
  isRecurring: boolean;
  frequency?: 'monthly' | 'weekly' | 'yearly';
  status?: 'pending' | 'paid';
  paidAt?: string;
  // Campos de compatibilidade com o App Mobile
  title?: string;
  name?: string;
  price?: number;
  value?: number;
  date?: string;
  isRecurrence?: boolean;
  recurrence?: 'monthly' | 'weekly' | 'yearly';
  transactionType?: 'income' | 'expense';
}

export interface Investment {
  id: string;
  memberId?: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
  deadline?: string;
}

export interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  monthlySavings: number;
  creditCardSpending?: number;
}

export interface AIAnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
}

export interface AIParsedTransaction {
  description: string;
  amount: number;
  category: string;
  date: string;
  type: TransactionType;
  installments?: number;
  isSubscription?: boolean;
  accountName?: string;
  needsAccountConfirmation?: boolean; // True quando o usuário não especificou a conta/cartão
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export interface Budget {
  id: string;
  memberId?: string;
  name?: string;
  category: string;
  limitAmount: number;
  month: string;
  alertThreshold: number;
}

export interface ConnectedTransactionPreview {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category?: string;
  installments?: {
    number?: number;
    total?: number;
  };
  currency?: string;
}

export interface FinanceCharges {
  iof: number;
  interest: number;
  lateFee: number;
  otherCharges?: number;
  total?: number;
  details?: { type: string; amount: number; date?: string }[];
}

export interface ProviderBill {
  id: string;
  dueDate: string;
  totalAmount: number;
  totalAmountCurrencyCode?: string;
  minimumPaymentAmount?: number;
  allowsInstallments?: boolean;
  financeCharges?: FinanceCharges;
  balanceCloseDate?: string;
  state?: 'OPEN' | 'CLOSED' | 'FUTURE'; // Bill state from Pluggy
  paidAmount?: number;
}

// ============================================================
// NOVO: Períodos de fatura pré-calculados no backend
// Fonte única de verdade para cálculos de período de fatura
// ============================================================
export interface InvoicePeriod {
  start: string;    // Data de início do período (YYYY-MM-DD)
  end: string;      // Data de fechamento (YYYY-MM-DD)
  dueDate: string;  // Data de vencimento (YYYY-MM-DD)
  monthKey: string; // Chave do mês (YYYY-MM)
}

export interface InvoicePeriods {
  closingDay: number;       // Dia de fechamento validado (1-28)
  dueDay: number;           // Dia de vencimento
  calculatedAt: string;     // ISO timestamp de quando foi calculado

  // Datas de fechamento (para referência rápida)
  beforeLastClosingDate: string;
  lastClosingDate: string;
  currentClosingDate: string;
  nextClosingDate: string;

  // Períodos completos
  lastInvoice: InvoicePeriod;     // Última fatura (fechada)
  currentInvoice: InvoicePeriod;  // Fatura atual (aberta)
  nextInvoice: InvoicePeriod;     // Próxima fatura (futura)
}

// ============================================================
// SISTEMA DE FATURAS - Estrutura profissional
// A Pluggy NÃO entrega faturas prontas, apenas transações + metadados.
// Quem monta a fatura é o frontend/backend, e isso dá controle total.
// ============================================================

export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'FUTURE' | 'OVERDUE' | 'PAID';

/**
 * Representa uma fatura de cartão de crédito montada a partir das transações.
 *
 * - OPEN: Fatura atual, ainda aceitando novas compras
 * - CLOSED: Fatura fechada, aguardando pagamento
 * - FUTURE: Fatura futura (parcelas projetadas)
 * - OVERDUE: Fatura fechada com vencimento passado e não paga
 * - PAID: Fatura paga
 */
export interface Invoice {
  id: string;                    // ID único da fatura (ex: card_id_2025-01)
  creditCardId: string;          // ID do cartão
  referenceMonth: string;        // Mês de referência (YYYY-MM)
  status: InvoiceStatus;         // Status da fatura

  // Datas importantes
  billingDate: string;           // Data de fechamento (YYYY-MM-DD)
  dueDate: string;               // Data de vencimento (YYYY-MM-DD)
  periodStart: string;           // Início do período (YYYY-MM-DD)
  periodEnd: string;             // Fim do período (YYYY-MM-DD)

  // Valores
  total: number;                 // Total da fatura
  totalExpenses: number;         // Total de gastos
  totalIncomes: number;          // Total de créditos/pagamentos
  minimumPayment?: number;       // Pagamento mínimo
  paidAmount?: number;           // Valor pago

  // Parcelas futuras projetadas (para visão de longo prazo)
  projectedInstallments?: number; // Quantidade de parcelas futuras nesta fatura

  // Encargos (se houver)
  financeCharges?: FinanceCharges;

  // Itens da fatura
  items: InvoiceItem[];

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Item individual de uma fatura.
 * Pode ser uma transação real ou uma parcela projetada.
 */
export interface InvoiceItem {
  id: string;                    // ID único do item
  invoiceId?: string;            // ID da fatura (para relacionamento)
  transactionId?: string;        // ID da transação original (se existir)

  // Dados da transação
  description: string;
  amount: number;
  date: string;                  // Data da transação (YYYY-MM-DD)
  category?: string;
  type: TransactionType;         // 'income' | 'expense'

  // Informações de parcelamento
  installmentNumber?: number;    // Número da parcela atual
  totalInstallments?: number;    // Total de parcelas
  originalDate?: string;         // Data da compra original (para parcelas)
  originalAmount?: number;       // Valor total da compra (para parcelas)

  // Flags
  isProjected?: boolean;         // True se for parcela projetada (futura)
  isPayment?: boolean;           // True se for pagamento de fatura (NÃO afeta o total)

  isCharge?: boolean;            // True se for encargo (IOF, juros, multa)
  chargeType?: 'IOF' | 'INTEREST' | 'LATE_FEE' | 'OTHER';

  // Moeda - Transações internacionais
  currencyCode?: string;         // BRL, USD, EUR, etc.
  amountOriginal?: number;       // Valor original na moeda estrangeira
  amountInAccountCurrency?: number; // Valor convertido para BRL

  // Dados brutos do provider (para debug)
  pluggyRaw?: any;

  // Manual Override (propagated from Transaction)
  manualInvoiceMonth?: string | null;
}

/**
 * Resumo de faturas por mês para visão de longo prazo.
 * Permite ver o comprometimento futuro do cartão.
 */
export interface InvoiceForecast {
  monthKey: string;              // YYYY-MM
  total: number;                 // Total projetado
  installmentsCount: number;     // Quantidade de parcelas
  newPurchasesCount: number;     // Quantidade de compras novas
  items: InvoiceItem[];          // Itens projetados
}

/**
 * Série de parcelas agrupadas (formato legado para compatibilidade).
 */
export interface InstallmentSeries {
  seriesKey: string;
  description: string;
  originalAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  firstInstallmentDate: string;
  lastInstallmentDate: string;
  cardId: string;
  items: InvoiceItem[];
}

// ============================================================
// SISTEMA DE PARCELAS - Estrutura profissional e independente
// A Pluggy NÃO é dona da regra de parcelamento.
// Ela só replica o que o banco manda (incompleto/inconsistente).
// Este sistema é a FONTE DA VERDADE para parcelas.
// ============================================================

export type InstallmentStatus = 'FUTURE' | 'OPEN' | 'CLOSED' | 'PAID';

/**
 * Representa uma compra parcelada (entidade PAI).
 * Cada compra gera N parcelas independentes.
 *
 * A transação da Pluggy é tratada como EVENTO que dispara a criação.
 * O sistema próprio mantém a verdade sobre parcelas futuras.
 */
export interface Purchase {
  id: string;                    // ID único da compra
  creditCardId: string;          // ID do cartão
  transactionId?: string;        // ID da transação original (Pluggy)

  // Dados da compra
  description: string;           // Descrição normalizada
  totalAmount: number;           // Valor total da compra
  installmentAmount: number;     // Valor de cada parcela
  totalInstallments: number;     // Total de parcelas
  purchaseDate: string;          // Data da compra (YYYY-MM-DD)

  // Configuração do cartão no momento da compra
  billingDay: number;            // Dia de fechamento usado
  firstBillingMonth: string;     // Mês da 1ª parcela (YYYY-MM)

  // Metadados
  category?: string;
  merchant?: string;             // Estabelecimento
  isRecurring?: boolean;         // Se é assinatura/recorrente

  // Controle
  createdAt: string;
  updatedAt?: string;
  source: 'pluggy' | 'manual' | 'import';
}

/**
 * Representa uma parcela individual (entidade FILHA).
 * Cada parcela é um lançamento independente alocado em uma fatura específica.
 *
 * Fatura é apenas AGRUPADOR, parcela é o DADO real.
 */
export interface Installment {
  id: string;                    // ID único da parcela
  purchaseId: string;            // ID da compra pai

  // Identificação
  installmentNumber: number;     // Número da parcela (1, 2, 3...)
  totalInstallments: number;     // Total de parcelas

  // Valores
  amount: number;                // Valor desta parcela

  // Alocação na fatura
  referenceMonth: string;        // Mês de referência (YYYY-MM)
  billingDate: string;           // Data de fechamento da fatura (YYYY-MM-DD)
  dueDate: string;               // Data de vencimento (YYYY-MM-DD)

  // Status
  status: InstallmentStatus;     // FUTURE | OPEN | CLOSED | PAID
  paidAt?: string;               // Data do pagamento

  // Dados herdados da compra (desnormalizados para performance)
  description: string;
  category?: string;
  creditCardId: string;
  purchaseDate: string;          // Data original da compra

  // Flags
  isProjected: boolean;          // True se gerada pelo sistema (não veio da API)
  isFromAPI: boolean;            // True se veio da Pluggy
  transactionId?: string;        // ID da transação (se veio da API)
  date?: string;                 // Data real da transação (se disponível/calculada)

  // Refund & Adjustment Flags
  manualInvoiceMonth?: string | null;
  _refundAmount?: number;
  isRefund?: boolean;
  _manualRefund?: boolean;
}

/**
 * Resultado do processamento de parcelas de uma compra.
 */
export interface PurchaseWithInstallments {
  purchase: Purchase;
  installments: Installment[];
}

/**
 * Mapa de parcelas por mês para alocação em faturas.
 */
export interface InstallmentsByMonth {
  [monthKey: string]: Installment[];
}

/**
 * Resumo de compromissos futuros com parcelas.
 */
export interface InstallmentForecast {
  monthKey: string;              // YYYY-MM
  totalAmount: number;           // Total de parcelas no mês
  installmentsCount: number;     // Quantidade de parcelas
  purchases: {                   // Detalhamento por compra
    purchaseId: string;
    description: string;
    installmentNumber: number;
    totalInstallments: number;
    amount: number;
  }[];
}

export interface ConnectedAccount {
  id: string;
  itemId?: string;
  name: string;
  type?: string;
  subtype?: string;
  // Friendly account type classification
  accountTypeName?: string; // 'Conta Corrente', 'Poupança', 'Cartão de Crédito'
  isCredit?: boolean;
  isSavings?: boolean;
  isChecking?: boolean;
  institution?: string;
  balance?: number;
  currency?: string;
  lastUpdated?: string;
  previewTransactions?: ConnectedTransactionPreview[];
  // Connector info from DB
  connector?: {
    id?: string;
    name?: string;
    imageUrl?: string;
    primaryColor?: string;
  };
  // Credit card specific
  creditLimit?: number;
  availableCreditLimit?: number;
  usedCreditLimit?: number;
  manualCreditLimit?: number; // User-defined limit when API doesn't provide it
  brand?: string;
  balanceCloseDate?: string;
  balanceDueDate?: string;
  closingDay?: number;
  dueDay?: number;
  manualClosingDay?: number; // User-defined closing day
  manualDueDay?: number;     // User-defined due day
  minimumPayment?: number;
  bills?: ProviderBill[];
  // NOVO: Períodos de fatura pré-calculados (fonte única de verdade)
  invoicePeriods?: InvoicePeriods;
  connectionMode?: 'AUTO' | 'MANUAL';
  initialBalance?: number;

  // Current bill info (from Pluggy API - última fatura fechada)
  currentBill?: {
    id?: string;
    dueDate?: string;
    closeDate?: string;
    // Período calculado baseado no closingDay
    periodStart?: string; // Início do período (dia após fechamento anterior)
    periodEnd?: string;   // Fim do período (data de fechamento)
    status?: 'OPEN' | 'CLOSED' | string; // OPEN = aguardando pagamento, CLOSED = paga
    // Valores
    totalAmount?: number;
    totalAmountCurrencyCode?: string;
    minimumPaymentAmount?: number;
    paidAmount?: number;
    // Flags
    allowsInstallments?: boolean;
    isInstallment?: boolean;
    // Encargos
    financeCharges?: FinanceCharges;
    // Legacy fields
    state?: string;
    minimumPayment?: number;
  };
  // Previous bill info (fatura anterior à última)
  previousBill?: {
    id?: string;
    dueDate?: string;
    closeDate?: string;
    periodStart?: string;
    periodEnd?: string;
    status?: string;
    totalAmount?: number;
    totalAmountCurrencyCode?: string;
    minimumPaymentAmount?: number;
    paidAmount?: number;
    financeCharges?: FinanceCharges;
  };
  billsUpdatedAt?: string;
  // Bank account specific
  accountNumber?: string;
  bankNumber?: string;
  branchNumber?: string;
  transferNumber?: string;
  // Sync tracking
  connectedAt?: string;   // ISO timestamp of first connection
  lastSyncedAt?: string;  // ISO timestamp of last sync

  // Manual closing date overrides
  manualBeforeLastClosingDate?: string; // YYYY-MM-DD (End of the invoice before the last one)
  manualLastClosingDate?: string; // YYYY-MM-DD
  manualCurrentClosingDate?: string; // YYYY-MM-DD
  hidden?: boolean;
  // Preservação de apelido: nome original da API para comparação
  originalName?: string; // Nome original retornado pela API (Pluggy), usado para detectar apelidos customizados
}

export interface AppNotification {
  id: string;
  type: 'system' | 'alert' | 'update' | 'budget_warning' | 'budget_danger';
  title: string;
  message: string;
  date: string;
  read: boolean;
  archived?: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'progressive';
  value: number; // Percentage (0-100) or Fixed Amount (for non-progressive)
  isActive: boolean;
  maxUses?: number; // Optional limit
  currentUses: number;
  expirationDate?: string; // ISO Date
  createdAt: string;
  // Progressive discount: different discount per billing month
  // Example: [{month: 1, discount: 100, discountType: 'percentage'}, {month: 2, discount: 50, discountType: 'fixed'}]
  progressiveDiscounts?: { month: number; discount: number; discountType?: 'percentage' | 'fixed' }[];
  partnership?: {
    partnerName: string;
    commissionType: 'percentage' | 'fixed';
    commissionValue: number;
    accumulatedCommission: number;
    partnerPix?: string;
  };
}

export interface PromoPopup {
  id: string;
  title: string;
  message: string;
  imageUrl?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  type: 'info' | 'promo' | 'update';
  dismissible?: boolean;
  expiresAt?: string;
  createdAt: string;
  dismissed?: boolean;
}

export interface SystemSettings {
  metaPixelId?: string;
}

export interface ChangelogItem {
  id?: string;
  version: string;
  majorVersion: string; // e.g. "10" for background display
  date: string; // Display date string e.g. "24 Dez, 2024"
  type: 'major' | 'minor' | 'patch';
  image?: string;
  summary?: string;
  actionLink?: string;
  changes: {
    type: 'new' | 'improvement' | 'fix';
    text: string;
  }[];
  newFeaturesIntro?: string;
  improvementsIntro?: string;
  fixesIntro?: string;
  createdAt?: string; // ISO timestamp for sorting
}

// ============================================================
// GESTÃO DE CATEGORIAS - Mapeamento personalizado por usuário
// ============================================================

export interface CategoryMapping {
  id: string;                    // ID único (geralmente a chave original em lowercase)
  originalKey: string;           // Chave original (da Pluggy ou do sistema)
  displayName: string;           // Nome de exibição personalizado pelo usuário
  isDefault: boolean;            // Se é uma categoria padrão do sistema
  icon?: string;                 // Ícone opcional (nome do ícone)
  color?: string;                // Cor opcional (hex)
  group?: string;                // Grupo/Tema a qual pertence (para categorias customizadas)
  updatedAt?: string;            // Última atualização
}

export interface KanbanChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  assignee?: string; // Name or Avatar URL
  tags: string[];
  imageUrl?: string;
  checklist?: KanbanChecklistItem[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  tasks: KanbanTask[];
  color: string;
}
