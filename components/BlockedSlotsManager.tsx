"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { StaffProfile } from "@/lib/auth";
import { BARBERS, BARBER_LABELS, getTimeSlots } from "@/lib/constants";
import type { BarberKey } from "@/lib/constants";

interface BlockedSlot {
  id: string;
  barber: BarberKey | null;
  block_date: string;
  block_time: string | null;
  reason: string | null;
}

const ALL_SLOTS = getTimeSlots();

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Gestión de horarios bloqueados (almuerzo, día libre, vacaciones).
 * - Barbero: solo puede bloquear sus propios horarios.
 * - Admin: puede bloquear para cualquier barbero o para todos.
 */
export default function BlockedSlotsManager({
  staff,
}: {
  staff: StaffProfile;
}) {
  const isAdmin = staff.role === "admin";

  const [items, setItems] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [barber, setBarber] = useState<string>(
    isAdmin ? "" : staff.barber_key ?? ""
  );
  const [date, setDate] = useState<string>(todayLocalISO());
  const [time, setTime] = useState<string>(""); // "" = todo el día
  const [reason, setReason] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("blocked_slots")
      .select("id, barber, block_date, block_time, reason")
      .gte("block_date", todayLocalISO())
      .order("block_date", { ascending: true })
      .order("block_time", { ascending: true, nullsFirst: true });
    // El barbero solo ve sus bloqueos (y los generales)
    if (!isAdmin && staff.barber_key) {
      query = query.or(`barber.eq.${staff.barber_key},barber.is.null`);
    }
    const { data, error } = await query;
    if (error) setError(error.message);
    else setItems((data as BlockedSlot[]) ?? []);
    setLoading(false);
  }, [isAdmin, staff.barber_key]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date) {
      setError("Elige una fecha.");
      return;
    }
    if (!isAdmin && !staff.barber_key) {
      setError("Tu cuenta no tiene barbero asignado.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("blocked_slots").insert({
      barber: isAdmin ? barber || null : staff.barber_key,
      block_date: date,
      block_time: time ? `${time}:00` : null,
      reason: reason.trim() || null,
      created_by: staff.id,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTime("");
    setReason("");
    load();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
    if (error) setError(error.message);
    else setItems((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <section className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 bg-stone-950/60 border-b border-stone-800">
        <CalendarOff className="h-4 w-4 text-brand-300" />
        <h2 className="font-display text-lg text-brand-100">
          Bloquear horarios
        </h2>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-stone-500">
          Almuerzo · día libre · vacaciones
        </span>
      </header>

      <form
        onSubmit={handleAdd}
        className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 items-end"
      >
        {isAdmin && (
          <label className="block">
            <span className={labelCls}>Barbero</span>
            <select
              value={barber}
              onChange={(e) => setBarber(e.target.value)}
              className={inputCls}
            >
              <option value="">Todos</option>
              {BARBERS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className={labelCls}>Fecha</span>
          <input
            type="date"
            required
            min={todayLocalISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Hora</span>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputCls}
          >
            <option value="">Todo el día</option>
            {ALL_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Motivo (opcional)</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Almuerzo, día libre..."
            maxLength={80}
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-brand-400 transition disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Bloquear
        </button>
      </form>

      {error && (
        <div className="mx-4 mb-3 rounded-lg bg-red-950/40 ring-1 ring-red-900 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="border-t border-stone-800">
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando bloqueos...
          </div>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">
            No hay horarios bloqueados próximos.
          </p>
        ) : (
          <ul className="divide-y divide-stone-800">
            {items.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="text-stone-200 font-medium">
                  {b.block_date}
                </span>
                <span className="text-stone-400">
                  {b.block_time
                    ? String(b.block_time).slice(0, 5)
                    : "Todo el día"}
                </span>
                <span className="text-brand-200">
                  {b.barber ? BARBER_LABELS[b.barber] : "Todos los barberos"}
                </span>
                {b.reason && (
                  <span className="text-xs text-stone-500 truncate">
                    {b.reason}
                  </span>
                )}
                {(isAdmin || b.barber === staff.barber_key) && (
                  <button
                    onClick={() => handleDelete(b.id)}
                    title="Eliminar bloqueo"
                    className="ml-auto rounded-md p-1.5 text-red-300 ring-1 ring-stone-800 hover:bg-red-950/40 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const labelCls =
  "block text-[11px] uppercase tracking-wide font-medium text-stone-400 mb-1";
const inputCls =
  "w-full rounded-lg bg-stone-950/60 ring-1 ring-stone-800 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-400 transition";
