import { useAppTheme } from "@/lib/theme-context";
import { Users } from "lucide-react";

export function ViewSelector() {
  const { view, setView, profiles } = useAppTheme();

  const items = [
    { id: "family" as const, label: "Família", icon: <Users className="size-3.5" />, color: "#71717a" },
    ...profiles.map((p) => ({ id: p.id, label: p.name, icon: null, color: p.color })),
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1">
      {items.map((item) => {
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? "shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={active ? { background: item.color, color: "#fff" } : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
