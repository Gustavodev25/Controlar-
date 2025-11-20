
import { Transaction } from "../types";
import { addTransaction } from "./database";

// --- OFX PARSER UTILITY ---
// Um parser leve e eficiente para arquivos .OFX (Open Financial Exchange)
export const parseOFX = async (userId: string, file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return resolve(0);

            try {
                const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
                const matches = text.match(regex);
                
                if (!matches) return resolve(0);

                let count = 0;

                for (const block of matches) {
                    const amountMatch = block.match(/<TRNAMT>([\d\.\-\+]+)/);
                    const dateMatch = block.match(/<DTPOSTED>(\d{8})/);
                    const memoMatch = block.match(/<MEMO>(.*?)<|$/);
                    
                    if (amountMatch && dateMatch) {
                        const rawAmount = parseFloat(amountMatch[1]);
                        const absAmount = Math.abs(rawAmount);
                        
                        const rawDate = dateMatch[1]; 
                        const dateStr = `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`;
                        
                        const description = memoMatch ? memoMatch[1].trim().replace(/&amp;/g, '&') : "Transação OFX";
                        
                        let category = "Outros";
                        const descLower = description.toLowerCase();
                        if (descLower.includes('uber') || descLower.includes('posto') || descLower.includes('combustivel')) category = "Transporte";
                        if (descLower.includes('ifood') || descLower.includes('restaurante') || descLower.includes('mercado') || descLower.includes('pao')) category = "Alimentação";
                        if (descLower.includes('aluguel') || descLower.includes('luz') || descLower.includes('internet') || descLower.includes('condominio')) category = "Moradia";
                        if (descLower.includes('farmacia') || descLower.includes('drogaria') || descLower.includes('medico')) category = "Saúde";
                        if (descLower.includes('pix recebido') || descLower.includes('salario') || descLower.includes('pagamento')) category = "Salário";

                        const newTx: Omit<Transaction, 'id'> = {
                            description,
                            amount: absAmount,
                            date: dateStr,
                            type: rawAmount < 0 ? 'expense' : 'income',
                            category,
                            status: 'completed',
                            memberId: undefined
                        };

                        await addTransaction(userId, newTx);
                        count++;
                    }
                }
                resolve(count);
            } catch (err) {
                console.error("Erro ao processar OFX:", err);
                reject(err);
            }
        };
        reader.readAsText(file);
    });
};

// --- SIMULADOR DE DADOS BANCÁRIOS ---
// Gera dados realistas baseados no banco escolhido para satisfazer a experiência de "Conexão com Sucesso"
export const generateMockData = async (userId: string, bankName: string): Promise<number> => {
    const today = new Date();
    const daysAgo = (days: number) => {
        const d = new Date();
        d.setDate(today.getDate() - days);
        return d.toISOString().split('T')[0];
    };

    let transactions: Omit<Transaction, 'id'>[] = [];

    if (bankName === 'Nubank') {
        transactions = [
            { description: "Transferência Pix - João Silva", amount: 150.00, date: daysAgo(0), type: "expense", category: "Outros", status: "completed", memberId: undefined },
            { description: "Ifood *Restaurante", amount: 89.90, date: daysAgo(1), type: "expense", category: "Alimentação", status: "completed", memberId: undefined },
            { description: "Pagamento Fatura Cartão", amount: 1250.00, date: daysAgo(5), type: "expense", category: "Outros", status: "completed", memberId: undefined },
            { description: "Spotify", amount: 21.90, date: daysAgo(2), type: "expense", category: "Lazer", status: "completed", memberId: undefined },
            { description: "Uber *Viagem", amount: 14.90, date: daysAgo(3), type: "expense", category: "Transporte", status: "completed", memberId: undefined },
            { description: "Rendimento da Conta", amount: 45.20, date: daysAgo(1), type: "income", category: "Investimentos", status: "completed", memberId: undefined }
        ];
    } else if (bankName === 'Itaú') {
        transactions = [
            { description: "SISPAG SALARIOS", amount: 4800.00, date: daysAgo(2), type: "income", category: "Salário", status: "completed", memberId: undefined },
            { description: "ESTB ITAU SOB MEDIDA", amount: 68.00, date: daysAgo(10), type: "expense", category: "Outros", status: "completed", memberId: undefined },
            { description: "PAG BOLETO ELETRICID", amount: 180.50, date: daysAgo(5), type: "expense", category: "Moradia", status: "completed", memberId: undefined },
            { description: "SUPERMERCADO EXTRA", amount: 450.10, date: daysAgo(1), type: "expense", category: "Alimentação", status: "completed", memberId: undefined },
            { description: "NETFLIX.COM", amount: 55.90, date: daysAgo(4), type: "expense", category: "Lazer", status: "completed", memberId: undefined }
        ];
    } else {
        // Genérico
        transactions = [
            { description: "Depósito Recebido", amount: 2000.00, date: daysAgo(1), type: "income", category: "Renda", status: "completed", memberId: undefined },
            { description: "Compra Mercado", amount: 300.00, date: daysAgo(2), type: "expense", category: "Alimentação", status: "completed", memberId: undefined },
            { description: "Posto de Gasolina", amount: 150.00, date: daysAgo(3), type: "expense", category: "Transporte", status: "completed", memberId: undefined }
        ];
    }

    for (const tx of transactions) {
        await addTransaction(userId, tx);
    }
    
    return transactions.length;
};
