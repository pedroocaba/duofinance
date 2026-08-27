import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<{ family_name: string; invited_email: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUserId(u.user?.id ?? null);
      const { data, error } = await supabase.rpc("preview_family_invite", { p_token: token });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setPreview(null);
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        setPreview({ family_name: row.family_name, invited_email: row.invited_email, status: row.status });
      }
      setLoading(false);
    })();
  }, [token]);

  async function acceptNow() {
    setAccepting(true);
    const { error } = await supabase.rpc("accept_family_invite", { p_token: token });
    setAccepting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Você entrou na família!");
    navigate({ to: "/dashboard" });
  }

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando convite…</div>;

  if (!preview || preview.status !== "pending") {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Convite inválido ou expirado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Peça um novo link para o administrador da família.</p>
          <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Início</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card-surface w-full max-w-md p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Convite para</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">{preview.family_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enviado para <strong>{preview.invited_email}</strong></p>

        {userId ? (
          <Button onClick={acceptNow} disabled={accepting} className="mt-6 w-full">
            {accepting ? "Entrando…" : "Aceitar e entrar na família"}
          </Button>
        ) : (
          <div className="mt-6 space-y-2">
            <a
              href={`/auth?invite=${token}`}
              className="block w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Criar conta e aceitar
            </a>
            <a
              href={`/auth?invite=${token}&mode=login`}
              className="block w-full rounded-md border border-input px-4 py-2 text-sm font-medium"
            >
              Já tenho conta — entrar
            </a>
          </div>

        )}
      </div>
    </div>
  );
}
