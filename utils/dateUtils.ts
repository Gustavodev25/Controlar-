// Utilitários de data respeitando o fuso horário local
export const toLocalISOString = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString();
};

export const toLocalISODate = (date: Date = new Date()) => toLocalISOString(date).split("T")[0];

export const getCurrentLocalMonth = (date: Date = new Date()) => toLocalISODate(date).slice(0, 7);
