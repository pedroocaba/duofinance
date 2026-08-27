import { formatCurrency } from "@/lib/finance-queries";
import { variation } from "@/lib/dashboard-metrics";
import { TrendBadge } from "./kpi-card";

export interface CompareStatProps {
  label: string;
  current: number;
  previous: number;
  currentLabel?: string;
  previousLabel?: string;
  /** Se true, alta é ruim (ex: despesas). */
  invert?: boolean;
  format?: (n: number) => string;
}

/** Comparativo período atual × anterior. */
export function CompareStat({
  label,
  current,
  previous,
  currentLabel = "Atual",
  previousLabel = "Anterior",
  invert,
  format = formatCurrency,
}: CompareStatProps) {
  const v = variation(current, previous);
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <TrendBadge pct={v.pct} direction={v.direction} invert={invert} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-lg font-semibold tracking-tight">{format(current)}</p>
        <p className="text-[11px] text-muted-foreground">{currentLabel}</p>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {previousLabel}: <span className="tabular-nums">{format(previous)}</span>
      </p>
    </div>
  );
}
