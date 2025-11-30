# Instruções para Implementar a View de Assinaturas

## ✅ Já Concluído:
- Criado o componente `components/Subscriptions.tsx` com detecção automática de assinaturas

## 📝 Passos Restantes:

### 1. Adicionar 'subscriptions' ao tipo do activeTab

**Arquivo:** `App.tsx` - Linha 157

**De:**
```tsx
const [activeTab, setActiveTab] = useState<'dashboard' | 'table' | 'reminders' | 'investments' | 'fire' | 'advisor' | 'budgets' | 'connections' | 'subscription'>('dashboard');
```

**Para:**
```tsx
const [activeTab, setActiveTab] = useState<'dashboard' | 'table' | 'reminders' | 'investments' | 'fire' | 'advisor' | 'budgets' | 'connections' | 'subscription' | 'subscriptions'>('dashboard');
```

### 2. Importar o componente Subscriptions

**Arquivo:** `App.tsx` - No topo, após os imports existentes

**Adicionar:**
```tsx
import { Subscriptions } from './components/Subscriptions';
```

**E também importar o ícone CreditCard:**
```tsx
import { CreditCard } from 'lucide-react'; // ou do './components/Icons' se já existir lá
```

### 3. Adicionar o botão "Assinaturas" no Sidebar

**Arquivo:** `App.tsx` - Procure pela seção do sidebar onde estão os outros NavItems

**Adicionar após o botão de "Orçamentos" ou "Conexões":**
```tsx
<NavItem
   active={activeTab === 'subscriptions'}
   onClick={() => { setActiveTab('subscriptions'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
   icon={<CreditCard size={20} />}
   label="Assinaturas"
   isOpen={isSidebarOpen}
/>
```

### 4. Adicionar a renderização do componente Subscriptions

**Arquivo:** `App.tsx` - Procure pela seção onde os outros componentes são renderizados

**Adicionar:**
```tsx
{activeTab === 'subscriptions' && (
   <Subscriptions 
      transactions={memberFilteredTransactions}
      onDeleteTransaction={handleDeleteTransaction}
   />
)}
```

## 🎯 Como Funciona:

O componente Subscriptions detecta automaticamente assinaturas recorrentes analisando:
- Transações com descrições conhecidas (Spotify, Netflix, Amazon, etc.)
- Padrões de pagamento mensal (intervalos de 25-35 dias)
- Calcula total mensal e anual
- Diferencia assinaturas ativas de canceladas
- Mostra próxima data estimada de cobrança

## 🔍 Padrões Detectados:

- **Streaming**: Spotify, Netflix, Disney+, HBO Max, Globo Play, YouTube Premium
- **Serviços**: Amazon Prime, Apple, Google One, Microsoft 365
- **Utilidades**: Energia, Água, Internet
- **E-commerce**: Mercado Livre

O sistema é expansível - basta adicionar novos padrões ao array `SUBSCRIPTION_PATTERNS` no componente.
