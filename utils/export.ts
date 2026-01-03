
export const exportToCSV = (data: any[], filename: string, customHeaders?: { key: string, label: string }[]) => {
    if (!data || data.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    // Obter cabeçalhos do primeiro objeto
    // Vamos definir uma ordem preferencial para colunas comuns de transação
    const preferredOrder = ['date', 'description', 'amount', 'category', 'type', 'status', 'accountName', 'institution'];

    // achatar o objeto para CSV se necessário, mas aqui vamos assumir que queremos exportar 
    // campos específicos para ficar bonito no Excel

    // Headers configuration
    let headers: { key: string, label: string }[] = [];

    if (customHeaders && customHeaders.length > 0) {
        headers = customHeaders;
    } else {
        // Default headers for transactions (backward compatibility)
        headers = [
            { key: 'date', label: 'Data' },
            { key: 'description', label: 'Descrição' },
            { key: 'amount', label: 'Valor' },
            { key: 'category', label: 'Categoria' },
            { key: 'type', label: 'Tipo' },
            { key: 'status', label: 'Status' },
        ];
    }

    const csvContent = [
        headers.map(h => h.label).join(';'), // Header row
        ...data.map(item => {
            return headers.map(h => {
                let val = item[h.key];

                // Formatting logic based on legacy keys or generic type checks
                // For custom exports, we expect data to be mostly pre-formatted strings, 
                // but we keep the formatters for the legacy transaction export.

                // Date formatting (legacy support)
                if (h.key === 'date' && val && typeof val === 'string' && val.includes('-')) {
                    const parts = val.split('-');
                    if (parts.length === 3) {
                        const [y, m, d] = parts;
                        if (y.length === 4) val = `${d}/${m}/${y}`;
                    }
                }

                if (h.key === 'amount' && typeof val === 'number') {
                    val = val.toFixed(2).replace('.', ',');
                }

                if (h.key === 'type' && !customHeaders) {
                    val = val === 'income' ? 'Receita' : 'Despesa';
                }

                if (h.key === 'status' && !customHeaders) {
                    val = val === 'completed' ? 'Pago' : 'Pendente';
                }

                // Escape double quotes and wrap in quotes
                const stringVal = String(val !== undefined && val !== null ? val : '');
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
