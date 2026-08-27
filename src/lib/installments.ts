/**
 * Utilitários puros para compras parceladas no cartão.
 * Documentação: usados para preview antes de enviar ao backend
 * (a geração real das parcelas é feita pela função SQL create_installment_purchase).
 */

export interface InstallmentPreview {
  number: number;
  amount: number;
  invoiceMonth: Date;
  dueDate: Date;
}

/**
 * Regra: se a compra ocorreu ATÉ o dia de fechamento, cai na fatura do próximo mês.
 * Caso contrário, cai na fatura do mês subsequente.
 */
export function computeInvoiceMonth(purchaseDate: Date, closingDay: number | null | undefined): Date {
  const day = purchaseDate.getDate();
  const closing = closingDay ?? 1;
  const base = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
  base.setMonth(base.getMonth() + (day <= closing ? 1 : 2));
  return base;
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

export function computeDueDate(invoiceMonth: Date, dueDay: number | null | undefined): Date {
  const day = Math.min(dueDay ?? 1, lastDayOfMonth(invoiceMonth.getFullYear(), invoiceMonth.getMonth()));
  return new Date(invoiceMonth.getFullYear(), invoiceMonth.getMonth(), day);
}

export function buildInstallmentsPreview(
  totalAmount: number,
  installments: number,
  purchaseDate: Date,
  closingDay: number | null | undefined,
  dueDay: number | null | undefined,
): InstallmentPreview[] {
  if (!totalAmount || !installments || installments < 1) return [];
  const base = Math.round((totalAmount / installments) * 100) / 100;
  const remainder = Math.round((totalAmount - base * installments) * 100) / 100;
  const firstInvoice = computeInvoiceMonth(purchaseDate, closingDay);
  const out: InstallmentPreview[] = [];
  for (let i = 1; i <= installments; i++) {
    const invoice = new Date(firstInvoice.getFullYear(), firstInvoice.getMonth() + (i - 1), 1);
    const due = computeDueDate(invoice, dueDay);
    const amount = i === installments ? base + remainder : base;
    out.push({ number: i, amount, invoiceMonth: invoice, dueDate: due });
  }
  return out;
}

export function formatMonthYearBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
}
