
import { toCents, fromCents } from '../utils/moneyUtils';

/**
 * Serviço para cálculos financeiros (juros, multas, taxas)
 */

const LATE_FEE_PERCENTAGE = 0.02; // 2% de multa
const MONTHLY_INTEREST_RATE = 0.15; // 15% ao mês (média de cartão de crédito no Brasil)
const MORA_INTEREST_RATE = 0.01; // 1% ao mês de juros de mora

/**
 * Calcula juros e multas para uma fatura atrasada
 * @param amount - Valor em atraso
 * @param dueDate - Data de vencimento
 * @param calculationDate - Data de cálculo (geralmente hoje)
 */
export const calculateLateCharges = (
  amount: number,
  dueDate: Date,
  calculationDate: Date = new Date()
) => {
  if (calculationDate <= dueDate || amount <= 0) {
    return {
      lateFee: 0,
      interest: 0,
      totalCharges: 0,
      daysOverdue: 0
    };
  }

  const diffTime = Math.abs(calculationDate.getTime() - dueDate.getTime());
  const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const amountCents = toCents(amount);
  
  // 1. Multa fixa (2%)
  const lateFeeCents = Math.round(amountCents * LATE_FEE_PERCENTAGE);
  
  // 2. Juros de mora (1% ao mês pro-rata)
  const moraInterestCents = Math.round((amountCents * (MORA_INTEREST_RATE / 30)) * daysOverdue);
  
  // 3. Juros rotativos (15% ao mês pro-rata) - Opcional dependendo da regra
  const revolvingInterestCents = Math.round((amountCents * (MONTHLY_INTEREST_RATE / 30)) * daysOverdue);

  const totalChargesCents = lateFeeCents + moraInterestCents + revolvingInterestCents;

  return {
    lateFee: fromCents(lateFeeCents),
    interest: fromCents(moraInterestCents + revolvingInterestCents),
    totalCharges: fromCents(totalChargesCents),
    daysOverdue
  };
};
