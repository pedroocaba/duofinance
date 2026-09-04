import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { usePeriod, PERIOD_OPTIONS, type PeriodKey } from "@/lib/period-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Filtro global de período — vive no cabeçalho e governa toda a aplicação. */
export function PeriodFilter({ className }: { className?: string }) {
  const { periodKey, setPeriodKey, custom, setCustom, label } = usePeriod();
  const [openCustom, setOpenCustom] = useState(false);
  const [draft, setDraft] = useState(custom);

  function handleChange(v: string) {
    const key = v as PeriodKey;
    if (key === "custom") {
      setDraft(custom);
      setOpenCustom(true);
      return;
    }
    setPeriodKey(key);
  }

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Popover open={openCustom} onOpenChange={setOpenCustom}>
        <PopoverAnchor asChild>
          <Select value={periodKey} onValueChange={handleChange}>
            <SelectTrigger
              className="h-9 w-[168px] rounded-full border-border bg-secondary/60 text-xs"
              aria-label="Filtro global de período"
            >
              <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue>
                <span className="truncate">{label}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PopoverAnchor>

        <PopoverContent align="end" className="w-64 space-y-3">
          <p className="text-sm font-medium">Período personalizado</p>
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!draft.from || !draft.to || draft.from > draft.to}
            onClick={() => {
              setCustom(draft);
              setOpenCustom(false);
            }}
          >
            Aplicar
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
