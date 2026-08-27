import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "default" | "positive" | "negative" | "highlight";

export interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: KpiTone;
  trend?: {
    pct: number;
    direction: "up" | "down" | "flat";
    /** Se true, "up" é ruim (ex: despesas subiram). */
    invert?: boolean;
    label?: string;
  };
}

/** Card de KPI reutilizável — usado em dashboards e páginas de detalhe. */
export function KpiCard({ label, value, hint, icon, tone = "default", trend }: KpiCardProps) {
  const highlight = tone === "highlight";
  return (
    <div
      className={cn(
        "card-surface p-4 transition-shadow hover:shadow-md md:p-5",
        highlight && "border-primary bg-primary text-primary-foreground",
      )}
    >
      <div className="flex items-center justify-between">
        <p className={cn("text-xs", highlight ? "opacity-80" : "text-muted-foreground")}>{label}</p>
        {icon && <span className={highlight ? "opacity-80" : "text-muted-foreground"}>{icon}</span>}
      </div>
      <p
        className={cn(
          "mt-2 text-xl font-semibold tracking-tight md:text-2xl",
          !highlight && tone === "positive" && "text-money-positive",
          !highlight && tone === "negative" && "text-money-negative",
        )}
      >
        {value}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        {hint && (
          <p className={cn("text-[11px]", highlight ? "opacity-70" : "text-muted-foreground")}>
            {hint}
          </p>
        )}
        {trend && <TrendBadge {...trend} />}
      </div>
    </div>
  );
}

export function TrendBadge({
  pct,
  direction,
  invert,
  label,
}: {
  pct: number;
  direction: "up" | "down" | "flat";
  invert?: boolean;
  label?: string;
}) {
  const good = invert ? direction === "down" : direction === "up";
  const bad = invert ? direction === "up" : direction === "down";
  const cls = good
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : bad
      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
      : "bg-muted text-muted-foreground";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", cls)}>
      <Icon className="size-3" />
      {Math.abs(pct).toFixed(0)}%{label ? ` · ${label}` : ""}
    </span>
  );
}
