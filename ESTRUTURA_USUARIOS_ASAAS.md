# Estrutura de Dados de Usuários - Controlar+

## 1. LOCALIZAÇÃO DOS DADOS

### Coleção Firestore
- **Coleção raiz**: `users/{userId}`
- **Estrutura**: Usuários podem estar com dados em:
  - Nível raiz: `users/{userId}/subscription.*` e `users/{userId}.isAdmin`
  - Dentro de profile: `users/{userId}/profile.*` e `users/{userId}/profile/subscription.*`

### Serviços de Database
- [services/database.ts](services/database.ts) - Funções para gerenciar usuários
- [api/_lib/routes.js](api/_lib/routes.js) - Endpoints e webhooks Asaas

---

## 2. INTERFACE USER COMPLETA

### Arquivo: [types.ts](types.ts)

```typescript
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
  
  // === SUBSCRIPTION/PLAN FIELDS ===
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
    
    // === ASAAS INTEGRATION FIELDS ===
    asaasCustomerId?: string; // ID do cliente no Asaas
    asaasSubscriptionId?: string; // ID da assinatura no Asaas
    asaasPaymentId?: string; // ID do último pagamento para estorno
    
    couponUsed?: string;
    startDate?: string;
    firstMonthOverridePrice?: number; // Override price for month 1 (manual fix)
    couponStartMonth?: string; // Mês de início do cupom (YYYY-MM)
    autoRenew?: boolean;
    
    // === PAYMENT FAILURE FIELDS ===
    paymentFailureReason?: string;
    paymentFailedAt?: string; // Data que o pagamento falhou
    graceUntil?: string; // Período de graça após falha de pagamento (7 dias)
    
    creditCardToken?: string;
    creditCardLast4?: string;
  };
  
  paymentMethodDetails?: {
    last4: string;
    holder: string;
    expiry: string;
    brand?: string;
  };
  
  // === FAMILY GROUP FIELDS ===
  familyGroupId?: string;
  familyRole?: 'owner' | 'member';
  isAdmin?: boolean;
  
  // === PERSONAL DATA ===
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
  
  // === OTHER FIELDS ===
  dailyConnectionCredits?: {
    date: string; // YYYY-MM-DD
    count: number;
  };
  createdAt?: string;
  hasSeenProTutorial?: boolean;
  connectionLogs?: ConnectionLog[];
  dataViewMode?: 'AUTO' | 'MANUAL';
  dashboardPreferences?: {
    includeOpenFinanceInStats?: boolean;
    cardInvoiceTypes?: Record<string, 'current' | 'next' | 'used_total'>;
    invoiceViewMode?: 'all' | 'last' | 'current' | 'next';
  };
}
```

---

## 3. CAMPOS DO PLANO E CANCELAMENTO

### Status de Plano

```
'starter' | 'pro' | 'family'
```

### Status de Assinatura

```
'active'           // Assinatura ativa
'canceled'         // Cancelada (mantém acesso até accessUntil)
'past_due'         // Pagamento atrasado
'pending_payment'  // Aguardando confirmação
'refunded'         // Estornada
'trial'            // Em período de teste
```

### Identificadores de Plano

| Campo | Descrição |
|-------|-----------|
| `subscription.plan` | Plano atual ('starter', 'pro', 'family') |
| `subscription.status` | Status da assinatura |
| `subscription.billingCycle` | 'monthly' ou 'annual' |
| `subscription.autoRenew` | Se renovação automática está ativa |

### Campos de Cancelamento

| Campo | Descrição |
|-------|-----------|
| `subscription.canceledAt` | ISO string da data de cancelamento |
| `subscription.accessUntil` | Até quando o acesso PRO é mantido após cancelamento |
| `subscription.status === 'canceled'` | Status é 'canceled' |

### Campos de Falha de Pagamento

| Campo | Descrição |
|-------|-----------|
| `subscription.paymentFailedAt` | Quando o pagamento falhou |
| `subscription.graceUntil` | Período de graça (automaticamente 7 dias após falha) |
| `subscription.paymentFailureReason` | Motivo da falha |

---

## 4. INTEGRAÇÃO ASAAS

### Endpoints da API

**Arquivo**: [config/api.ts](config/api.ts)

```typescript
asaas: {
    customer: `${API_BASE}/asaas/customer`,           // POST criar cliente
    subscription: `${API_BASE}/asaas/subscription`,   // POST criar assinatura
    cancelSubscription: `${API_BASE}/asaas/cancel-subscription`, // POST cancelar
    validateCard: `${API_BASE}/asaas/validate-card`,  // POST validar cartão
}
```

### Campos Asaas no User

```typescript
subscription.asaasCustomerId?: string;     // ID do cliente
subscription.asaasSubscriptionId?: string; // ID da assinatura
subscription.asaasPaymentId?: string;      // ID do último pagamento
```

### Rotas Backend

**Arquivo**: [api/_lib/routes.js](api/_lib/routes.js)

| Rota | Método | Descrição |
|------|--------|-----------|
| `/asaas/customer` | POST | Criar cliente no Asaas |
| `/asaas/customer` | GET | Buscar dados do cliente |
| `/asaas/subscription` | POST | Criar assinatura |
| `/asaas/subscription/:subscriptionId` | GET | Obter status de assinatura |
| `/asaas/subscription/:subscriptionId` | DELETE | Cancelar assinatura |
| `/asaas/subscription/update-card` | POST | Atualizar cartão |
| `/asaas/webhook` | POST | Webhook para eventos Asaas |
| `/asaas/payments` | GET | Listar pagamentos de um cliente |
| `/asaas/payment/:paymentId/pay-with-saved-card` | POST | Pagar com cartão salvo |
| `/asaas/payment/:paymentId/refund` | POST | Estornar pagamento |

### Webhook Asaas

**Eventos processados**:
- `payment.created`
- `payment.updated`
- `payment.confirmed`
- `payment.overdue`
- `payment.refunded`
- `subscription.created`
- `subscription.updated`
- `subscription.canceled`

**Quando recebe webhook do Asaas**:
1. Encontra usuário por `subscription.asaasCustomerId` ou `subscription.asaasSubscriptionId`
2. Atualiza status em Firestore (tanto raiz quanto em profile)
3. Mantém sincronização com ambas as localizações

---

## 5. SCRIPTS ADMIN

### Arquivo: [make_user_pro.ts](make_user_pro.ts)

Script para fazer upgrade manual de usuário para PRO:

```bash
npx tsx make_user_pro.ts
```

**Requer**:
- Email e senha de admin autenticado
- Valida permissão (`isAdmin === true`)

**O que faz**:
- Cria cliente no Asaas
- Cria assinatura com dados fornecidos
- Atualiza `subscription` do usuário no Firestore
- Salva `asaasCustomerId` e `asaasSubscriptionId`

### Arquivo: [migrate-admin.ts](migrate-admin.ts)

Script para migrar `isAdmin` do nível raiz para dentro do profile:

```bash
npx tsx migrate-admin.ts
```

**Motivo**: Consolidar dados do admin em um único local dentro de `profile`

---

## 6. FUNÇÕES PRINCIPAIS NO DATABASE SERVICE

**Arquivo**: [services/database.ts](services/database.ts)

```typescript
// Obter perfil do usuário (combina dados raiz e profile)
export const getUserProfile = async (userId: string): Promise<Partial<User> | null>

// Atualizar dados do perfil
export const updateUserProfile = async (userId: string, data: Partial<User>)

// Atualizar dados de assinatura
export const updateUserSubscription = async (userId: string, subscriptionData: any)

// Definir status de admin
export const setAdminStatus = async (userId: string, isAdmin: boolean)

// Override preço do primeiro mês (para correção de cupom)
export const setFirstMonthOverridePrice = async (userId: string, price: number)

// Salvar modo de visualização de dados (Auto/Manual)
export const saveDataViewMode = async (userId: string, mode: 'AUTO' | 'MANUAL')

// Obter todos os usuários (para admin)
export const getAllUsers = async (): Promise<(User & { id: string })[]>
```

---

## 7. FLUXO DE DADOS SUBSCRIPTION

### Estrutura Duplicada no Firestore

Os dados de subscription estão em **duas localizações** por razões de performance:

```
users/{userId}/subscription.* (raiz)          ← Atualizado por webhooks
users/{userId}/profile/subscription.* (profile) ← Cópia para leitura unificada
```

**Por quê?**
- Webhooks Asaas atualizam raiz para ser rápido
- Frontend lê `profile.subscription` com `getUserProfile()`
- Sistema une ambas automaticamente via `getUserProfile()`

### Priority de Leitura

Em `getUserProfile()`:
1. Lê `data.subscription` (raiz) - Priority para webhooks
2. Mescla com `data.profile.subscription`
3. Retorna union de ambas

---

## 8. STATUS WORKFLOW

### Fluxo Normal de Pagamento

```
pending_payment → active → past_due → canceled
     ↑                           ↓
     └─ graceUntil (7 dias) ────┘
```

### Campos Preenchidos em Cada Estágio

**`pending_payment`**: Assinatura criada, aguardando confirmação
- `subscription.status` = 'pending_payment'
- `subscription.asaasSubscriptionId` já preenchido

**`active`**: Pagamento confirmado
- `subscription.status` = 'active'
- `subscription.nextBillingDate` preenchido
- `subscription.paymentFailedAt` = null

**`past_due`**: Pagamento falhou
- `subscription.paymentFailedAt` = data do erro
- `subscription.graceUntil` = data + 7 dias

**`canceled`**: Cancelado manualmente
- `subscription.canceledAt` = data
- `subscription.accessUntil` = data até quando mantém acesso
- `subscription.status` = 'canceled'
- Plano continua como 'pro' ou 'family' até `accessUntil`

**`refunded`**: Estornado via Asaas webhook
- `subscription.status` = 'refunded'
- `subscription.plan` = 'starter'

---

## 9. REFERÊNCIAS NO CÓDIGO

### Componentes que usam dados de usuário

- [components/AdminSubscriptions.tsx](components/AdminSubscriptions.tsx) - Gerenciamento de assinaturas
- [components/AdminUsers.tsx](components/AdminUsers.tsx) - Gerenciamento de usuários
- [components/AdminDashboard.tsx](components/AdminDashboard.tsx) - Dashboard com analytics
- [App.tsx](App.tsx) - Lógica principal do usuário logado

### Buscas por padrões

```bash
# Encontrar todas as referências a cancelamento
grep -r "canceledAt\|'canceled'\|graceUntil" --include="*.ts" --include="*.tsx"

# Encontrar todas as referências a Asaas
grep -r "asaasCustomerId\|asaasSubscriptionId\|asaasPaymentId" --include="*.ts" --include="*.tsx"

# Encontrar referências a plano PRO
grep -r "plan.*pro\|'pro'" --include="*.ts" --include="*.tsx"
```

---

## 10. CHECKLIST - INFORMAÇÕES ENCONTRADAS

- ✅ Coleção Firestore: `users/{userId}`
- ✅ Interface User completa com todos os campos
- ✅ Status de plano: `starter | pro | family`
- ✅ Status de cancelamento: `'canceled', canceledAt, accessUntil`
- ✅ Integração Asaas: `asaasCustomerId, asaasSubscriptionId, asaasPaymentId`
- ✅ Scripts de admin: `make_user_pro.ts, migrate-admin.ts`
- ✅ Webhooks Asaas processam eventos de pagamento
- ✅ Dados duplicados em raiz e profile para performance
- ✅ Período de Graça (graceUntil) de 7 dias para pagamentos falhados
- ✅ Função `getUserProfile()` une dados de raiz e profile
