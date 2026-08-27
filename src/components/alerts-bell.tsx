import { Bell, X, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAlerts, type AlertSeverity } from "@/lib/alerts";
import { useState } from "react";

const iconBySeverity: Record<AlertSeverity, typeof AlertCircle> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorBySeverity: Record<AlertSeverity, string> = {
  critical: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-primary",
};

export function AlertsBell() {
  const { alerts, count, dismiss, clearAll } = useAlerts();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative" title="Alertas">
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Alertas</p>
          {count > 0 && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearAll}>
              Limpar tudo
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[380px]">
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum alerta no momento.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((a) => {
                const Icon = iconBySeverity[a.severity];
                const content = (
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-accent/60">
                    <Icon className={`mt-0.5 size-4 shrink-0 ${colorBySeverity[a.severity]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dismiss(a.id);
                      }}
                      title="Descartar"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                );
                return (
                  <li key={a.id}>
                    {a.href ? (
                      <Link to={a.href} onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
