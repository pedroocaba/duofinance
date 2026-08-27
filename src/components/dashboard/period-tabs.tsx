import { cn } from "@/lib/utils";

export type PeriodKey = "mes" | "mes_anterior" | "ano" | "12m";

const OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "mes", label: "Este mês" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "ano", label: "Este ano" },
  { key: "12m", label: "12 meses" },
];

export function PeriodTabs({ value, onChange }: { value: PeriodKey; onChange: (v: PeriodKey) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1">
      {OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
