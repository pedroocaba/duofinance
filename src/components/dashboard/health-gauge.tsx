import { cn } from "@/lib/utils";
import type { HealthScore } from "@/lib/insights";

const toneClass: Record<HealthScore["tone"], string> = {
  positive: "text-emerald-500",
  neutral: "text-primary",
  warning: "text-amber-500",
  negative: "text-rose-500",
};

/** Anel de saúde financeira (0–100), com breakdown por critério. */
export function HealthGauge({ health }: { health: HealthScore }) {
  const size = 156;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const off = c - (health.score / 100) * c;

  return (
    <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--muted)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={off}
            strokeLinecap="round"
            className={cn("transition-all", toneClass[health.tone])}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className={cn("text-4xl font-semibold tabular-nums", toneClass[health.tone])}>{health.score}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{health.label}</p>
          </div>
        </div>
      </div>
      <div className="w-full flex-1 space-y-2">
        {health.breakdown.map((b) => (
          <div key={b.key}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{b.label}</span>
              <span className="font-semibold tabular-nums">{b.score}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  b.score >= 70 ? "bg-emerald-500" : b.score >= 40 ? "bg-amber-500" : "bg-rose-500",
                )}
                style={{ width: `${b.score}%` }}
              />
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{b.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
