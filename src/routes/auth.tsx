import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
});

const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(2, "Informe seu nome").max(60),
  theme: z.enum(["rock", "cute"]),
});

const resetSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
});

type TabKey = "signin" | "signup" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>("signin");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error));
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      theme: form.get("theme"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name: parsed.data.name, theme: parsed.data.theme },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(friendlyAuthError(error));
      return;
    }

    // Auto-confirm está ativo: já vem sessão. Se não vier, força login.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInError) {
        setLoading(false);
        toast.error(friendlyAuthError(signInError));
        return;
      }
    }
    setLoading(false);
    toast.success("Conta criada! Bem-vindo(a).");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = resetSchema.safeParse({ email: form.get("email") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error));
      return;
    }
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
    setTab("signin");
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
            <CardTitle>
              {tab === "reset" ? "Recuperar senha" : "Acesse sua conta"}
            </CardTitle>
            <CardDescription>
              {tab === "reset"
                ? "Informe seu e-mail e enviaremos um link para redefinir sua senha."
                : "Pedro, Samira — ou qualquer pessoa da família."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tab === "reset" ? (
              <form onSubmit={handleReset} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="email-reset">E-mail</Label>
                  <Input
                    id="email-reset"
                    name="email"
                    type="email"
                    required
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setTab("signin")}
                >
                  Voltar para o login
                </Button>
              </form>
            ) : (
              <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="mt-4 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        placeholder="voce@exemplo.com"
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        placeholder="Sua senha"
                        autoComplete="current-password"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Entrando…
                        </>
                      ) : (
                        "Entrar"
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setTab("reset")}
                      className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="mt-4 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        name="name"
                        required
                        maxLength={60}
                        placeholder="Como devemos te chamar?"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email-su">E-mail</Label>
                      <Input
                        id="email-su"
                        name="email"
                        type="email"
                        required
                        placeholder="voce@exemplo.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password-su">Senha</Label>
                      <Input
                        id="password-su"
                        name="password"
                        type="password"
                        required
                        minLength={6}
                        placeholder="Ao menos 6 caracteres"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tema favorito</Label>
                      <RadioGroup
                        name="theme"
                        defaultValue="rock"
                        className="grid grid-cols-2 gap-3"
                      >
                        <label
                          htmlFor="theme-rock"
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 hover:bg-accent"
                        >
                          <RadioGroupItem id="theme-rock" value="rock" />
                          <span>🎸 Rock</span>
                        </label>
                        <label
                          htmlFor="theme-cute"
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 hover:bg-accent"
                        >
                          <RadioGroupItem id="theme-cute" value="cute" />
                          <span>🎀 Cute</span>
                        </label>
                      </RadioGroup>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Criando conta…
                        </>
                      ) : (
                        "Criar conta e entrar"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
