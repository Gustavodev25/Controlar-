# Relatório Técnico: Análise e Correção de Discrepância na Fatura

## 1. Resumo do Problema
O usuário identificou uma discrepância onde transações datadas de **26/01/2026** estavam sendo incluídas na fatura com fechamento em **25/02/2026** (Fatura de Fevereiro). A dúvida principal era por que transações de janeiro estavam aparecendo nesta fatura.

## 2. Análise do Ciclo de Faturamento
Com o fechamento configurado para o dia **25**:
- A fatura de **Janeiro** fecha em 25/01. Ela abrange transações de ~26/12 a 25/01.
- A fatura de **Fevereiro** fecha em 25/02. Ela abrange transações de **26/01** a 25/02.

Portanto, uma transação realizada em **26/01** pertence tecnicamente ao ciclo de **Fevereiro** (pois 26 > 25).
O comportamento do sistema de incluir o dia 26/01 na fatura de 25/02 está **correto** do ponto de vista da regra de negócio padrão (Fechamento dia X -> Transações a partir de X+1 entram na próxima).

## 3. Identificação de Erros no Sistema
Durante a investigação detalhada do código, foram identificados dois problemas críticos que poderiam causar confusão e inconsistências:

### A. Inconsistência de Lógica (Builder vs Calculator)
Havia uma divergência na regra de corte entre dois serviços essenciais:
- `invoiceBuilder.ts`: Considerava que o dia do fechamento pertence à fatura ATUAL (`>`).
- `invoiceCalculator.ts`: Considerava que o dia do fechamento já pertencia à PRÓXIMA fatura (`>=`).
Isso poderia fazer com que transações do dia 25 fossem exibidas em meses diferentes dependendo da tela (Previsão vs Fatura Real).

### B. Vulnerabilidade de Fuso Horário (Timezone Shift)
O sistema de processamento de datas (`parseDate`) utilizava a conversão padrão do sistema operacional.
- Uma transação vinda do banco como `2026-01-26T00:00:00Z` (UTC) poderia ser interpretada localmente (Brasil) como `2026-01-25 21:00:00`.
- Isso alteraria a data da transação de **26** para **25**, movendo-a incorretamente da fatura de Fevereiro para a de Janeiro.
- **Nota:** No caso relatado, as transações apareceram em Fevereiro (correto para dia 26), o que indica que este erro específico não estava afetando essas transações, mas representava um risco latente para transações próximas à meia-noite ou vindas de fontes UTC.

## 4. Correções Implementadas

### 1. Unificação da Lógica de Corte
O arquivo `services/invoiceCalculator.ts` foi corrigido para alinhar com a regra do `invoiceBuilder.ts`.
**Nova Regra Unificada:** Se o dia da transação for **estritamente maior** que o dia do fechamento, ela vai para a próxima fatura.
- Dia 25 (Fechamento) -> Fatura Atual.
- Dia 26 -> Próxima Fatura.

### 2. Blindagem contra Fuso Horário
As funções de análise de data (`parseDate` e `getInvoiceMonthKey`) foram reescritas para extrair a data (`YYYY-MM-DD`) diretamente da string, ignorando o componente de hora e fuso horário.
Isso garante que uma transação marcada como dia **26** será **sempre** processada como dia 26, independentemente do horário ou fuso do servidor/navegador.

## 5. Conclusão
As transações de 26/01 aparecendo na fatura de 25/02 estão corretas de acordo com o ciclo (26/01 é o primeiro dia do ciclo de Fevereiro). As correções aplicadas garantem que:
1. Não haverá divergência entre previsões e faturas reais.
2. Transações não mudarão de data devido a fusos horários.
3. O sistema está agora robusto e determinístico.

---
**Status:** Resolvido e Verificado via Testes Automatizados.
