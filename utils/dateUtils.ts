
/**
 * Utilitários de Data para Regras Bancárias Brasileiras
 */

// Feriados Nacionais Brasileiros (Fixos)
const NATIONAL_HOLIDAYS = [
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência do Brasil
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Dia da Consciência Negra (Novo feriado nacional)
  '12-25', // Natal
];

/**
 * Calcula feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi)
 * Baseado no cálculo da Páscoa (Algoritmo de Meeus/Jones/Butcher)
 */
const getMovableHolidays = (year: number): string[] => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month - 1, day);
  
  const formatDate = (date: Date) => {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${m}-${d}`;
  };

  const holidays = [];
  
  // Carnaval (47 dias antes da Páscoa)
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);
  holidays.push(formatDate(carnival));
  
  // Segunda de Carnaval (48 dias antes da Páscoa)
  const carnivalMonday = new Date(easter);
  carnivalMonday.setDate(easter.getDate() - 48);
  holidays.push(formatDate(carnivalMonday));

  // Sexta-feira Santa (2 dias antes da Páscoa)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push(formatDate(goodFriday));

  // Corpus Christi (60 dias após a Páscoa)
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays.push(formatDate(corpusChristi));

  return holidays;
};

/**
 * Verifica se uma data é feriado nacional ou móvel
 */
export const isHoliday = (date: Date): boolean => {
  const year = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${m}-${d}`;

  if (NATIONAL_HOLIDAYS.includes(dateStr)) return true;
  
  const movable = getMovableHolidays(year);
  return movable.includes(dateStr);
};

/**
 * Verifica se é dia útil (segunda a sexta e não feriado)
 */
export const isBusinessDay = (date: Date): boolean => {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Domingo ou Sábado
  return !isHoliday(date);
};

/**
 * Retorna o próximo dia útil a partir de uma data
 */
export const getNextBusinessDay = (date: Date): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (!isBusinessDay(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

/**
 * Retorna o dia útil anterior a partir de uma data
 */
export const getPreviousBusinessDay = (date: Date): Date => {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  while (!isBusinessDay(prev)) {
    prev.setDate(prev.getDate() - 1);
  }
  return prev;
};

/**
 * Ajusta data de vencimento bancário.
 * Se cair em fim de semana ou feriado, move para o PRÓXIMO dia útil.
 */
export const adjustDueDate = (date: Date): Date => {
  if (isBusinessDay(date)) return date;
  
  const adjusted = new Date(date);
  while (!isBusinessDay(adjusted)) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  return adjusted;
};

/**
 * Ajusta data de fechamento de fatura.
 * Regra comum: Se o dia de fechamento cai em fim de semana/feriado, 
 * o fechamento ocorre no dia útil ANTERIOR para garantir que a fatura
 * seja processada antes do vencimento.
 */
export const adjustClosingDate = (date: Date): Date => {
  if (isBusinessDay(date)) return date;
  
  const adjusted = new Date(date);
  while (!isBusinessDay(adjusted)) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  return adjusted;
};

/**
 * Retorna uma data no formato ISO local (YYYY-MM-DD)
 * Evita problemas de fuso horário que o .toISOString() costuma causar
 */
export const toLocalISODate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Retorna uma data e hora no formato ISO local (YYYY-MM-DDTHH:mm:ss.sss)
 */
export const toLocalISOString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
};

/**
 * Retorna o mês atual no formato local (YYYY-MM)
 */
export const getCurrentLocalMonth = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Calcula a data de pagamento com base em regras (Dia fixo ou Dia Útil)
 */
export const calculatePaymentDate = (paymentDay: number | string, referenceDate: Date): Date => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  if (paymentDay === 'business_day_5') {
    let date = new Date(year, month, 1);
    let businessDaysCount = 0;
    while (businessDaysCount < 5) {
      if (isBusinessDay(date)) {
        businessDaysCount++;
      }
      if (businessDaysCount < 5) {
        date.setDate(date.getDate() + 1);
      }
    }
    return date;
  }

  if (paymentDay === 'business_day_last') {
    let date = new Date(year, month + 1, 0); // Last day of month
    while (!isBusinessDay(date)) {
      date.setDate(date.getDate() - 1);
    }
    return date;
  }

  if (paymentDay === 'last_day') {
    return new Date(year, month + 1, 0);
  }

  // Dia Fixo
  const day = typeof paymentDay === 'string' ? parseInt(paymentDay) : paymentDay;
  const date = new Date(year, month, day);
  
  // Se cair em fim de semana ou feriado, move para o próximo dia útil
  return adjustDueDate(date);
};
