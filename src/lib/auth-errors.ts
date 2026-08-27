// Mapeia mensagens de erro do Supabase Auth para português amigável.
const MAP: Record<string, string> = {
  "invalid login credentials": "E-mail ou senha incorretos.",
  "invalid credentials": "E-mail ou senha incorretos.",
  "email not confirmed": "E-mail ainda não confirmado.",
  "user already registered": "Este e-mail já está cadastrado. Faça login.",
  "user with this email already exists": "Este e-mail já está cadastrado. Faça login.",
  "email address is invalid": "E-mail inválido.",
  "password should be at least 6 characters": "A senha deve ter ao menos 6 caracteres.",
  "signup requires a valid password": "Informe uma senha válida.",
  "new password should be different from the old password":
    "A nova senha precisa ser diferente da anterior.",
  "auth session missing!": "Sessão expirada. Faça login novamente.",
  "for security purposes, you can only request this after 60 seconds":
    "Aguarde alguns segundos antes de tentar novamente.",
  "email rate limit exceeded":
    "Muitas tentativas seguidas. Aguarde um instante e tente de novo.",
  "unable to validate email address: invalid format": "Formato de e-mail inválido.",
  "password is known to be weak and easy to guess, please choose a different one":
    "Esta senha é muito comum. Escolha uma senha mais forte.",
};

export function friendlyAuthError(err: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message ?? "")
      : String(err ?? "");
  const key = raw.trim().toLowerCase();
  if (!key) return fallback;
  return MAP[key] ?? raw;
}
