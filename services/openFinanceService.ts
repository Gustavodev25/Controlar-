
import { Transaction } from "../types";
import { addTransaction } from "./database";
import { toLocalISODate } from "../utils/dateUtils";

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
                        const dateStr = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;

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
        return toLocalISODate(d);
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

export const translatePluggyCategory = (category: string | undefined | null): string => {
    if (!category) return 'Outros';

    // Mapeamento case-insensitive - chaves em lowercase
    const map: Record<string, string> = {
        // Renda / Income
        'salary': 'Salário',
        'retirement': 'Aposentadoria',
        'government aid': 'Benefícios',
        'non-recurring income': 'Rendimentos extras',
        'loans': 'Empréstimos',
        'interests charged': 'Juros',
        'fixed income': 'Renda fixa',
        'variable income': 'Renda variável',
        'proceeds interests and dividends': 'Juros e dividendos',
        'income': 'Receita',

        // Transferências
        'same person transfer - pix': 'Transf. própria Pix',
        'transfer - pix': 'Transf. Pix',
        'third party transfer - pix': 'Transf. Terceiros Pix',
        'same person transfer': 'Transf. própria',
        'transfer - ted': 'Transferência TED',
        'transfer - foreign exchange': 'Câmbio',
        'transfers': 'Transferências',
        'transfer': 'Transferência',

        // Pagamentos
        'credit card payment': 'Pagamento de Fatura',
        'bank slip': 'Boleto',
        'debt card': 'Cartão débito',
        'debit card': 'Cartão débito',

        // Telecomunicações
        'telecommunications': 'Telecom',
        'internet': 'Internet',
        'mobile': 'Celular',

        // Educação
        'school': 'Escola',
        'university': 'Universidade',
        'education': 'Educação',

        // Saúde e Bem-estar
        'gyms and fitness centers': 'Academia',
        'wellness': 'Bem-estar',
        'pharmacy': 'Farmácia',
        'hospital clinics and labs': 'Clínicas / exames',
        'health insurance': 'Plano de saúde',
        'dentist': 'Dentista',
        'health': 'Saúde',

        // Entretenimento e Lazer
        'cinema, theater and concerts': 'Cinema / shows',
        'video streaming': 'Streaming vídeo',
        'music streaming': 'Streaming música',
        'lottery': 'Loterias',
        'gambling': 'Jogos / Apostas',
        'tickets': 'Ingressos',
        'leisure': 'Lazer',
        'entertainment': 'Lazer',

        // Compras
        'online shopping': 'Compras Online',
        'electronics': 'Eletrônicos',
        'clothing': 'Roupas',
        'shopping': 'Compras',
        'bookstore': 'Livraria',
        'pet supplies and vet': 'Pet Shop / Vet',
        'houseware': 'Casa e Decoração',

        // Alimentação
        'eating out': 'Restaurante',
        'food delivery': 'Delivery',
        'groceries': 'Supermercado',
        'food': 'Alimentação',
        'n/a': 'Supermercado',

        // Viagem e Hospedagem
        'airport and airlines': 'Passagens aéreas',
        'accommodation': 'Hospedagem',
        'accomodation': 'Hospedagem',
        'travel': 'Viagem',

        // Transporte
        'taxi and ride-hailing': 'Táxi / apps',
        'public transportation': 'Ônibus / metrô',
        'car rental': 'Aluguel carro',
        'bicycle': 'Bicicleta',
        'gas stations': 'Combustível',
        'parking': 'Estacionamento',
        'tolls and in vehicle payment': 'Pedágios',
        'vehicle maintenance': 'Manutenção Auto',
        'transport': 'Transporte',

        // Seguros
        'vehicle insurance': 'Seguro auto',
        'insurance': 'Seguros',

        // Moradia
        'rent': 'Aluguel',
        'electricity': 'Luz',
        'water': 'Água',
        'housing': 'Moradia',
        'utilities': 'Contas',

        // Impostos e Tarifas
        'income taxes': 'IR',
        'account fees': 'Tarifas conta',
        'credit card fees': 'Tarifas cartão',
        'taxes': 'Impostos',

        // Serviços e Investimentos
        'digital services': 'Serviços digitais',
        'services': 'Serviços',
        'investments': 'Investimentos',
        'investment': 'Investimento',
        'mileage programs': 'Milhas',
        'entrepreneurial activities': 'Empreendedorismo',

        // Outros
        'alimony': 'Pensão',
        'donation': 'Doações',
        'donations': 'Doações',
        'withdraw': 'Saque',
        'others': 'Outros',

        // Encargos e Taxas Financeiras
        'tax on financial operations': 'IOF',
        'late payment and overdraft costs': 'Encargos e Juros',
        'late payment': 'Multa por Atraso',
        'overdraft': 'Cheque Especial',
        'overdraft costs': 'Cheque Especial',
        'interest': 'Juros',
        'fee': 'Taxa',
        'fees': 'Taxas',
        'finance charges': 'Encargos Financeiros',
        'bank charges': 'Tarifas Bancárias',
        'bank fees': 'Tarifas Bancárias',
        'service charge': 'Taxa de Serviço',
        'service charges': 'Taxas de Serviço',
        'maintenance fee': 'Taxa de Manutenção',
        'annual fee': 'Anuidade',
        'monthly fee': 'Mensalidade',
        'transaction fee': 'Taxa de Transação',
        'atm fee': 'Taxa de Saque',
        'wire transfer fee': 'Taxa de Transferência',
        'foreign transaction fee': 'Taxa de Câmbio',
        'penalty': 'Multa',
        'penalties': 'Multas',
        'uncategorized': 'Outros',
        'unknown': 'Outros',
        'other': 'Outros',
        'miscellaneous': 'Diversos',
        'general': 'Geral',
        'unspecified': 'Não Especificado'
    };

    // Busca case-insensitive
    const lowerCategory = category.toLowerCase().trim();

    if (map[lowerCategory]) {
        return map[lowerCategory];
    }

    // Se não encontrar, capitaliza a primeira letra e retorna
    return category.charAt(0).toUpperCase() + category.slice(1);
};
