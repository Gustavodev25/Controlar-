import { database as db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { User } from '../types';
import axios from 'axios';

// Configuração do Axios para usar o Proxy do Vite
// Hardcoding key to debug 401 error
const apiKey = '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmIxOWY3NmU2LWM2YWYtNDYzZi05MTFhLTgzNDNiMzBiZjY3Yjo6JGFhY2hfZGM1MWFkMzItNTRjOC00ZDY0LTk3OTgtMGIzYmM5Mjk2MTlm';
console.log("Debug Asaas API Key:", apiKey ? `Loaded (${apiKey.substring(0, 5)}...)` : "Missing");

const asaas = axios.create({
  baseURL: '/api/asaas', 
  headers: {
    'access_token': apiKey,
    'Content-Type': 'application/json'
  }
});

const PLANS = {
  pro: {
    name: 'Plano Pro',
    value: 19.90,
  },
  family: {
    name: 'Plano Família',
    value: 59.90,
  }
};

// Helper: Criar ou Buscar Cliente no Asaas
async function getOrCreateCustomer(email: string, name?: string, externalId?: string) {
  try {
    // 1. Buscar cliente existente (Using params for auto-encoding)
    const { data } = await asaas.get('/customers', {
        params: { email: email.trim() }
    });
    
    if (data.data && data.data.length > 0) {
      return data.data[0].id;
    }

    // 2. Criar novo cliente
    const response = await asaas.post('/customers', {
      name: name || 'Usuario Controlar+',
      email: email.trim(),
      externalReference: externalId
    });
    return response.data.id;
  } catch (error: any) {
    console.error('Erro ao buscar/criar cliente Asaas:', error.response?.data || error.message);
    // Log full error for debugging
    if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
    }
    throw new Error('Falha ao conectar com servidor de pagamento.');
  }
}

export const createCheckoutSession = async (
  userEmail: string, 
  planId: 'starter' | 'pro' | 'family', 
  cycle: 'monthly' | 'annual', 
  userId?: string,
  userName?: string,
  creditCard?: any,
  holderInfo?: any
): Promise<void> => {
  
  // 1. Plano Gratuito (Sem integração)
  if (planId === 'starter') {
     return new Promise((resolve) => {
        setTimeout(() => resolve(), 500);
     });
  }

  if (!PLANS[planId]) {
      throw new Error("Plano inválido");
  }

  try {
    const plan = PLANS[planId];
    let value = plan.value;
    let asaasCycle = 'MONTHLY';

    if (cycle === 'annual') {
       asaasCycle = 'YEARLY';
       value = plan.value * 10;
    }

    // 2. Garantir que o cliente existe no Asaas
    const customerId = await getOrCreateCustomer(userEmail, userName, userId);

    // 3. Criar Assinatura com Cartão de Crédito Transparente
    const subscriptionData: any = {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: value,
      nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Amanhã
      cycle: asaasCycle,
      description: `${plan.name} (${cycle === 'annual' ? 'Anual' : 'Mensal'})`,
      externalReference: userId,
    };

    if (creditCard && holderInfo) {
        subscriptionData.creditCard = {
            holderName: creditCard.holderName,
            number: creditCard.number,
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv
        };
        subscriptionData.creditCardHolderInfo = {
            name: holderInfo.name,
            email: holderInfo.email || userEmail,
            cpfCnpj: holderInfo.cpfCnpj,
            postalCode: holderInfo.postalCode,
            addressNumber: holderInfo.addressNumber,
            phone: holderInfo.phone
        };
    }

    const { data: subscription } = await asaas.post('/subscriptions', subscriptionData);
    
    // 4. Calcular datas e salvar no Banco de Dados (Optimistic Update)
    if (userId) {
        const today = new Date();
        const nextBilling = new Date(today);
        
        if (cycle === 'annual') {
            nextBilling.setFullYear(today.getFullYear() + 1);
        } else {
            nextBilling.setMonth(today.getMonth() + 1);
        }

        await updateUserSubscription(userId, {
            plan: planId,
            status: 'active',
            billingCycle: cycle,
            nextBillingDate: nextBilling.toISOString().split('T')[0],
            paymentMethod: 'CREDIT_CARD', 
            asaasId: subscription.id
        } as any);
    }

    // Não há redirecionamento no checkout transparente. 
    // Se a chamada POST passar, a assinatura foi criada (e a cobrança inicial processada ou agendada).

  } catch (error: any) {
    console.error("Erro no checkout Asaas:", error);
    const msg = error.response?.data?.errors?.[0]?.description || error.message;
    throw new Error(msg);
  }
};

export const updateUserSubscription = async (userId: string, subscription: any) => {
  if (!userId) return;
  const userRef = doc(db, 'users', userId);
  // Merge true to avoid overwriting other user data
  await updateDoc(userRef, {
    subscription: subscription
  });
};