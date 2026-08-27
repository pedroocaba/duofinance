import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
    confirm: z.string().min(6, "Confirme a nova senha").max(72),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "As senhas não coincidem.",
  });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // O link de recuperação abre o app com um token de recuperação.
    // Supabase processa automaticamente e emite PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error));
      return;
    }
    toast.success("Senha atualizada com sucesso!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
              $
            </div>
            <span className="font-display text-lg font-semibold">Cofre da Família</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Definir nova senha</CardTitle>
            <CardDescription>
              {ready
                ? "Escolha uma nova senha para sua conta."
                : "Validando o link de recuperação…"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Ao menos 6 caracteres"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !ready}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  "Atualizar senha"
                )}
              </Button>
              <Link
                to="/auth"
                className="block text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Voltar para o login
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
