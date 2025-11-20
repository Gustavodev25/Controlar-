
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Transaction, AIParsedTransaction, Reminder } from "../types";

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
            console.warn(`Gemini overloaded (Attempt ${i+1}/${retries}). Retrying in ${delay}ms...`);
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
  if (!transactions.length) return { analysis: "Adicione transaÃ§Ãµes para receber uma anÃ¡lise da IA." };
  if (!API_KEY) return { analysis: "Configure a VITE_GEMINI_API_KEY para usar o consultor IA." };

  const transactionSummary = transactions.slice(0, 50).map(t => 
    `${t.date}: ${t.description} (${t.category}) - R$ ${t.amount} [${t.type}]`
  ).join("\n");

  let focusInstruction = "";
  if (focus === 'savings') {
    focusInstruction = "Foque EXCLUSIVAMENTE em encontrar gastos desnecessÃ¡rios e sugerir cortes prÃ¡ticos. Seja rigoroso.";
  } else if (focus === 'future') {
    focusInstruction = "Foque em projeÃ§Ã£o. Baseado no gasto atual, diga se o usuÃ¡rio vai fechar o mÃªs no positivo e sugira metas de investimento.";
  } else {
    focusInstruction = "FaÃ§a uma anÃ¡lise geral: saÃºde financeira, categorias mais pesadas e um elogio ou alerta.";
  }

  const prompt = `
    Atue como um Consultor Financeiro Pessoal de Elite. Analise os dados abaixo (BRL).
    
    Objetivo da anÃ¡lise: ${focusInstruction}

    InstruÃ§Ãµes de FormataÃ§Ã£o (RIGOROSO):
    - Use Markdown.
    - Use ### para tÃ­tulos de seÃ§Ãµes (ex: ### ðŸ“Š Resumo Geral).
    - Use **negrito** para valores e pontos chave.
    - Use listas com marcadores (- ) para facilitar a leitura.
    - Seja direto, evite texto genÃ©rico.
    
    Dados das transaÃ§Ãµes (Amostra das 50 mais recentes):
    ${transactionSummary}
  `;

  try {
    const response = await generateWithRetry({
      model: MODEL_NAME,
      contents: prompt,
    });
    return { analysis: response.text || "NÃ£o foi possÃ­vel gerar anÃ¡lise no momento." };
  } catch (error: any) {
    console.error("Erro ao analisar finanÃ§as:", error);
    return { analysis: "O consultor IA estÃ¡ temporariamente indisponÃ­vel (sobrecarga). Tente novamente em alguns segundos." };
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
    Hoje Ã© EXATAMENTE: ${todayStr}.
    O ANO ATUAL Ã‰ ${currentYear}. 
    ATENÃ‡ÃƒO: Se o usuÃ¡rio nÃ£o especificar o ano, ASSUMA ${currentYear}. NÃƒO USE 2024.

    Analise o texto do usuÃ¡rio e extraia os dados da transaÃ§Ã£o financeira.
    Texto: "${text}"
    
    Regras CrÃ­ticas:
    1. DATA: 
       - Se o usuÃ¡rio nÃ£o falar data, use hoje (${today.toISOString().split('T')[0]}).
       - Se disser "comecei em outubro", a data deve ser outubro DESTE ANO (${currentYear}).
       - Se disser "ontem", calcule baseado na data de hoje (${todayStr}).
    
    2. PARCELAMENTO:
       - Identifique palavras como "10x", "10 vezes", "parcelado em 5".
       - Campo 'installments': NÃºmero total de parcelas.
       - Campo 'amount': O valor de UMA parcela. Se o usuÃ¡rio disser o valor total, divida.
         EXEMPLO 1: "Compra de 1000 reais em 10x". -> amount: 100, installments: 10.
         EXEMPLO 2: "10x de 50 reais". -> amount: 50, installments: 10.
    
    3. CATEGORIA: Escolha entre: AlimentaÃ§Ã£o, Transporte, Moradia, Lazer, SaÃºde, SalÃ¡rio, Investimentos, Outros.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING },
      amount: { type: Type.NUMBER, description: "Valor da parcela mensal individual" },
      category: { type: Type.STRING },
      date: { type: Type.STRING, description: "YYYY-MM-DD (Data da compra ou da PRIMEIRA parcela)" },
      type: { type: Type.STRING, enum: ["income", "expense"] },
      installments: { type: Type.INTEGER, description: "Quantidade total de parcelas (1 se for Ã  vista)" }
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
    if (!result.description) result.description = "Nova TransaÃ§Ã£o";
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
  const prompt = `Analise o texto para um lembrete de conta. Hoje Ã© ${today}. Texto: "${text}"`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING },
      amount: { type: Type.NUMBER },
      category: { type: Type.STRING },
      dueDate: { type: Type.STRING, description: "YYYY-MM-DD" },
      isRecurring: { type: Type.BOOLEAN },
      frequency: { type: Type.STRING, enum: ["monthly", "weekly", "yearly"], nullable: true }
    },
    required: ["description", "amount", "category", "dueDate", "isRecurring"]
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
    Analise este documento (extrato bancÃ¡rio) e extraia todas as transaÃ§Ãµes financeiras listadas.
    Ignore saldos e cabeÃ§alhos irrelevantes.
    Ano atual de referÃªncia: ${new Date().getFullYear()}.
    
    Para cada transaÃ§Ã£o:
    - DescriÃ§Ã£o: Nome do estabelecimento.
    - Valor: Positivo.
    - Data: YYYY-MM-DD.
    - Tipo: 'expense' ou 'income'.
    - Categoria: Sugira uma.
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

