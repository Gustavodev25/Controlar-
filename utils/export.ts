
export const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    // Obter cabeçalhos do primeiro objeto
    // Vamos definir uma ordem preferencial para colunas comuns de transação
    const preferredOrder = ['date', 'description', 'amount', 'category', 'type', 'status', 'accountName', 'institution'];

    // achatar o objeto para CSV se necessário, mas aqui vamos assumir que queremos exportar 
    // campos específicos para ficar bonito no Excel

    const headers = [
        { key: 'date', label: 'Data' },
        { key: 'description', label: 'Descrição' },
        { key: 'amount', label: 'Valor' },
        { key: 'category', label: 'Categoria' },
        { key: 'type', label: 'Tipo' },
        { key: 'status', label: 'Status' },
    ];

    const csvContent = [
        headers.map(h => h.label).join(';'), // Header row (usando ; para Excel em PT-BR geralmente reconhecer melhor colunas)
        ...data.map(item => {
            return headers.map(h => {
                let val = item[h.key];

                // Formatar valores específicos
                if (h.key === 'date' && val) {
                    // Assumindo YYYY-MM-DD
                    const [y, m, d] = val.split('-');
                    if (y && m && d) val = `${d}/${m}/${y}`;
                }

                if (h.key === 'amount') {
                    val = (typeof val === 'number') ? val.toFixed(2).replace('.', ',') : val;
                }

                if (h.key === 'type') {
                    val = val === 'income' ? 'Receita' : 'Despesa';
                }

                if (h.key === 'status') {
                    val = val === 'completed' ? 'Pago' : 'Pendente';
                }

                // Escapar aspas duplas e envolver em aspas
                const stringVal = String(val || '');
                if (stringVal.includes(';') || stringVal.includes('"') || stringVal.includes('\n')) {
                    return `"${stringVal.replace(/"/g, '""')}"`;
                }
                return stringVal;
            }).join(';');
        })
    ].join('\r\n');

    // Adicionar BOM para UTF-8 para o Excel abrir com acentos corretos
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
