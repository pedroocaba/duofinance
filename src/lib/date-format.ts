/**
 * Helpers de formatação em Português do Brasil (dd/MM/yyyy, R$, América/São_Paulo).
 */

const TZ = "America/Sao_Paulo";

export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function formatDateTimeBR(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { timeZone: TZ });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
