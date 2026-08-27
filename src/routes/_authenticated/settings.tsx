import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PageHeading, Field } from "./accounts";
import { User, Palette, Shield, Info, LogOut, Users, Copy, Trash2, Mail } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Configurações"
        subtitle="Personalize sua identidade, aparência, família e segurança."
      />

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 md:w-auto md:inline-grid">
          <TabsTrigger value="profile" className="gap-2"><User className="size-4" />Perfil</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2"><Palette className="size-4" />Aparência</TabsTrigger>
          <TabsTrigger value="family" className="gap-2"><Users className="size-4" />Família</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield className="size-4" />Segurança</TabsTrigger>
          <TabsTrigger value="about" className="gap-2"><Info className="size-4" />Sobre</TabsTrigger>
        </TabsList>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="appearance"><AppearanceTab /></TabsContent>
        <TabsContent value="family"><FamilyTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="about"><AboutTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function FamilyTab() {
  const { currentUserId, currentFamilyId, profiles } = useAppTheme();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: family } = useQuery({
    queryKey: ["family", currentFamilyId],
    enabled: !!currentFamilyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("id, name, created_by").eq("id", currentFamilyId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["family-members", currentFamilyId],
    enabled: !!currentFamilyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("family_members")
        .select("user_id, role, joined_at").eq("family_id", currentFamilyId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["family-invites", currentFamilyId],
    enabled: !!currentFamilyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("family_invites")
        .select("id, email, token, status, expires_at, created_at")
        .eq("family_id", currentFamilyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const iAmAdmin = members.find((m) => m.user_id === currentUserId)?.role === "admin";

  const createInvite = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc("create_family_invite", { p_email: email });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["family-invites", currentFamilyId] });
      toast.success("Convite criado. Copie o link e envie.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("family_invites").update({ status: "revoked" as const }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family-invites", currentFamilyId] }),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_family_member", { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-members", currentFamilyId] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Membro removido. Os dados dele foram movidos para uma família própria.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function inviteUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invite/${token}`;
  }

  return (
    <div className="space-y-4">
      <div className="card-surface max-w-2xl p-6">
        <h3 className="font-medium">{family?.name ?? "Sua família"}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Todos os membros compartilham contas, cartões, categorias, movimentações e metas.
        </p>
      </div>

      <div className="card-surface max-w-2xl p-6">
        <h3 className="mb-3 font-medium">Membros</h3>
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const p = profiles.find((x) => x.id === m.user_id);
            return (
              <li key={m.user_id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-full text-sm font-bold text-white"
                       style={{ background: p?.color ?? "#71717a" }}>
                    {p?.name?.[0] ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p?.name ?? m.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.role === "admin" ? "Administrador" : "Membro"}
                      {m.user_id === currentUserId && " · você"}
                    </p>
                  </div>
                </div>
                {iAmAdmin && m.user_id !== currentUserId && (
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (confirm(`Remover ${p?.name ?? "membro"} da família? Os dados serão transferidos para uma família própria.`))
                      removeMember.mutate(m.user_id);
                  }}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {iAmAdmin && (
        <div className="card-surface max-w-2xl p-6">
          <h3 className="mb-3 font-medium">Convidar novo membro</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!inviteEmail.includes("@")) { toast.error("E-mail inválido"); return; }
                createInvite.mutate(inviteEmail.trim());
              }}
              disabled={createInvite.isPending}
              className="gap-2"
            >
              <Mail className="size-4" /> Gerar convite
            </Button>
          </div>

          {invites.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Convites</p>
              <ul className="divide-y divide-border">
                {invites.map((iv) => (
                  <li key={iv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{iv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {iv.status === "pending" ? "Pendente" : iv.status === "accepted" ? "Aceito" : iv.status === "revoked" ? "Revogado" : "Expirado"}
                        {" · expira "}{new Date(iv.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {iv.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => {
                            navigator.clipboard.writeText(inviteUrl(iv.token));
                            toast.success("Link copiado!");
                          }} className="gap-1"><Copy className="size-3.5" />Copiar link</Button>
                          <Button size="sm" variant="ghost" onClick={() => revokeInvite.mutate(iv.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function ProfileTab() {
  const { currentProfile, currentUserId } = useAppTheme();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#dc2626");
  const qc = useQueryClient();

  useEffect(() => {
    if (currentProfile) {
      setName(currentProfile.name);
      setColor(currentProfile.color);
    }
  }, [currentProfile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ name, color })
        .eq("id", currentUserId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Perfil atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="card-surface max-w-xl p-6">
      <h3 className="mb-4 font-medium">Seus dados</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Cor pessoal">
          <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
        </Field>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

function AppearanceTab() {
  const { currentProfile, currentUserId } = useAppTheme();
  const [theme, setTheme] = useState<"rock" | "cute">("rock");
  const qc = useQueryClient();

  useEffect(() => {
    if (currentProfile) setTheme(currentProfile.theme);
  }, [currentProfile]);

  const save = useMutation({
    mutationFn: async (t: "rock" | "cute") => {
      const { error } = await supabase
        .from("profiles")
        .update({ theme: t, color: t === "cute" ? "#f472b6" : "#dc2626" })
        .eq("id", currentUserId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Tema atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="card-surface max-w-2xl p-6">
      <h3 className="mb-2 font-medium">Tema visual</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        O tema muda automaticamente ao alternar de visão. Escolha o seu identificador pessoal.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <ThemeOption
          selected={theme === "rock"}
          onClick={() => { setTheme("rock"); save.mutate("rock"); }}
          emoji="🎸"
          title="Rock"
          desc="Preto, vermelho, ares metálicos. Elegante e forte."
        />
        <ThemeOption
          selected={theme === "cute"}
          onClick={() => { setTheme("cute"); save.mutate("cute"); }}
          emoji="🎀"
          title="Cute"
          desc="Rosa, lilás e bege. Delicado e chique."
        />
      </div>
    </div>
  );
}

function ThemeOption({
  selected, onClick, emoji, title, desc,
}: { selected: boolean; onClick: () => void; emoji: string; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-accent"
      }`}
    >
      <p className="text-lg">{emoji} {title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

function SecurityTab() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const changePass = useMutation({
    mutationFn: async () => {
      if (newPass.length < 6) throw new Error("A senha precisa ter ao menos 6 caracteres.");
      if (newPass !== confirmPass) throw new Error("As senhas não coincidem.");
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPass(""); setConfirmPass("");
      toast.success("Senha atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOutAll() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-4">
      <div className="card-surface max-w-xl p-6">
        <h3 className="mb-4 font-medium">Conta</h3>
        <p className="text-sm text-muted-foreground">E-mail cadastrado</p>
        <p className="mt-1 font-medium">{email || "—"}</p>
      </div>

      <div className="card-surface max-w-xl p-6">
        <h3 className="mb-4 font-medium">Trocar senha</h3>
        <div className="space-y-3">
          <Field label="Nova senha">
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          </Field>
          <Field label="Confirmar senha">
            <Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => changePass.mutate()} disabled={changePass.isPending}>
            {changePass.isPending ? "Salvando…" : "Atualizar senha"}
          </Button>
        </div>
      </div>

      <div className="card-surface max-w-xl p-6">
        <h3 className="mb-2 font-medium">Sessão</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Sair encerra a sessão neste dispositivo.
        </p>
        <Button variant="destructive" onClick={signOutAll} className="gap-2">
          <LogOut className="size-4" /> Sair da conta
        </Button>
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="card-surface max-w-xl p-6 space-y-3">
      <h3 className="font-medium">Sobre o Cofre da Família</h3>
      <p className="text-sm text-muted-foreground">
        Um controle financeiro feito sob medida para casais que gostam de organizar
        os números com um toque pessoal — o Rock do Pedro e o Cute da Samira convivendo
        no mesmo cofre.
      </p>
      <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
        <p>Versão 1.0 · Cofre da Família</p>
        <p>Feito com carinho por vocês dois. 🎸🎀</p>
      </div>
    </div>
  );
}
