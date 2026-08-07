"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Barber } from "./supabase";

export interface StaffProfile {
  id: string;
  display_name: string;
  role: "admin" | "barbero";
  barber_key: Barber | null;
}

interface UseStaffResult {
  loading: boolean;
  session: Session | null;
  staff: StaffProfile | null;
  signOut: () => Promise<void>;
}

/**
 * Hook de sesión para empleados/admin.
 * - loading: aún resolviendo sesión + perfil.
 * - session: sesión de Supabase Auth (o null).
 * - staff: perfil en la tabla staff (o null si el usuario no es staff).
 */
export function useStaff(): UseStaffResult {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<StaffProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(s: Session | null) {
      if (!s) {
        if (!cancelled) {
          setStaff(null);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("staff")
        .select("id, display_name, role, barber_key")
        .eq("id", s.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.error("Error cargando perfil staff:", error.message);
        setStaff(null);
      } else {
        setStaff((data as StaffProfile) ?? null);
      }
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      loadProfile(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      setLoading(true);
      loadProfile(s);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { loading, session, staff, signOut };
}
