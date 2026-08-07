"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Scissors,
  DollarSign,
  CalendarDays,
  Users,
  LogOut,
  CheckCircle2,
  XCircle,
  UserX,
  Percent,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase, type Appointment, type Barber } from "@/lib/supabase";
import { useStaff } from "@/lib/auth";
import {
  BARBERS,
  BarberKey,
  DRINK_LABELS,
  SERVICES,
} from "@/lib/constants";

type BarberFilter = "todos" | BarberKey;
type StatusFilter = "todos" | "agendada" | "completada" | "cancelada" | "no_asistio";

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lunes de la semana actual + offset semanas */
function weekStart(offset: number): Date {
  const d = new Date();
  const dow = d.getDay(); // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

const BARBER_COLORS: Record<BarberKey, string> = {
  jose: "bg-amber-500/20 text-amber-300 ring-amber-700",
  gabriel: "bg-emerald-500/20 text-emerald-300 ring-emerald-700",
  alejandro: "bg-sky-500/20 text-sky-300 ring-sky-700",
};

export default function CitasPage() {
  const router = useRouter();
  const { loading: authLoading, session, staff, signOut } = useStaff();

  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [barberFilter, setBarberFilter] = useState<BarberFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Comisión de la barbería (%)
  const [commissionPct, setCommissionPct] = useState<number>(50);
  const [pctDraft, setPctDraft] = useState<string>("50");
  const [savingPct, setSavingPct] = useState(false);

  // Calendario semanal
  const [weekOffset, setWeekOffset] = useState(0);

  const isAdmin = staff?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });
    if (error) setError(error.message);
    else setItems((data as Appointment[]) ?? []);
    setLoading(false);
  }, []);

  // Guard: requiere sesión
  useEffect(() => {
    if (!authLoading && !session) {
      router.replace("/login");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  // Cargar % de comisión
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("app_settings")
      .select("shop_commission_pct")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const pct = Number(data.shop_commission_pct);
          setCommissionPct(pct);
          setPctDraft(String(pct));
        }
      });
  }, [isAdmin]);

  async function saveCommission() {
    const pct = Number(pctDraft);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setError("El % de comisión debe estar entre 0 y 100.");
      return;
    }
    setSavingPct(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ shop_commission_pct: pct, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSavingPct(false);
    if (error) setError(error.message);
    else setCommissionPct(pct);
  }

  function applyQuickRange(range: "hoy" | "semana" | "mes" | "todo") {
    const now = new Date();
    if (range === "hoy") {
      const t = toISO(now);
      setDateFrom(t);
      setDateTo(t);
    } else if (range === "semana") {
      setDateFrom(toISO(weekStart(0)));
      const end = weekStart(0);
      end.setDate(end.getDate() + 5); // lunes + 5 = sábado
      setDateTo(toISO(end));
    } else if (range === "mes") {
      setDateFrom(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
      setDateTo(toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else {
      setDateFrom("");
      setDateTo("");
    }
  }

  async function setAppointmentStatus(id: string, status: string) {
    setUpdatingId(id);
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);
    if (error) setError(error.message);
    else
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c))
      );
    setUpdatingId(null);
  }

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (barberFilter !== "todos" && c.barber !== barberFilter) return false;
      if (statusFilter !== "todos" && c.status !== statusFilter) return false;
      if (dateFrom && c.appointment_date < dateFrom) return false;
      if (dateTo && c.appointment_date > dateTo) return false;
      return true;
    });
  }, [items, barberFilter, statusFilter, dateFrom, dateTo]);

  // Solo cuentan al ingreso las citas no canceladas
  const isRevenue = (c: Appointment) => c.status !== "cancelada";

  const totals = useMemo(() => {
    const revenueItems = filtered.filter(isRevenue);
    const totalRevenue = revenueItems.reduce(
      (sum, c) => sum + Number(c.price_usd),
      0
    );
    const usdRevenue = revenueItems
      .filter((c) => c.payment_currency === "USD")
      .reduce((s, c) => s + Number(c.price_usd), 0);
    const vesRevenue = totalRevenue - usdRevenue;
    return {
      count: filtered.length,
      revenueCount: revenueItems.length,
      totalRevenue,
      usdRevenue,
      vesRevenue,
      shopShare: (totalRevenue * commissionPct) / 100,
      barbersShare: (totalRevenue * (100 - commissionPct)) / 100,
      noShows: filtered.filter((c) => c.status === "no_asistio").length,
    };
  }, [filtered, commissionPct]);

  const byBarber = useMemo(() => {
    const groups: Record<
      Barber,
      { items: Appointment[]; revenue: number; services: Record<string, number> }
    > = {
      jose: { items: [], revenue: 0, services: {} },
      gabriel: { items: [], revenue: 0, services: {} },
      alejandro: { items: [], revenue: 0, services: {} },
    };
    for (const c of filtered) {
      if (!c.barber) continue;
      const g = groups[c.barber];
      g.items.push(c);
      if (isRevenue(c)) {
        g.revenue += Number(c.price_usd);
        const label = SERVICES[c.service].label;
        g.services[label] = (g.services[label] ?? 0) + 1;
      }
    }
    return groups;
  }, [filtered]);

  const visibleBarbers = BARBERS.filter(
    (b) => barberFilter === "todos" || barberFilter === b.value
  );

  if (authLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 flex items-center gap-2 text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando sesión...
      </main>
    );
  }

  if (!session) return null; // redirigiendo a /login

  if (session && staff && !isAdmin) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-stone-300">
          Esta sección es solo para el administrador.
        </p>
        <Link
          href="/panel"
          className="mt-4 inline-block text-sm text-brand-300 hover:underline"
        >
          Ir a mi panel de citas
        </Link>
      </main>
    );
  }

  if (session && !staff) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center">
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-brand-200 hover:text-brand-100"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/panel"
            className="text-sm rounded-lg bg-stone-900 ring-1 ring-stone-800 px-3 py-2 hover:bg-stone-800 text-brand-200"
          >
            Panel de citas
          </Link>
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

      <h1 className="font-display text-3xl text-brand-100 mb-2">
        Registro administrativo
      </h1>
      <p className="text-sm text-stone-400 mb-8">
        Citas por barbero, servicios realizados y montos.
      </p>

      {/* Rangos rápidos (cierre de caja) */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ["hoy", "Hoy"],
            ["semana", "Esta semana"],
            ["mes", "Este mes"],
            ["todo", "Todo"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => applyQuickRange(key)}
            className="rounded-lg bg-stone-900 ring-1 ring-stone-800 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 hover:text-brand-200 transition"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 p-4 mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField label="Barbero">
          <select
            value={barberFilter}
            onChange={(e) => setBarberFilter(e.target.value as BarberFilter)}
            className={selectCls}
          >
            <option value="todos">Todos</option>
            {BARBERS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Estado">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={selectCls}
          >
            <option value="todos">Todos</option>
            <option value="agendada">Agendada</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
            <option value="no_asistio">No asistió</option>
          </select>
        </FilterField>
        <FilterField label="Desde">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={selectCls}
          />
        </FilterField>
        <FilterField label="Hasta">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={selectCls}
          />
        </FilterField>
      </div>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <StatCard
          icon={<CalendarDays className="h-4 w-4 text-brand-300" />}
          label="Citas en el período"
          value={String(totals.count)}
          hint={totals.noShows > 0 ? `${totals.noShows} no asistieron` : undefined}
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-brand-300" />}
          label="Citas facturables"
          value={String(totals.revenueCount)}
          hint="(no cuenta canceladas)"
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-brand-300" />}
          label="Ingresos totales"
          value={`$${totals.totalRevenue.toFixed(2)}`}
          hint={`Efectivo USD: $${totals.usdRevenue.toFixed(2)} · En Bs: $${totals.vesRevenue.toFixed(2)}`}
        />
      </div>

      {/* Comisión y reparto */}
      <div className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 p-4 mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-brand-300" />
            <span className="text-sm text-stone-300">
              Comisión de la barbería:
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={pctDraft}
              onChange={(e) => setPctDraft(e.target.value)}
              className="w-20 rounded-lg bg-stone-950/60 ring-1 ring-stone-800 px-2 py-1.5 text-sm text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <span className="text-sm text-stone-400">%</span>
            {Number(pctDraft) !== commissionPct && (
              <button
                onClick={saveCommission}
                disabled={savingPct}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-stone-900 hover:bg-brand-400 transition disabled:opacity-50"
              >
                {savingPct ? "Guardando..." : "Guardar"}
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-brand-300" />
              <span className="text-stone-400">Barbería:</span>
              <span className="font-display text-lg text-brand-100">
                ${totals.shopShare.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-brand-300" />
              <span className="text-stone-400">Barberos:</span>
              <span className="font-display text-lg text-brand-100">
                ${totals.barbersShare.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendario semanal */}
      <WeekCalendar
        items={items}
        weekOffset={weekOffset}
        onPrev={() => setWeekOffset((w) => w - 1)}
        onNext={() => setWeekOffset((w) => w + 1)}
        onToday={() => setWeekOffset(0)}
      />

      {error && (
        <div className="rounded-lg bg-red-950/40 ring-1 ring-red-900 px-3 py-2 text-sm text-red-200 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 p-8 text-center text-stone-400">
          No hay citas para los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-6">
          {visibleBarbers.map((b) => {
            const g = byBarber[b.value];
            if (g.items.length === 0) return null;
            return (
              <section
                key={b.value}
                className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 overflow-hidden"
              >
                <header className="flex items-center gap-3 px-4 py-3 bg-stone-950/60 border-b border-stone-800">
                  <div className="rounded-full bg-brand-500/20 p-2 ring-1 ring-brand-500/40">
                    <Scissors className="h-4 w-4 text-brand-300" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-display text-lg text-brand-100">
                      {b.label}
                    </h2>
                    <p className="text-xs text-stone-400">
                      {g.items.length} cita{g.items.length !== 1 ? "s" : ""}
                      {Object.keys(g.services).length > 0 && (
                        <>
                          {" · "}
                          {Object.entries(g.services)
                            .map(([label, n]) => `${n} ${label.toLowerCase()}`)
                            .join(", ")}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-stone-400">Ingresos</div>
                    <div className="font-display text-xl text-brand-200">
                      ${g.revenue.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      Barbero: $
                      {((g.revenue * (100 - commissionPct)) / 100).toFixed(2)}
                      {" · "}Casa: $
                      {((g.revenue * commissionPct) / 100).toFixed(2)}
                    </div>
                  </div>
                </header>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-950/40 text-stone-400 text-xs uppercase tracking-wide">
                      <tr>
                        <Th>Fecha</Th>
                        <Th>Hora</Th>
                        <Th>Cliente</Th>
                        <Th>Teléfono</Th>
                        <Th>Servicio</Th>
                        <Th>Extras</Th>
                        <Th>Pago</Th>
                        <Th className="text-right">Monto</Th>
                        <Th>Estado</Th>
                        <Th>Acciones</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                      {g.items.map((c) => {
                        const extras: string[] = [];
                        if (c.extra_mask) extras.push("Mascarilla");
                        if (c.extra_massage) extras.push("Masaje");
                        if (c.drink) extras.push(DRINK_LABELS[c.drink]);
                        return (
                          <tr key={c.id} className="hover:bg-stone-900/40">
                            <Td>{c.appointment_date}</Td>
                            <Td>{String(c.appointment_time).slice(0, 5)}</Td>
                            <Td className="font-medium text-stone-100">
                              {c.customer_name}
                            </Td>
                            <Td>{c.customer_phone}</Td>
                            <Td>{SERVICES[c.service].label}</Td>
                            <Td>
                              {extras.length === 0 ? (
                                <span className="text-stone-500">—</span>
                              ) : (
                                <span className="text-xs text-brand-200">
                                  {extras.join(", ")}
                                </span>
                              )}
                            </Td>
                            <Td>
                              {c.payment_currency === "USD"
                                ? "USD efectivo"
                                : "Bs. efectivo"}
                            </Td>
                            <Td className="text-right font-medium text-stone-100">
                              ${Number(c.price_usd).toFixed(2)}
                            </Td>
                            <Td>
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs ring-1 ${
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
                            </Td>
                            <Td>
                              {c.status === "agendada" ? (
                                <div className="flex gap-1.5">
                                  <IconAction
                                    title="Marcar completada"
                                    disabled={updatingId === c.id}
                                    onClick={() =>
                                      setAppointmentStatus(c.id, "completada")
                                    }
                                    className="text-emerald-300 hover:bg-emerald-950/40"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </IconAction>
                                  <IconAction
                                    title="No asistió"
                                    disabled={updatingId === c.id}
                                    onClick={() =>
                                      setAppointmentStatus(c.id, "no_asistio")
                                    }
                                    className="text-stone-300 hover:bg-stone-800"
                                  >
                                    <UserX className="h-4 w-4" />
                                  </IconAction>
                                  <IconAction
                                    title="Cancelar cita"
                                    disabled={updatingId === c.id}
                                    onClick={() =>
                                      setAppointmentStatus(c.id, "cancelada")
                                    }
                                    className="text-red-300 hover:bg-red-950/40"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </IconAction>
                                </div>
                              ) : (
                                <span className="text-stone-600 text-xs">—</span>
                              )}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {/* Citas sin barbero asignado (por si existieran filas antiguas) */}
          {barberFilter === "todos" &&
            filtered.some((c) => !c.barber) && (
              <section className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 overflow-hidden">
                <header className="px-4 py-3 bg-stone-950/60 border-b border-stone-800">
                  <h2 className="font-display text-lg text-stone-200">
                    Sin barbero asignado
                  </h2>
                </header>
                <div className="p-4 text-xs text-stone-400">
                  {filtered.filter((c) => !c.barber).length} cita(s) antiguas
                  sin barbero.
                </div>
              </section>
            )}
        </div>
      )}
    </main>
  );
}

function WeekCalendar({
  items,
  weekOffset,
  onPrev,
  onNext,
  onToday,
}: {
  items: Appointment[];
  weekOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const start = weekStart(weekOffset);
  const days: { iso: string; label: string }[] = [];
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  for (let i = 0; i < 6; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push({ iso: toISO(d), label: `${dayNames[i]} ${d.getDate()}` });
  }
  const hours = Array.from({ length: 10 }, (_, i) => 9 + i);
  const todayIso = toISO(new Date());

  const byCell = new Map<string, Appointment[]>();
  for (const c of items) {
    if (c.status === "cancelada") continue;
    const key = `${c.appointment_date}|${String(c.appointment_time).slice(0, 5)}`;
    const list = byCell.get(key) ?? [];
    list.push(c);
    byCell.set(key, list);
  }

  return (
    <section className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 overflow-hidden mb-8">
      <header className="flex items-center gap-2 px-4 py-3 bg-stone-950/60 border-b border-stone-800">
        <CalendarDays className="h-4 w-4 text-brand-300" />
        <h2 className="font-display text-lg text-brand-100">
          Calendario semanal
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onPrev}
            className="rounded-md p-1.5 ring-1 ring-stone-800 text-stone-300 hover:bg-stone-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onToday}
            className="rounded-md px-2.5 py-1.5 ring-1 ring-stone-800 text-xs text-stone-300 hover:bg-stone-800"
          >
            Hoy
          </button>
          <button
            onClick={onNext}
            className="rounded-md p-1.5 ring-1 ring-stone-800 text-stone-300 hover:bg-stone-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-stone-950/40 text-stone-400">
              <th className="px-2 py-2 text-left font-medium w-14">Hora</th>
              {days.map((d) => (
                <th
                  key={d.iso}
                  className={`px-2 py-2 text-left font-medium ${
                    d.iso === todayIso ? "text-brand-300" : ""
                  }`}
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800">
            {hours.map((h) => {
              const hh = `${String(h).padStart(2, "0")}:00`;
              return (
                <tr key={h}>
                  <td className="px-2 py-1.5 text-stone-500">{hh}</td>
                  {days.map((d) => {
                    const cell = byCell.get(`${d.iso}|${hh}`) ?? [];
                    return (
                      <td key={d.iso} className="px-1.5 py-1.5 align-top">
                        <div className="flex flex-wrap gap-1">
                          {cell.map((c) => (
                            <span
                              key={c.id}
                              title={`${c.customer_name} · ${SERVICES[c.service].label} · $${c.price_usd}`}
                              className={`inline-block rounded px-1.5 py-0.5 ring-1 ${
                                c.barber
                                  ? BARBER_COLORS[c.barber]
                                  : "bg-stone-800 text-stone-300 ring-stone-700"
                              }`}
                            >
                              {c.barber
                                ? c.barber.charAt(0).toUpperCase()
                                : "?"}
                            </span>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="flex items-center gap-3 px-4 py-2 border-t border-stone-800 text-[11px] text-stone-400">
        {BARBERS.map((b) => (
          <span key={b.value} className="inline-flex items-center gap-1">
            <span
              className={`inline-block h-3 w-3 rounded ring-1 ${BARBER_COLORS[b.value]}`}
            />
            {b.label}
          </span>
        ))}
      </footer>
    </section>
  );
}

function IconAction({
  children,
  title,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 ring-1 ring-stone-800 transition disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 p-4">
      <div className="flex items-center gap-2 text-xs text-stone-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl text-brand-100">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-stone-500">{hint}</div>}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide font-medium text-stone-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

const selectCls =
  "w-full rounded-lg bg-stone-950/60 ring-1 ring-stone-800 px-3 py-2 text-sm text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-400 transition";

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-4 py-3 text-left font-medium ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-stone-300 ${className}`}>{children}</td>
  );
}
