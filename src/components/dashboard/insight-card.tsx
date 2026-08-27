import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/insights";

const toneClass: Record<Insight["tone"], string> = {
  positive: "border-emerald-500/20 bg-emerald-500/5",
  negative: "border-rose-500/20 bg-rose-500/5",
  warning: "border-amber-500/20 bg-amber-500/5",
  neutral: "border-border bg-secondary/40",
};

const metricClass: Record<Insight["tone"], string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
  neutral: "text-foreground",
};

/** Card de insight automático. Reutilizável em dashboard e página de BI. */
export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-3.5 transition-colors", toneClass[insight.tone])}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-xl shadow-sm">
        {insight.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{insight.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{insight.description}</p>
      </div>
      {insight.metric && (
        <span className={cn("shrink-0 text-sm font-semibold tabular-nums", metricClass[insight.tone])}>
          {insight.metric}
        </span>
      )}
    </div>
  );
}

export function InsightGrid({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
        Ainda não há dados suficientes para gerar insights.
      </div>
    );
  }
  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      {insights.map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}
    </div>
  );
}
