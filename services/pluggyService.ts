
import { Transaction } from "../types";
import { addTransaction } from "./database";

// CREDENCIAIS HARDCODED (Inseridas diretamente conforme solicitado)
const PLUGGY_CLIENT_ID = "dbec653f-8d09-4300-bf66-dac77475ad73";
const PLUGGY_CLIENT_SECRET = "92e6d41f-75de-40ba-ac5f-978d46cc63d7";
const API_URL = "https://api.pluggy.ai";

interface PluggyAuthResponse {
  apiKey: string;
}

interface PluggyConnectTokenResponse {
  accessToken: string;
}

// Helper: Map Pluggy Categories to App Categories
const mapCategory = (pluggyCategory: string): string => {
  const lower = pluggyCategory?.toLowerCase() || "";
  
  if (lower.includes("transport") || lower.includes("uber") || lower.includes("posto") || lower.includes("gasolina")) return "Transporte";
  if (lower.includes("food") || lower.includes("aliment") || lower.includes("restaurante") || lower.includes("ifood") || lower.includes("mercado")) return "Alimentação";
  if (lower.includes("home") || lower.includes("housing") || lower.includes("aluguel") || lower.includes("luz") || lower.includes("internet") || lower.includes("condominio")) return "Moradia";
  if (lower.includes("health") || lower.includes("saude") || lower.includes("farmacia") || lower.includes("drogaria")) return "Saúde";
  if (lower.includes("entertainment") || lower.includes("lazer") || lower.includes("streaming") || lower.includes("cinema")) return "Lazer";
  if (lower.includes("shopping") || lower.includes("compras") || lower.includes("loja")) return "Outros";
  if (lower.includes("transfer") && lower.includes("credit")) return "Salário";
  
  return "Outros";
};

/**
 * Authenticates with Pluggy to get an API Key.
 */
const authenticate = async (): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error("Pluggy Auth Error:", errText);
        throw new Error(`Falha na autenticação Pluggy (${response.status})`);
    }
    
    const data: PluggyAuthResponse = await response.json();
    if (!data.apiKey) {
         throw new Error("Chave de API não retornada pelo Pluggy.");
    }
    return data.apiKey;
  } catch (error) {
    console.error("Pluggy Auth Exception:", error);
    throw error;
  }
};

/**
 * Creates a Connect Token to initialize the widget.
 */
export const createConnectToken = async (): Promise<string> => {
  try {
    const apiKey = await authenticate();
    
    // Usando um ID fixo e simples para Sandbox para evitar problemas de validação
    const staticUserId = "financas-ai-guest";

    const response = await fetch(`${API_URL}/connect_tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-KEY": apiKey
      },
      body: JSON.stringify({
        clientUserId: staticUserId,
        options: {
           clientUserName: "Visitante Finanças AI",
           clientUserEmail: "guest@financas.ai"
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Pluggy Connect Token Error Body:", errText);
      
      if (response.status === 403) {
         throw new Error("Acesso Negado (403). Verifique suas credenciais de Sandbox.");
      }
      throw new Error(`Erro API Pluggy: ${response.status} - ${errText}`);
    }

    const data: PluggyConnectTokenResponse = await response.json();
    return data.accessToken;
  } catch (error) {
    console.error("Pluggy Connect Token Exception:", error);
    throw error;
  }
};

/**
 * Fetches accounts and transactions.
 */
export const syncPluggyData = async (userId: string, itemId: string): Promise<number> => {
  try {
    const apiKey = await authenticate();
    let importedCount = 0;

    // 1. Get Accounts
    const accountsRes = await fetch(`${API_URL}/accounts?itemId=${itemId}`, {
      headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
    });
    
    if(!accountsRes.ok) {
        const err = await accountsRes.text();
        console.error("Error fetching accounts:", err);
        throw new Error("Erro ao buscar contas");
    }
    
    const accountsData = await accountsRes.json();
    const accounts = accountsData.results || [];

    if (accounts.length === 0) return 0;

    // 2. Get Transactions (Last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

    for (const account of accounts) {
        const txRes = await fetch(`${API_URL}/transactions?accountId=${account.id}&from=${fromDate}`, {
            headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
        });
        
        if(!txRes.ok) continue;
        const txData = await txRes.json();
        const transactions = txData.results || [];

        // 3. Map and Save
        for (const tx of transactions) {
            const isExpense = tx.amount < 0;
            const absAmount = Math.abs(tx.amount);
            
            const newTx: Omit<Transaction, 'id'> = {
                description: tx.description,
                amount: absAmount,
                date: tx.date.split('T')[0],
                type: isExpense ? 'expense' : 'income',
                category: tx.category ? mapCategory(tx.category) : mapCategory(tx.description),
                status: 'completed',
                memberId: undefined // Belongs to the main user flow for now
            };

            await addTransaction(userId, newTx);
            importedCount++;
        }
    }
    
    return importedCount;

  } catch (error) {
    console.error("Error syncing Pluggy data:", error);
    throw error;
  }
};
