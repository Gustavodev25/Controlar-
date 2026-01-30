
/**
 * Utilitários para Cálculos Monetários Precisos
 */

/**
 * Converte valor decimal para centavos (inteiro)
 */
export const toCents = (value: number): number => {
  return Math.round(value * 100);
};

/**
 * Converte centavos (inteiro) para valor decimal
 */
export const fromCents = (cents: number): number => {
  return cents / 100;
};

/**
 * Soma valores com precisão de centavos
 */
export const sumMoney = (...values: number[]): number => {
  const totalCents = values.reduce((acc, val) => acc + toCents(val), 0);
  return fromCents(totalCents);
};

/**
 * Formata valor monetário para exibição (BRL)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};
