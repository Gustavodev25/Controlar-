# Implementação do Novo Motor de Faturas (Invoice Builder Pro)

## 1. Utilitários de Data e Calendário Bancário
- Criação do arquivo `utils/dateUtils.ts` para centralizar a lógica de dias úteis.
- Implementação de lista de feriados brasileiros e funções para ajuste de datas de fechamento/vencimento.

## 2. Refatoração do Invoice Builder
- Conversão de cálculos para sistema de centavos (inteiros) para eliminar erros de arredondamento.
- Integração com o novo sistema de datas para períodos de faturamento precisos.
- Implementação de cálculos de juros rotativos e multas para faturas em atraso.

## 3. Sistema de Auditoria
- Inclusão de um log detalhado no retorno do builder para rastrear cada passo do cálculo.
- Identificação clara da origem de cada valor (API vs Calculado vs Manual).

## 4. Validação e Qualidade
- Criação de testes unitários com Vitest cobrindo cenários complexos (parcelamentos longos, estornos, feriados).
- Verificação de consistência entre limite de crédito e soma de transações.

## 5. Experiência do Usuário (UI)
- Atualização da `CreditCardTable.tsx` para refletir as novas métricas de precisão.
- Adição de tooltips informativos sobre a composição dos valores (ex: detalhamento de juros).

**Vou iniciar agora a criação dos utilitários de data.**