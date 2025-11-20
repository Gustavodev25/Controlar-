
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Transaction, AIParsedTransaction, Reminder } from "../types";

// Initialize Gemini Client
// NOTE: In a real production app, these calls would likely go through a backend proxy to secure the key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = "gemini-2.5-flash";

export interface AIParsedReminder {
  description: string;
  amount: number;
  category: string;
  dueDate: string;
  isRecurring: boolean;
  frequency?: 'monthly' | 'weekly' | 'yearly';
}

/**
 * Analyzes financial data to provide insights.
 */
export const analyzeFinances = async (transactions: Transaction[], focus: 'general' | 'savings' | 'future' = 'general'): Promise<{ analysis: string }> => {
  if (!transactions.length) return { analysis: "Adicione transações para receber uma análise da IA." };

  const transactionSummary = transactions.map(t => 
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
    Atue como um Consultor Financeiro Pessoal de Elite. Analise os dados abaixo (BRL).
    
    Objetivo da análise: ${focusInstruction}

    Instruções de Formatação (RIGOROSO):
    - Use Markdown.
    - Use ### para títulos de seções (ex: ### 📊 Resumo Geral).
    - Use **negrito** para valores e pontos chave.
    - Use listas com marcadores (- ) para facilitar a leitura.
    - Seja direto, evite texto genérico. Fale diretamente com o usuário ("Você gastou...").
    
    Dados das transações:
    ${transactionSummary}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return { analysis: response.text || "Não foi possível gerar análise no momento." };
  } catch (error: any) {
    console.error("Erro ao analisar finanças:", error);
    
    // Handle Leaked/Invalid Key Error
    if (error.toString().includes("leaked") || error.message?.includes("leaked") || error.toString().includes("403") || error.status === "PERMISSION_DENIED") {
       return { analysis: "### ⚠️ Chave de API Bloqueada\n\nA chave de API utilizada foi identificada como vazada ou inválida pelo Google. \n\n**Para corrigir:**\n1. Gere uma nova chave no Google AI Studio.\n2. Atualize o arquivo `.env` ou a configuração de ambiente do projeto." };
    }

    return { analysis: "Erro ao conectar com o serviço de IA. Verifique sua chave de API ou tente novamente mais tarde." };
  }
};

/**
 * Parses natural language text into a structured transaction object.
 */
export const parseTransactionFromText = async (text: string): Promise<AIParsedTransaction | null> => {
  const prompt = `
    Analise o seguinte texto e extraia os dados de uma transação financeira.
    
    PRIORIDADE DE CATEGORIZAÇÃO:
    Tente categorizar a transação em uma das seguintes opções principais se fizer sentido:
    - 'Alimentação' (mercado, restaurantes, delivery)
    - 'Transporte' (uber, gasolina, ônibus, manutenção)
    - 'Moradia' (aluguel, luz, internet, condomínio)
    - 'Lazer' (cinema, jogos, streaming, festas)
    - 'Saúde' (farmácia, médico, plano de saúde)
    - 'Salário' (ou Renda Extra)
    
    Se não se encaixar nessas, use uma categoria curta e descritiva (ex: 'Educação', 'Compras').
    Se a data não for especificada, use a data de hoje (YYYY-MM-DD).
    
    Texto do usuário: "${text}"
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING, description: "Descrição curta da transação" },
      amount: { type: Type.NUMBER, description: "Valor numérico da transação" },
      category: { type: Type.STRING, description: "Categoria da transação" },
      date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
      type: { type: Type.STRING, enum: ["income", "expense"], description: "Tipo da transação" }
    },
    required: ["description", "amount", "category", "type", "date"]
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const resultText = response.text;
    if (!resultText) return null;

    return JSON.parse(resultText) as AIParsedTransaction;
  } catch (error: any) {
    console.error("Erro ao interpretar texto:", error);
    if (error.toString().includes("leaked") || error.message?.includes("leaked")) {
        console.warn("API Key leaked - functionality disabled");
    }
    return null;
  }
};

/**
 * Parses natural language text into a Reminder object.
 */
export const parseReminderFromText = async (text: string): Promise<AIParsedReminder | null> => {
  const today = new Date().toISOString().split('T')[0];
  
  const prompt = `
    Analise o seguinte texto e extraia os dados de um Lembrete de Pagamento (Conta a Pagar).
    
    Data de Referência (Hoje): ${today}
    
    Instruções de Data:
    - Se o usuário disser "dia 15", assuma o próximo dia 15 mais próximo (se hoje é dia 20, dia 15 é do próximo mês).
    - Se disser "daqui a 3 dias", calcule a data baseada em ${today}.
    - Se não tiver data específica, assuma ${today}.

    Instruções de Recorrência:
    - Se disser "todo mês", "mensal", "assinatura", isRecurring = true, frequency = 'monthly'.
    - Se disser "toda semana", "semanal", isRecurring = true, frequency = 'weekly'.
    - Se disser "todo ano" ou "anual", isRecurring = true, frequency = 'yearly'.
    - Se não mencionar repetição, isRecurring = false.
    
    Categorias sugeridas: Moradia, Alimentação, Saúde, Educação, Lazer, Investimentos, Cartão de Crédito.
    
    Texto do usuário: "${text}"
  `;

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
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const resultText = response.text;
    if (!resultText) return null;
    return JSON.parse(resultText) as AIParsedReminder;
  } catch (error: any) {
    console.error("Erro ao interpretar lembrete:", error);
    return null;
  }
};
