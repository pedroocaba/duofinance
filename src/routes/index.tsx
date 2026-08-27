import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
            $
          </div>
          <span className="font-display text-lg font-semibold">Cofre da Família</span>
        </div>
        <Link to="/auth">
          <Button size="sm">Entrar</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-block rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Pedro &amp; Samira
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Duas identidades.<br />Uma vida financeira.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Controle contas, cartões e movimentações — individuais ou compartilhadas — com um
              dashboard que se transforma no estilo de cada um.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg">Começar agora</Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">
                  Criar conta
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <PreviewCard
              variant="rock"
              name="Pedro"
              amount="R$ 24.850"
              label="Rock"
              accent="#dc2626"
            />
            <PreviewCard
              variant="cute"
              name="Samira"
              amount="R$ 18.240"
              label="Cute"
              accent="#f472b6"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function PreviewCard({
  variant,
  name,
  amount,
  label,
  accent,
}: {
  variant: "rock" | "cute";
  name: string;
  amount: string;
  label: string;
  accent: string;
}) {
  const dark = variant === "rock";
  return (
    <div
      className="rounded-3xl border p-5 shadow-sm transition-transform hover:-translate-y-1"
      style={{
        background: dark ? "#0f0f10" : "#fffafb",
        color: dark ? "#fafafa" : "#451a03",
        borderColor: dark ? "#27272a" : "#fce7f3",
      }}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-widest opacity-60">
        <span>{label}</span>
        <span
          className="grid size-6 place-items-center rounded-full text-[10px] font-bold"
          style={{ background: accent, color: "#fff" }}
        >
          {name[0]}
        </span>
      </div>
      <p className="mt-6 text-xs opacity-60">Saldo total</p>
      <p className="text-2xl font-semibold tracking-tight">{amount}</p>
      <div className="mt-6 h-16 rounded-xl" style={{ background: `${accent}18` }}>
        <div
          className="h-full rounded-xl"
          style={{
            width: dark ? "70%" : "45%",
            background: `linear-gradient(90deg, ${accent}, transparent)`,
          }}
        />
      </div>
    </div>
  );
}
