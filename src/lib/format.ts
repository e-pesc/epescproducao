/**
 * Format a number as Brazilian Real (BRL) currency.
 * Handles null/undefined/NaN gracefully → R$ 0,00
 */
export function formatBRL(value: number | null | undefined): string {
  const num = Number(value) || 0;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
