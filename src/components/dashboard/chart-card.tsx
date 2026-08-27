import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Wrapper padrão para gráficos: título, subtítulo, corpo com altura definida. */
export function ChartCard({ title, subtitle, action, className, children }: ChartCardProps) {
  return (
    <div className={cn("card-surface p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-56 place-items-center text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

/** Paleta de cores estável para séries — usa tokens do design system. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export const tooltipStyle = {
  background: "var(--popover)",
  borderColor: "var(--border)",
  color: "var(--popover-foreground)",
  borderRadius: 12,
  fontSize: 12,
};
