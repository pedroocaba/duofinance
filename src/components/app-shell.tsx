import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  ArrowRightLeft,
  Tags,
  Settings,
  LogOut,
  Repeat2,
  Sparkles,
  Target,
  Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppTheme } from "@/lib/theme-context";
import { ViewSelector } from "@/components/view-selector";
import { PeriodFilter } from "@/components/period-filter";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { runRecurrenceCatchUp } from "@/lib/finance-queries";
import { useRefreshFinance } from "@/lib/refresh";
import { AlertsBell } from "@/components/alerts-bell";

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/insights", icon: Sparkles, label: "Análises" },
  { to: "/goals", icon: Target, label: "Metas" },
  { to: "/transactions", icon: ArrowRightLeft, label: "Movimentações" },
  { to: "/recurrences", icon: Repeat2, label: "Recorrentes" },
  { to: "/accounts", icon: Wallet, label: "Contas" },
  { to: "/cards", icon: CreditCard, label: "Cartões" },
  { to: "/categories", icon: Tags, label: "Categorias" },
  { to: "/settings", icon: Settings, label: "Configurações" },
] as const;

/** Itens fixos da barra inferior no mobile; o restante entra no menu "Mais". */
const MOBILE_PRIMARY = ["/dashboard", "/insights", "/transactions", "/goals"] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { currentProfile, currentUserId } = useAppTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const refreshFinance = useRefreshFinance();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  // Dispara geração idempotente de recorrências ao entrar na área autenticada.
  useEffect(() => {
    if (!currentUserId) return;
    runRecurrenceCatchUp().then((n) => {
      if (n && n > 0) refreshFinance();
    });
  }, [currentUserId, refreshFinance]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Até logo!");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
          <BrandMark />

          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                    isActive(item.to)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 rounded-2xl border border-sidebar-border p-3">
            <div className="flex items-center gap-3">
              <div
                className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: currentProfile?.color ?? "#71717a" }}
              >
                {currentProfile?.name?.[0] ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{currentProfile?.name ?? "…"}</p>
                <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                  {currentProfile?.theme === "cute" ? "Tema Cute" : "Tema Rock"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={handleSignOut} title="Sair">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-8 md:py-3">
              {/* Menu completo no mobile */}
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button size="icon" variant="ghost" className="lg:hidden" aria-label="Abrir menu">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-4">
                  <SheetHeader className="p-0">
                    <SheetTitle className="sr-only">Menu do DuoFinance</SheetTitle>
                  </SheetHeader>
                  <BrandMark />
                  <nav className="mt-5 flex flex-col gap-1">
                    {nav.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                            isActive(item.to)
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent"
                          }`}
                        >
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                  <Button
                    variant="outline"
                    className="mt-5 w-full justify-start gap-2"
                    onClick={handleSignOut}
                  >
                    <LogOut className="size-4" /> Sair
                  </Button>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1 overflow-x-auto lg:flex-none">
                <ViewSelector />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <PeriodFilter className="hidden sm:flex" />
                <AlertsBell />
              </div>
            </div>
            {/* No mobile o filtro de período ganha sua própria linha */}
            <div className="flex justify-end px-3 pb-2 sm:hidden">
              <PeriodFilter />
            </div>
          </header>

          <div className="flex-1 px-3 py-5 md:px-8 md:py-8">{children}</div>

          {/* Barra inferior mobile */}
          <nav className="sticky bottom-0 z-20 flex items-center justify-around border-t border-border bg-background px-1 py-1.5 lg:hidden">
            {nav
              .filter((i) => (MOBILE_PRIMARY as readonly string[]).includes(i.to))
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[10px] ${
                      isActive(item.to) ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[10px] text-muted-foreground"
            >
              <Menu className="size-5" />
              <span>Mais</span>
            </button>
          </nav>
        </main>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <div className="grid size-9 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
        D
      </div>
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold">DuoFinance</p>
        <p className="text-xs text-muted-foreground">Financeiro da família</p>
      </div>
    </div>
  );
}
