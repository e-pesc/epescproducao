import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  peixariaId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  peixariaId: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [peixariaId, setPeixariaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoleAndPeixaria = async (): Promise<{ role: AppRole | null; peixariaId: string | null }> => {
    try {
      const [{ data: roleData, error: roleError }, { data: peixData }] = await Promise.all([
        supabase.rpc("get_my_role"),
        supabase.rpc("get_my_peixaria_id"),
      ]);
      if (roleError) throw roleError;
      return { role: roleData ?? null, peixariaId: peixData ?? null };
    } catch {
      return { role: null, peixariaId: null };
    }
  };

  useEffect(() => {
    let mounted = true;
    let authRequestId = 0;

    const timeout = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    let lastUserId: string | null = null;

    const applySession = (session: Session | null) => {
      if (!mounted) return;

      const currentRequestId = ++authRequestId;
      const currentUser = session?.user ?? null;
      const sameUser = currentUser?.id === lastUserId;

      setUser(currentUser);

      if (!currentUser) {
        lastUserId = null;
        setRole(null);
        setPeixariaId(null);
        setLoading(false);
        return;
      }

      // Avoid refetching role/peixaria on token refresh or tab focus
      // — this causes the app to remount and reset navigation state.
      if (sameUser) {
        setLoading(false);
        return;
      }

      lastUserId = currentUser.id;
      setLoading(true);

      window.setTimeout(async () => {
        const result = await fetchRoleAndPeixaria();
        if (!mounted || currentRequestId !== authRequestId) return;
        setRole(result.role);
        setPeixariaId(result.peixariaId);
        setLoading(false);
      }, 0);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        applySession(session);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setPeixariaId(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, peixariaId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
