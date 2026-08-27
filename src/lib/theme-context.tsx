import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ViewMode = "family" | string; // "family" or a profile id
export type ThemeName = "rock" | "cute" | "neutral";

interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string;
  theme: "rock" | "cute";
  family_id: string;
}


interface ThemeContextValue {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  currentUserId: string | null;
  currentFamilyId: string | null;
  profiles: Profile[];
  currentProfile: Profile | null;
  viewedProfile: Profile | null;
  themeName: ThemeName;
}


const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setViewState] = useState<ViewMode>("family");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("finance:view");
    if (saved) setViewState(saved);
  }, []);

  const setView = (v: ViewMode) => {
    setViewState(v);
    if (typeof window !== "undefined") localStorage.setItem("finance:view", v);
  };

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, color, theme, family_id")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const currentProfile = useMemo(
    () => profiles.find((p) => p.id === userId) ?? null,
    [profiles, userId],
  );
  const viewedProfile = useMemo(
    () => (view === "family" ? null : profiles.find((p) => p.id === view) ?? null),
    [profiles, view],
  );

  const themeName: ThemeName = viewedProfile
    ? viewedProfile.theme
    : currentProfile?.theme ?? "neutral";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.classList.remove("theme-rock", "theme-cute");
    if (themeName === "rock") html.classList.add("theme-rock");
    else if (themeName === "cute") html.classList.add("theme-cute");
  }, [themeName]);

  const value: ThemeContextValue = {
    view,
    setView,
    currentUserId: userId,
    currentFamilyId: currentProfile?.family_id ?? null,
    profiles,
    currentProfile,
    viewedProfile,
    themeName,
  };


  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}
