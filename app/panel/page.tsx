"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  LogOut,
  CheckCircle2,
  XCircle,
  UserX,
  Scissors,
} from "lucide-react";
import { supabase, type Appointment } from "@/lib/supabase";
import { useStaff } from "@/lib/auth";
import { DRINK_LABELS, SERVICES } from "@/lib/constants";
import BlockedSlotsManager from "@/components/BlockedSlotsManager";

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function PanelPage() {
  const router = useRouter();
  const { loading: authLoading, session, staff, signOut } = useStaff();

  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staff) return;
    setLoading(true);
    setError(null);
    let query = supabase
      .from("appointments")
      .select("*")
      .gte("appointment_date", todayLocalISO())
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });
    // El barbero solo ve sus citas; el admin las ve todas
    if (staff.role === "barbero" && staff.barber_key) {
      query = query.eq("barber", staff.barber_key);
    }
    const { data, error } = await query;
    if (error) setError(error.message);
    else setItems((data as Appointment[]) ?? []);
    setLoading(false);
  }, [staff]);

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace("/login");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (staff) load();
  }, [staff, load]);

  async function setAppointmentStatus(id: string, status: string) {
    setUpdatingId(id);
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c))
      );
    }
    setUpdatingId(null);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const c of items) {
      const list = map.get(c.appointment_date) ?? [];
      list.push(c);
      map.set(c.appointment_date, list);
    }
    return Array.from(map.entries());
  }, [items]);

  if (authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 flex items-center gap-2 text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando sesión...
      </main>
    );
  }

  if (session && !staff) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-stone-300">
          Tu cuenta no está registrada como personal de la barbería.
        </p>
        <button
          onClick={signOut}
          className="mt-4 text-sm text-brand-300 hover:underline"
        >
          Cerrar sesión
        </button>
      </main>
    );
  }

  if (!staff) return null; // redirigiendo a /login

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:py-14">
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-brand-200 hover:text-brand-100"
        >
          <ArrowLeft className="h-4 w-4" /> Inicio
        </Link>
        <div className="flex items-center gap-2">
          {staff.role === "admin" && (
            <Link
              href="/citas"
              className="text-sm rounded-lg bg-stone-900 ring-1 ring-stone-800 px-3 py-2 hover:bg-stone-800 text-brand-200"
            >
              Registro admin
            </Link>
          )}
          <button
            onClick={load}
            className="inline-flex items-center gap-2 text-sm rounded-lg bg-stone-900 ring-1 ring-stone-800 px-3 py-2 hover:bg-stone-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <button
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
            className="inline-flex items-center gap-2 text-sm rounded-lg bg-stone-900 ring-1 ring-stone-800 px-3 py-2 hover:bg-stone-800 text-red-300"
          >
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="rounded-full bg-brand-500/20 p-2 ring-1 ring-brand-500/40">
          <Scissors className="h-5 w-5 text-brand-300" />
        </div>
        <h1 className="font-display text-3xl text-brand-100">
          Hola, {staff.display_name}
        </h1>
      </div>
      <p className="text-sm text-stone-400 mb-8">
        {staff.role === "barbero"
          ? "Estas son tus próximas citas. Marca cada una al terminar."
          : "Próximas citas de todos los barberos."}
      </p>

      <div className="mb-8">
        <BlockedSlotsManager staff={staff} />
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/40 ring-1 ring-red-900 px-3 py-2 text-sm text-red-200 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando citas...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 p-8 text-center text-stone-400">
          No tienes citas próximas.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([day, citas]) => (
            <section key={day}>
              <h2 className="font-display text-lg text-brand-200 mb-3">
                {day === todayLocalISO() ? `Hoy · ${day}` : day}
              </h2>
              <div className="space-y-3">
                {citas.map((c) => {
                  const extras: string[] = [];
                  if (c.extra_mask) extras.push("Mascarilla");
                  if (c.extra_massage) extras.push("Masaje");
                  if (c.drink) extras.push(DRINK_LABELS[c.drink]);
                  const done = c.status !== "agendada";
                  return (
                    <div
                      key={c.id}
                      className={`rounded-xl ring-1 p-4 ${
                        done
                          ? "bg-stone-950/40 ring-stone-800 opacity-70"
                          : "bg-stone-900/60 ring-stone-800"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-display text-xl text-brand-100">
                          {String(c.appointment_time).slice(0, 5)}
                        </span>
                        <span className="font-medium text-stone-100">
                          {c.customer_name}
                        </span>
                        <span className="text-sm text-stone-400">
                          {c.customer_phone}
                        </span>
                        <span
                          className={`ml-auto inline-block rounded-full px-2 py-0.5 text-xs ring-1 ${
                            c.status === "agendada"
                              ? "bg-emerald-950/40 ring-emerald-800 text-emerald-300"
                              : c.status === "completada"
                              ? "bg-blue-950/40 ring-blue-800 text-blue-300"
                              : c.status === "cancelada"
                              ? "bg-red-950/40 ring-red-800 text-red-300"
                              : "bg-stone-800 ring-stone-700 text-stone-300"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-stone-300">
                        {SERVICES[c.service].label} ·{" "}
                        <span className="text-brand-200 font-medium">
                          ${Number(c.price_usd).toFixed(2)}
                        </span>
                        {extras.length > 0 && (
                          <span className="text-stone-400">
                            {" "}
                            · Extras: {extras.join(", ")}
                          </span>
                        )}
                      </div>
                      {c.notes && (
                        <p className="mt-1 text-xs text-stone-500">
                          Nota: {c.notes}
                        </p>
                      )}

                      {c.status === "agendada" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ActionBtn
                            onClick={() =>
                              setAppointmentStatus(c.id, "completada")
                            }
                            disabled={updatingId === c.id}
                            className="text-emerald-300 ring-emerald-900 hover:bg-emerald-950/40"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Completada
                          </ActionBtn>
                          <ActionBtn
                            onClick={() =>
                              setAppointmentStatus(c.id, "no_asistio")
                            }
                            disabled={updatingId === c.id}
                            className="text-stone-300 ring-stone-700 hover:bg-stone-800"
                          >
                            <UserX className="h-4 w-4" /> No asistió
                          </ActionBtn>
                          <ActionBtn
                            onClick={() =>
                              setAppointmentStatus(c.id, "cancelada")
                            }
                            disabled={updatingId === c.id}
                            className="text-red-300 ring-red-900 hover:bg-red-950/40"
                          >
                            <XCircle className="h-4 w-4" /> Cancelar
                          </ActionBtn>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ring-1 transition disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
