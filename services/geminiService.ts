
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Transaction, AIParsedTransaction, Reminder, Budget, Investment } from "../types";

// API key read from environment (Vercel/Netlify use VITE_ prefix)
const API_KEY =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
  (typeof process !== "undefined" ? process.env.VITE_GEMINI_API_KEY : "") ||
  "";

export const hasGeminiKey = !!API_KEY;

// Initialize client only when key is set to avoid build failures when config.ts is not present
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const ensureClient = () => {
  if (!ai) {
    throw new Error("MISSING_GEMINI_API_KEY");
  }
  return ai;
};
// Usando Flash pois Ã© rÃ¡pido e excelente com documentos/imagens longos
const MODEL_NAME = "gemini-2.5-flash";

export interface AIParsedReminder {
  description: string;
  amount: number;
  category: string;
  dueDate: string;
  isRecurring: boolean;
  frequency?: 'monthly' | 'weekly' | 'yearly';
  type: 'income' | 'expense';
}

// Helper function to handle 503 Overloaded errors with exponential backoff
async function generateWithRetry(params: any, retries = 5) {
  const client = ensureClient();
  for (let i = 0; i < retries; i++) {
    try {
      return await client.models.generateContent(params);
    } catch (error: any) {
      // Check for various 503 error structures (Standard, Axios, Nested JSON)
      let statusCode = error.status || error.response?.status;
      if (!statusCode && error.error?.code) {
        statusCode = error.error.code;
      }

      const msg = (error.message || JSON.stringify(error)).toLowerCase();

      const isOverloaded =
        statusCode === 503 ||
        msg.includes('overloaded') ||
        msg.includes('unavailable') ||
        msg.includes('503');

      if (isOverloaded) {
        if (i < retries - 1) {
          // Backoff: 2s, 4s, 8s, 16s, 32s
          const delay = 2000 * Math.pow(2, i);
          console.warn(`Gemini overloaded (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error("Failed to generate content after retries");
}

/**
 * Analyzes financial data to provide insights.
 */
export const analyzeFinances = async (transactions: Transaction[], focus: 'general' | 'savings' | 'future' = 'general'): Promise<{ analysis: string }> => {
  if (!transactions.length) return { analysis: "Adicione transações para receber uma análise da IA." };
  if (!API_KEY) return { analysis: "Configure a VITE_GEMINI_API_KEY para usar o consultor IA." };

  const transactionSummary = transactions.slice(0, 50).map(t =>
    `${t.date}: ${t.description} (${t.category}) - R$ ${t.amount} [${t.type}]`
  ).join("\n");

  let focusInstruction = "";
  if (focus === 'savings') {
    focusInstruction = "Foque EXCLUSIVAMENTE em encontrar gastos desnecessários e sugerir cortes práticos. Seja rigoroso.";
  } else if (focus === 'future') {
    focusInstruction = "Foque em projeção. Baseado no gasto atual, diga se o usuário vai fechar o mês no positivo e sugira metas de investimento.";
  } else {
    focusInstruction = "Faça uma análise geral: saúde financeira, categorias mais pesadas e um elogio ou alerta.";
  }

    const prompt = `
    Hoje é: ${todayStr}.
    Você é um assistente financeiro pessoal inteligente e amigável.
    
    O usuário enviou: "${text}"
    
    Contexto recente (apenas para referência):
    ${recentTx}

    Orçamentos do mês:
    ${budgetsSummary || 'Sem orçamentos cadastrados.'}

    Caixinhas/Investimentos:
    ${investmentsSummary || 'Sem caixinhas cadastradas.'}

    Sua tarefa é classificar a intenção e responder adequadamente:
    1. Se for um LANÇAMENTO de gasto ou ganho (ex: "gastei 50 no almoço", "recebi 1000"), extraia os dados.
    2. Se for uma PERGUNTA ou CONVERSA (ex: "como economizar?", "oi", "analise meus gastos"), responda com texto útil e formatado em Markdown.

    Retorne APENAS um JSON neste formato:
    {
      "intent": "transaction" | "chat",
      "chatResponse": "Sua resposta em texto aqui (se intent=chat)",
      "transactionData": { ...dados da transação (se intent=transaction) }
    }

    Para transactionData, siga as regras:
    - amount: número positivo
    - type: 'income' ou 'expense'
    - category: escolha a melhor categoria
    - date: YYYY-MM-DD (hoje se não especificado)
    - description: título curto
    - installments: 1 se à vista
  `;

  try {
    const response = await generateWithRetry({
      model: MODEL_NAME,
      contents: prompt,
    });
    return { analysis: response.text || "Não foi possível gerar análise no momento." };
  } catch (error: any) {
    console.error("Erro ao analisar finanças:", error);
    return { analysis: "O consultor IA está temporariamente indisponível (sobrecarga). Tente novamente em alguns segundos." };
  }
};

/**
 * Parses natural language text into a structured transaction object.
 */
export const parseTransactionFromText = async (text: string): Promise<AIParsedTransaction | null> => {
  if (!API_KEY) throw new Error("MISSING_GEMINI_API_KEY");
  const today = new Date();
  const currentYear = today.getFullYear();
  const todayStr = today.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const prompt = `
    Hoje é: ${todayStr}.
    Você é um assistente financeiro pessoal inteligente e amigável.
    
    O usuário enviou: "${text}"
    
    Contexto recente (apenas para referência):
    ${recentTx}

    Orçamentos do mês:
    ${budgetsSummary || 'Sem orçamentos cadastrados.'}

    Caixinhas/Investimentos:
    ${investmentsSummary || 'Sem caixinhas cadastradas.'}

    Sua tarefa é classificar a intenção e responder adequadamente:
    1. Se for um LANÇAMENTO de gasto ou ganho (ex: "gastei 50 no almoço", "recebi 1000"), extraia os dados.
    2. Se for uma PERGUNTA ou CONVERSA (ex: "como economizar?", "oi", "analise meus gastos"), responda com texto útil e formatado em Markdown.

    Retorne APENAS um JSON neste formato:
    {
      "intent": "transaction" | "chat",
      "chatResponse": "Sua resposta em texto aqui (se intent=chat)",
      "transactionData": { ...dados da transação (se intent=transaction) }
    }

    Para transactionData, siga as regras:
    - amount: número positivo
    - type: 'income' ou 'expense'
    - category: escolha a melhor categoria
    - date: YYYY-MM-DD (hoje se não especificado)
    - description: título curto
    - installments: 1 se à vista
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING },
      amount: { type: Type.NUMBER, description: "Valor da parcela mensal individual" },
      category: { type: Type.STRING },
      date: { type: Type.STRING, description: "YYYY-MM-DD (Data da compra ou da PRIMEIRA parcela)" },
      type: { type: Type.STRING, enum: ["income", "expense"] },
      installments: { type: Type.INTEGER, description: "Quantidade total de parcelas (1 se for à vista)" }
    },
    required: ["description", "amount", "category", "type", "date"]
  };

  try {
    const response = await generateWithRetry({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });

    const result = JSON.parse(response.text || "{}") as AIParsedTransaction;

    // Defaults defensivos - CRITICAL TO AVOID undefined errors in UI
    if (!result.description) result.description = "Nova Transação";
    if (result.amount === undefined || result.amount === null) result.amount = 0;
    if (!result.category) result.category = "Outros";
    if (!result.type) result.type = "expense";
    if (!result.date) result.date = new Date().toISOString().split('T')[0];

    // Garantir fallback de parcelas
    if (!result.installments || result.installments < 1) {
      result.installments = 1;
    }

    return result;
  } catch (error) {
    console.error("Erro ao interpretar texto:", error);
    return null;
  }
};

/**
 * Parses natural language text into a Reminder object.
 */
export const parseReminderFromText = async (text: string): Promise<AIParsedReminder | null> => {
  if (!API_KEY) throw new Error("MISSING_GEMINI_API_KEY");
  const today = new Date().toISOString().split('T')[0];
    const prompt = `
    Hoje é: ${todayStr}.
    Você é um assistente financeiro pessoal inteligente e amigável.
    
    O usuário enviou: "${text}"
    
    Contexto recente (apenas para referência):
    ${recentTx}

    Orçamentos do mês:
    ${budgetsSummary || 'Sem orçamentos cadastrados.'}

    Caixinhas/Investimentos:
    ${investmentsSummary || 'Sem caixinhas cadastradas.'}

    Sua tarefa é classificar a intenção e responder adequadamente:
    1. Se for um LANÇAMENTO de gasto ou ganho (ex: "gastei 50 no almoço", "recebi 1000"), extraia os dados.
    2. Se for uma PERGUNTA ou CONVERSA (ex: "como economizar?", "oi", "analise meus gastos"), responda com texto útil e formatado em Markdown.

    Retorne APENAS um JSON neste formato:
    {
      "intent": "transaction" | "chat",
      "chatResponse": "Sua resposta em texto aqui (se intent=chat)",
      "transactionData": { ...dados da transação (se intent=transaction) }
    }

    Para transactionData, siga as regras:
    - amount: número positivo
    - type: 'income' ou 'expense'
    - category: escolha a melhor categoria
    - date: YYYY-MM-DD (hoje se não especificado)
    - description: título curto
    - installments: 1 se à vista
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING },
      amount: { type: Type.NUMBER },
      category: { type: Type.STRING },
      dueDate: { type: Type.STRING, description: "YYYY-MM-DD" },
      isRecurring: { type: Type.BOOLEAN },
      frequency: { type: Type.STRING, enum: ["monthly", "weekly", "yearly"], nullable: true },
      type: { type: Type.STRING, enum: ["income", "expense"] }
    },
    required: ["description", "amount", "category", "dueDate", "isRecurring", "type"]
  };

  try {
    const response = await generateWithRetry({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });
    const result = JSON.parse(response.text || "{}") as AIParsedReminder;

    if (!result.description) result.description = "Lembrete";
    if (!result.amount) result.amount = 0;
    if (!result.category) result.category = "Outros";
    if (!result.dueDate) result.dueDate = today;
    if (!result.type) result.type = "expense";
    if (result.isRecurring === undefined) result.isRecurring = false;

    return result;
  } catch (error) {
    console.error("Erro ao interpretar lembrete:", error);
    return null;
  }
};

export const parseStatementFile = async (base64Data: string, mimeType: string): Promise<AIParsedTransaction[] | null> => {
  if (!API_KEY) throw new Error("MISSING_GEMINI_API_KEY");
    const prompt = `
    Hoje é: ${todayStr}.
    Você é um assistente financeiro pessoal inteligente e amigável.
    
    O usuário enviou: "${text}"
    
    Contexto recente (apenas para referência):
    ${recentTx}

    Orçamentos do mês:
    ${budgetsSummary || 'Sem orçamentos cadastrados.'}

    Caixinhas/Investimentos:
    ${investmentsSummary || 'Sem caixinhas cadastradas.'}

    Sua tarefa é classificar a intenção e responder adequadamente:
    1. Se for um LANÇAMENTO de gasto ou ganho (ex: "gastei 50 no almoço", "recebi 1000"), extraia os dados.
    2. Se for uma PERGUNTA ou CONVERSA (ex: "como economizar?", "oi", "analise meus gastos"), responda com texto útil e formatado em Markdown.

    Retorne APENAS um JSON neste formato:
    {
      "intent": "transaction" | "chat",
      "chatResponse": "Sua resposta em texto aqui (se intent=chat)",
      "transactionData": { ...dados da transação (se intent=transaction) }
    }

    Para transactionData, siga as regras:
    - amount: número positivo
    - type: 'income' ou 'expense'
    - category: escolha a melhor categoria
    - date: YYYY-MM-DD (hoje se não especificado)
    - description: título curto
    - installments: 1 se à vista
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING },
        amount: { type: Type.NUMBER },
        category: { type: Type.STRING },
        date: { type: Type.STRING, description: "YYYY-MM-DD" },
        type: { type: Type.STRING, enum: ["income", "expense"] }
      },
      required: ["description", "amount", "category", "type", "date"]
    }
  };

  try {
    const response = await generateWithRetry({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const results = JSON.parse(response.text || "[]") as AIParsedTransaction[];
    return results.map(r => ({
      ...r,
      description: r.description || "TransaÃ§Ã£o",
      amount: r.amount || 0,
      category: r.category || "Outros",
      type: r.type || "expense",
      date: r.date || new Date().toISOString().split('T')[0]
    }));
  } catch (error) {
    console.error("Erro ao processar extrato:", error);
    return null;
  }
};


export type AssistantResponse =
  | { type: 'text'; content: string }
  | { type: 'transaction'; data: AIParsedTransaction };

export const processAssistantMessage = async (
  text: string,
  contextTransactions: Transaction[] = [],
  contextBudgets: Budget[] = [],
  contextInvestments: Investment[] = []
): Promise<AssistantResponse> => {
  if (!API_KEY) return { type: 'text', content: "Configure a VITE_GEMINI_API_KEY para usar o assistente." };

  const today = new Date();
  const todayStr = today.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const recentTx = contextTransactions.slice(0, 5).map(t =>
    `${t.date}: ${t.description} (${t.amount})`
  ).join("\n");

  const currentMonth = new Date().toISOString().slice(0, 7);
  const budgetsSummary = contextBudgets.slice(0, 5).map(b => {
    const spent = contextTransactions
      .filter(t => t.type === 'expense' && t.category === b.category && t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum + t.amount, 0);
    const pct = b.limitAmount ? Math.min((spent / b.limitAmount) * 100, 999) : 0;
    return `${b.category}: gasto R$ ${spent.toFixed(2)} de R$ ${Number(b.limitAmount || 0).toFixed(2)} (${pct.toFixed(1)}%)`;
  }).join("\n");

  const investmentsSummary = contextInvestments.slice(0, 5).map(inv => {
    const pct = inv.targetAmount ? Math.min((inv.currentAmount / inv.targetAmount) * 100, 999) : 0;
    return `${inv.name}: R$ ${Number(inv.currentAmount || 0).toFixed(2)} de meta ${Number(inv.targetAmount || 0).toFixed(2)} (${pct.toFixed(1)}%)`;
  }).join("\n");

    const prompt = `
    Hoje é: ${todayStr}.
    Você é um assistente financeiro pessoal inteligente e amigável.
    
    O usuário enviou: "${text}"
    
    Contexto recente (apenas para referência):
    ${recentTx}

    Orçamentos do mês:
    ${budgetsSummary || 'Sem orçamentos cadastrados.'}

    Caixinhas/Investimentos:
    ${investmentsSummary || 'Sem caixinhas cadastradas.'}

    Sua tarefa é classificar a intenção e responder adequadamente:
    1. Se for um LANÇAMENTO de gasto ou ganho (ex: "gastei 50 no almoço", "recebi 1000"), extraia os dados.
    2. Se for uma PERGUNTA ou CONVERSA (ex: "como economizar?", "oi", "analise meus gastos"), responda com texto útil e formatado em Markdown.

    Retorne APENAS um JSON neste formato:
    {
      "intent": "transaction" | "chat",
      "chatResponse": "Sua resposta em texto aqui (se intent=chat)",
      "transactionData": { ...dados da transação (se intent=transaction) }
    }

    Para transactionData, siga as regras:
    - amount: número positivo
    - type: 'income' ou 'expense'
    - category: escolha a melhor categoria
    - date: YYYY-MM-DD (hoje se não especificado)
    - description: título curto
    - installments: 1 se à vista
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      intent: { type: Type.STRING, enum: ["transaction", "chat"] },
      chatResponse: { type: Type.STRING },
      transactionData: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          category: { type: Type.STRING },
          date: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["income", "expense"] },
          installments: { type: Type.INTEGER }
        },
        nullable: true
      }
    },
    required: ["intent"]
  };

  try {
    const response = await generateWithRetry({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema }
    });

    const result = JSON.parse(response.text || "{}");

    if (result.intent === 'transaction' && result.transactionData) {
      const data = result.transactionData as AIParsedTransaction;
      if (!data.date) data.date = new Date().toISOString().split('T')[0];
      if (!data.installments || data.installments < 1) data.installments = 1;
      if (!data.description) data.description = 'Transação';
      if (!data.category) data.category = 'Outros';
      if (!data.type) data.type = 'expense';
      if (!data.amount) data.amount = 0;
      return { type: 'transaction', data };
    }

    return { type: 'text', content: result.chatResponse || "Posso ajudar com seus gastos, orçamentos e caixinhas." };
  } catch (error) {
    console.error("Erro ao processar mensagem do assistente:", error);
    return { type: 'text', content: "Desculpe, estou temporariamente indisponível. Tente novamente em instantes." };
  }
};


