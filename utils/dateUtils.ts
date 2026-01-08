// Utilitários de data respeitando o fuso horário local
export const toLocalISOString = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString();
};

export const toLocalISODate = (date: Date = new Date()) => toLocalISOString(date).split("T")[0];

export const getCurrentLocalMonth = (date: Date = new Date()) => toLocalISODate(date).slice(0, 7);

// Helper to determine if a date is a business day (Mon-Fri)
export const isBusinessDay = (date: Date): boolean => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

// Helper to add business days to a date
export const addBusinessDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      added++;
    }
  }
  return result;
};

// Helper to get the Nth business day of a month
export const getNthBusinessDay = (year: number, month: number, n: number): Date => {
  let date = new Date(year, month, 1);
  // Adjust if the 1st is not a business day?
  // Usually "5th business day" means counting business days from the start.
  // If 1st is Saturday, 2nd Sunday, 3rd Monday (1st business day).
  let count = 0;

  // Start checking from day 1
  while (count < n) {
    if (isBusinessDay(date)) {
      count++;
    }
    if (count < n) {
      date.setDate(date.getDate() + 1);
    }
  }
  return date;
};

// Helper to get the last business day of a month
export const getLastBusinessDay = (year: number, month: number): Date => {
  const lastDay = new Date(year, month + 1, 0); // Last day of the month
  while (!isBusinessDay(lastDay)) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return lastDay;
};

// Main function to calculate payment date based on configuration
export const calculatePaymentDate = (paymentDay: number | string, referenceDate: Date = new Date()): Date => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  // Check if paymentDay is a special string
  if (typeof paymentDay === 'string') {
    if (paymentDay === 'business_day_5') {
      return getNthBusinessDay(year, month, 5);
    }
    if (paymentDay === 'business_day_last') {
      return getLastBusinessDay(year, month);
    }
    if (paymentDay === 'last_day') {
      return new Date(year, month + 1, 0);
    }
  }

  // Handle number (fixed day)
  const day = typeof paymentDay === 'string' ? parseInt(paymentDay) : paymentDay;
  if (!isNaN(day)) {
    // Handle overflow (e.g. Feb 30) -> Last day of month
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay));
  }

  // Fallback
  return new Date(year, month, 5);
};
