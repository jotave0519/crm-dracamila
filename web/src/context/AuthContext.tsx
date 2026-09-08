import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { api } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

export interface StaffMe {
  id: string;
  name: string;
  email: string;
  role: "admin";
  active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  staff: StaffMe | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<StaffMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const finish = (nextSession: Session | null, err?: string) => {
      if (done) return;
      done = true;
      setSession(nextSession);
      if (err) setError(err);
      setLoading(false);
    };

    // Evita ficar preso em "Carregando..." caso o Supabase esteja
    // indisponivel (projeto pausado, rede fora, DNS quebrado, etc.).
    const timeout = setTimeout(() => {
      finish(null, "Nao foi possivel conectar ao servidor de autenticacao. Tente novamente mais tarde.");
    }, 8000);

    supabase.auth
      .getSession()
      .then(({ data }) => finish(data.session))
      .catch(() => finish(null, "Falha ao verificar a sessao. O servico pode estar temporariamente indisponivel."))
      .finally(() => clearTimeout(timeout));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      clearTimeout(timeout);
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setStaff(null);
      return;
    }
    api.get<StaffMe>("/me").then(setStaff).catch(() => setStaff(null));
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return <AuthContext.Provider value={{ session, staff, loading, error, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
