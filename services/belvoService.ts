import { Transaction } from "../types";
import { addTransaction } from "./database";

// --- CONFIGURAÇÕES DA BELVO ---
// Crie sua conta em https://dashboard.belvo.com/ e pegue suas chaves de Sandbox.
// Se deixar vazio, o sistema usará o MOCK MODE automaticamente para você testar a interface.
const BELVO_SECRET_ID = ""; 
const BELVO_SECRET_PASSWORD = ""; 
const BELVO_API_URL = "https://sandbox.belvo.com";

interface BelvoAuthResponse {
  access: string;
}

// --- MOCK DATA GENERATOR ---
// Usado quando as credenciais não estão configuradas ou para testes de UI
const generateMockTransactions = (): Omit<Transaction, 'id'>[] => {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  
  const daysAgo = (days: number) => {
    const d = new Date();
    d.setDate(today.getDate() - days);
    return formatDate(d);
  };

  return [
    {
      description: "Salário Mensal",
      amount: 5200.00,
      date: daysAgo(2),
      type: "income",
      category: "Salário",
      status: "completed",
      memberId: undefined
    },
    {
      description: "Uber *Trip",
      amount: 24.90,
      date: daysAgo(0),
      type: "expense",
      category: "Transporte",
      status: "completed",
      memberId: undefined
    },
    {
      description: "Mercado Livre",
      amount: 129.90,
      date: daysAgo(1),
      type: "expense",
      category: "Compras",
      status: "completed",
      memberId: undefined
    },
    {
      description: "Padaria Estrela",
      amount: 45.50,
      date: daysAgo(1),
      type: "expense",
      category: "Alimentação",
      status: "completed",
      memberId: undefined
    },
    {
      description: "Netflix Assinatura",
      amount: 55.90,
      date: daysAgo(5),
      type: "expense",
      category: "Lazer",
      status: "completed",
      memberId: undefined
    },
    {
      description: "Posto Ipiranga",
      amount: 210.00,
      date: daysAgo(3),
      type: "expense",
      category: "Transporte",
      status: "completed",
      memberId: undefined
    }
  ];
};

// Helper: Map Belvo Categories to App Categories
const mapCategory = (belvoCategory: string): string => {
  const lower = belvoCategory?.toLowerCase() || "";
  
  if (lower.includes("transport") || lower.includes("uber") || lower.includes("gas")) return "Transporte";
  if (lower.includes("food") || lower.includes("groceries") || lower.includes("restaurant")) return "Alimentação";
  if (lower.includes("bills") || lower.includes("utilities") || lower.includes("rent")) return "Moradia";
  if (lower.includes("health")) return "Saúde";
  if (lower.includes("entertainment")) return "Lazer";
  if (lower.includes("income") || lower.includes("salary")) return "Salário";
  
  return "Outros";
};

/**
 * Authenticates with Belvo to get an Access Token.
 */
export const getAccessToken = async (): Promise<string> => {
  // MOCK MODE CHECK
  if (!BELVO_SECRET_ID || !BELVO_SECRET_PASSWORD) {
      console.warn("Belvo Credentials missing. Using Mock Mode.");
      return "mock_token_" + Date.now();
  }

  try {
    const response = await fetch(`${BELVO_API_URL}/api/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        id: BELVO_SECRET_ID,
        password: BELVO_SECRET_PASSWORD,
        scopes: ["read_institutions", "read_links", "read_accounts", "read_transactions"]
      }),
    });

    if (!response.ok) {
        throw new Error(`Falha na autenticação Belvo (${response.status})`);
    }
    
    const data: BelvoAuthResponse = await response.json();
    return data.access;
  } catch (error) {
    console.error("Belvo Auth Exception:", error);
    // Fallback to mock if API fails in dev
    return "mock_token_fallback"; 
  }
};

/**
 * Fetches transactions for a given Link ID (Connection).
 */
export const syncBelvoData = async (userId: string, linkId: string): Promise<number> => {
  // MOCK MODE
  if (linkId.startsWith("mock_link")) {
      console.log("Syncing Mock Data...");
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
      
      const mockTxs = generateMockTransactions();
      let count = 0;
      for (const tx of mockTxs) {
          await addTransaction(userId, tx);
          count++;
      }
      return count;
  }

  // REAL MODE
  try {
    const token = await getAccessToken();
    
    // 1. Get Accounts for the Link
    const accountsRes = await fetch(`${BELVO_API_URL}/api/accounts/?link=${linkId}`, {
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    
    if(!accountsRes.ok) throw new Error("Erro ao buscar contas Belvo");
    const accountsData = await accountsRes.json();
    const accounts = accountsData.results || [];

    if (accounts.length === 0) return 0;

    let importedCount = 0;

    // 2. Get Transactions (Last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];

    const txRes = await fetch(`${BELVO_API_URL}/api/transactions/?link=${linkId}&date_from=${dateFrom}`, {
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
    });
    
    if(txRes.ok) {
        const txData = await txRes.json();
        const transactions = txData.results || [];

        for (const tx of transactions) {
             // Belvo amounts: Outflow is positive, Inflow is positive. 
             // We check type 'INFLOW' or 'OUTFLOW'
             
             const isExpense = tx.type === 'OUTFLOW';
             
             const newTx: Omit<Transaction, 'id'> = {
                description: tx.merchant?.name || tx.description || "Transação Bancária",
                amount: tx.amount, // Assuming amount is always positive in Belvo and type dictates sign
                date: tx.value_date || tx.collected_at.split('T')[0],
                type: isExpense ? 'expense' : 'income',
                category: tx.category ? mapCategory(tx.category) : "Outros",
                status: 'completed',
                memberId: undefined
             };
             
             await addTransaction(userId, newTx);
             importedCount++;
        }
    }
    
    return importedCount;

  } catch (error) {
    console.error("Error syncing Belvo data:", error);
    throw error;
  }
};