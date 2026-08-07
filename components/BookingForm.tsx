"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Scissors,
  Sparkles,
  GlassWater,
  HandHeart,
  MessageCircle,
} from "lucide-react";
import {
  BARBERS,
  BarberKey,
  BUSINESS,
  DRINKS,
  DrinkKey,
  PAYMENT_METHODS,
  SERVICES,
  ServiceKey,
  getTimeSlots,
  isClosedDate,
} from "@/lib/constants";
import { supabase } from "@/lib/supabase";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; id: string; cancelToken: string }
  | { kind: "error"; message: string };

const ALL_SLOTS = getTimeSlots();

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function maxDateLocalISO(daysAhead = 60): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BookingForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState<ServiceKey>("corte");
  const [barber, setBarber] = useState<BarberKey | "">("");
  const [date, setDate] = useState<string>(todayLocalISO());
  const [time, setTime] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>(
    PAYMENT_METHODS[0].value
  );
  const [extraMask, setExtraMask] = useState(false);
  const [extraMassage, setExtraMassage] = useState(false);
  const [drink, setDrink] = useState<DrinkKey | "">("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Mapa: hora -> set de barberos ya ocupados a esa hora
  const [bookedByBarber, setBookedByBarber] = useState<
    Record<string, Set<string>>
  >({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  const closed = isClosedDate(date);
  const price = SERVICES[service].priceUsd;
  const bsRate = Number(process.env.NEXT_PUBLIC_BS_RATE || 0);
  const selectedPayment = PAYMENT_METHODS.find((p) => p.value === paymentMethod)!;

  // Lista de slots visibles (no pasados si es hoy), con marca de "ocupado"
  // para el barbero seleccionado.
  const slotsForUI = useMemo(() => {
    if (closed) return [] as Array<{ time: string; busy: boolean }>;
    const now = new Date();
    const isToday = date === todayLocalISO();
    return ALL_SLOTS.filter((slot) => {
      if (isToday) {
        const [h] = slot.split(":").map(Number);
        if (h <= now.getHours()) return false;
      }
      return true;
    }).map((slot) => {
      const taken = bookedByBarber[slot];
      const busy = !!barber && !!taken && taken.has(barber);
      return { time: slot, busy };
    });
  }, [bookedByBarber, date, closed, barber]);

  const availableSlots = useMemo(
    () => slotsForUI.filter((s) => !s.busy).map((s) => s.time),
    [slotsForUI]
  );

  // Carga slots ya reservados para la fecha seleccionada (por barbero)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (closed) {
        setBookedByBarber({});
        return;
      }
      setLoadingSlots(true);
      // RPC pública que solo devuelve (hora, barbero) ocupados,
      // sin exponer datos de clientes.
      const { data, error } = await supabase.rpc("get_booked_slots", {
        p_date: date,
      });

      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.error("Error cargando slots:", error.message);
        setBookedByBarber({});
      } else {
        const map: Record<string, Set<string>> = {};
        for (const row of (data ?? []) as Array<{
          appointment_time: string;
          barber: string;
        }>) {
          const t = String(row.appointment_time).slice(0, 5); // HH:MM
          if (!map[t]) map[t] = new Set();
          map[t].add(row.barber);
        }
        setBookedByBarber(map);
      }
      setLoadingSlots(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [date, closed]);

  // Si el time seleccionado deja de estar disponible, limpiarlo
  useEffect(() => {
    if (time && !availableSlots.includes(time)) {
      setTime("");
    }
  }, [availableSlots, time]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName || !cleanPhone || !barber || !time || closed) {
      setStatus({
        kind: "error",
        message: "Completa todos los campos requeridos.",
      });
      return;
    }
    if (cleanName.length < 3) {
      setStatus({
        kind: "error",
        message: "El nombre debe tener al menos 3 caracteres.",
      });
      return;
    }
    const phoneDigits = cleanPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      setStatus({
        kind: "error",
        message:
          "El teléfono no parece válido. Usa el formato 0414-1234567.",
      });
      return;
    }
    if (!ALL_SLOTS.includes(time)) {
      setStatus({ kind: "error", message: "Hora inválida." });
      return;
    }
    setStatus({ kind: "loading" });

    // RPC segura: inserta y devuelve id + cancel_token
    // (anon no puede hacer INSERT...RETURNING por RLS)
    const { data, error } = await supabase.rpc("book_appointment", {
      p_name: cleanName,
      p_phone: cleanPhone,
      p_service: service,
      p_barber: barber,
      p_date: date,
      p_time: `${time}:00`,
      p_price: price,
      p_currency: selectedPayment.currency,
      p_method: paymentMethod,
      p_mask: extraMask,
      p_massage: extraMassage,
      p_drink: drink || null,
      p_notes: notes.trim() || null,
    });

    if (error) {
      // Conflicto por trigger (barbero ocupado / bloqueado) → mensaje claro
      const msg =
        error.message.includes("duplicate") ||
        error.message.includes("BARBER_BUSY")
          ? "Ese barbero acaba de ocuparse en ese horario. Elige otra hora u otro barbero."
          : error.message.includes("INVALID")
          ? "Los datos ingresados no son válidos. Revísalos e intenta de nuevo."
          : error.message;
      setStatus({ kind: "error", message: msg });
      return;
    }

    const result = data as { id: string; cancel_token: string };
    setStatus({
      kind: "success",
      id: result.id,
      cancelToken: result.cancel_token,
    });
    // Refrescar disponibilidad localmente
    setBookedByBarber((prev) => {
      const next = { ...prev };
      const set = new Set(next[time] ?? []);
      set.add(barber);
      next[time] = set;
      return next;
    });
  }

  function resetForm() {
    setName("");
    setPhone("");
    setNotes("");
    setTime("");
    setBarber("");
    setExtraMask(false);
    setExtraMassage(false);
    setDrink("");
    setStatus({ kind: "idle" });
  }

  if (status.kind === "success") {
    const barberLabel = BARBERS.find((b) => b.value === barber)?.label;
    const drinkLabel = DRINKS.find((d) => d.value === drink)?.label;
    const extras: string[] = [];
    if (extraMask) extras.push("mascarilla facial");
    if (extraMassage) extras.push("masaje capilar");
    if (drinkLabel) extras.push(drinkLabel.toLowerCase());

    const cancelUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/cancelar?id=${status.id}&token=${status.cancelToken}`
        : "";

    const waText = encodeURIComponent(
      `Hola, soy ${name.trim()}. Confirmo mi cita en ${BUSINESS.name}:\n` +
        `📅 ${date} a las ${time}\n` +
        `💈 ${SERVICES[service].label} con ${barberLabel}\n` +
        `💵 $${price} (${selectedPayment.label})` +
        (extras.length > 0 ? `\n✨ Extras: ${extras.join(", ")}` : "")
    );

    return (
      <div className="text-center py-6">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
        <h3 className="mt-4 font-display text-xl text-brand-100">
          ¡Cita confirmada!
        </h3>
        <p className="mt-2 text-sm text-stone-300">
          Te esperamos el <strong>{date}</strong> a las{" "}
          <strong>{time}</strong>
          {barberLabel && (
            <>
              {" "}con <strong>{barberLabel}</strong>
            </>
          )}
          .
        </p>
        {extras.length > 0 && (
          <p className="mt-2 text-xs text-brand-200">
            Te tendremos lista tu {extras.join(", ")}.
          </p>
        )}
        <p className="mt-1 text-xs text-stone-500">ID: {status.id}</p>

        <div className="mt-6 space-y-3">
          {BUSINESS.whatsappPhone && (
            <a
              href={`https://wa.me/${BUSINESS.whatsappPhone}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full justify-center items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition"
            >
              <MessageCircle className="h-4 w-4" />
              Confirmar por WhatsApp
            </a>
          )}

          <div className="rounded-lg bg-stone-950/60 ring-1 ring-stone-800 p-3 text-left">
            <p className="text-xs text-stone-400 mb-1.5">
              ¿No podrás asistir? Guarda este enlace para cancelar tu cita:
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={cancelUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded-md bg-stone-900 ring-1 ring-stone-800 px-2 py-1.5 text-[11px] text-stone-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(cancelUrl)}
                className="shrink-0 rounded-md bg-stone-800 px-2.5 py-1.5 text-xs text-brand-200 hover:bg-stone-700 transition"
              >
                Copiar
              </button>
            </div>
          </div>

          <button
            onClick={resetForm}
            className="inline-flex justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-stone-900 hover:bg-brand-400 transition"
          >
            Agendar otra cita
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre completo *">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Juan Pérez"
            className={inputCls}
          />
        </Field>
        <Field label="Teléfono *">
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0414-1234567"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Servicio *">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SERVICES) as ServiceKey[]).map((key) => {
            const s = SERVICES[key];
            const active = service === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setService(key)}
                className={`rounded-lg px-3 py-3 text-left ring-1 transition ${
                  active
                    ? "bg-brand-500/15 ring-brand-400 text-brand-100"
                    : "bg-stone-950/40 ring-stone-800 text-stone-300 hover:ring-stone-700"
                }`}
              >
                <div className="flex justify-between items-baseline">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-brand-300 text-sm">${s.priceUsd}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Elige tu barbero *">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {BARBERS.map((b) => {
            const active = barber === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => setBarber(b.value)}
                className={`rounded-lg px-3 py-3 text-left ring-1 transition ${
                  active
                    ? "bg-brand-500/15 ring-brand-400 text-brand-100"
                    : "bg-stone-950/40 ring-stone-800 text-stone-300 hover:ring-stone-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-brand-300" />
                  <span className="font-medium">{b.label}</span>
                </div>
                <p className="mt-1 text-xs text-stone-400">{b.tagline}</p>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Fecha *">
          <input
            type="date"
            required
            min={todayLocalISO()}
            max={maxDateLocalISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
          {closed && (
            <p className="mt-1 text-xs text-amber-400">
              Cerrado los domingos. Elige otra fecha.
            </p>
          )}
        </Field>

        <Field label="Hora *">
          {!barber ? (
            <p className="text-xs text-stone-500 px-1 py-2.5">
              Elige un barbero primero.
            </p>
          ) : loadingSlots ? (
            <p className="text-xs text-stone-500 px-1 py-2.5">Cargando horarios...</p>
          ) : slotsForUI.length === 0 ? (
            <p className="text-xs text-stone-500 px-1 py-2.5">
              Sin horarios disponibles para esta fecha.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {slotsForUI.map(({ time: slot, busy }) => {
                const active = time === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={busy}
                    onClick={() => setTime(slot)}
                    title={busy ? "Barbero ocupado en este horario" : undefined}
                    className={`relative rounded-lg px-2 py-2 text-sm ring-1 transition ${
                      busy
                        ? "bg-stone-950/40 ring-stone-800 text-stone-600 line-through cursor-not-allowed"
                        : active
                        ? "bg-brand-500/20 ring-brand-400 text-brand-100 font-medium"
                        : "bg-stone-950/40 ring-stone-800 text-stone-200 hover:ring-stone-600"
                    }`}
                  >
                    {slot}
                    {busy && (
                      <span className="block text-[9px] uppercase tracking-wide text-stone-500 -mt-0.5">
                        ocupado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {barber && !loadingSlots && availableSlots.length === 0 && slotsForUI.length > 0 && (
            <p className="mt-2 text-xs text-amber-400">
              Este barbero no tiene horarios libres ese día. Prueba con otro barbero u otra fecha.
            </p>
          )}
        </Field>
      </div>

      <Field label="Método de pago *">
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((p) => {
            const active = paymentMethod === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPaymentMethod(p.value)}
                className={`rounded-lg px-3 py-2.5 text-sm ring-1 transition ${
                  active
                    ? "bg-brand-500/15 ring-brand-400 text-brand-100"
                    : "bg-stone-950/40 ring-stone-800 text-stone-300 hover:ring-stone-700"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-sm text-stone-400">
          Total: <span className="text-brand-200 font-semibold">${price}</span>
          {selectedPayment.currency === "VES" && bsRate > 0 && (
            <span className="text-stone-500">
              {" "}
              ≈ Bs. {(price * bsRate).toFixed(2)}
            </span>
          )}
        </div>
      </Field>

      <div className="rounded-xl bg-stone-950/40 ring-1 ring-stone-800 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-300" />
          <h3 className="text-sm font-medium text-brand-100">
            Personaliza tu experiencia
          </h3>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-brand-300/80">
            Cortesía de la casa
          </span>
        </div>

        <ToggleRow
          icon={<Sparkles className="h-4 w-4 text-brand-300" />}
          title="Mascarilla facial"
          subtitle="Relaja y revitaliza tu piel mientras te atendemos."
          checked={extraMask}
          onChange={setExtraMask}
        />

        <ToggleRow
          icon={<HandHeart className="h-4 w-4 text-brand-300" />}
          title="Masaje capilar"
          subtitle="Masaje breve en cuero cabelludo y cuello."
          checked={extraMassage}
          onChange={setExtraMassage}
        />

        <div>
          <div className="flex items-center gap-2 mb-2">
            <GlassWater className="h-4 w-4 text-brand-300" />
            <span className="text-sm text-stone-200">Bebida de cortesía</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setDrink("")}
              className={`rounded-lg px-3 py-2 text-sm ring-1 transition ${
                drink === ""
                  ? "bg-brand-500/15 ring-brand-400 text-brand-100"
                  : "bg-stone-950/40 ring-stone-800 text-stone-300 hover:ring-stone-700"
              }`}
            >
              Ninguna
            </button>
            {DRINKS.map((d) => {
              const active = drink === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDrink(d.value)}
                  className={`rounded-lg px-3 py-2 text-sm ring-1 transition ${
                    active
                      ? "bg-brand-500/15 ring-brand-400 text-brand-100"
                      : "bg-stone-950/40 ring-stone-800 text-stone-300 hover:ring-stone-700"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Field label="Notas (opcional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Algo que debamos saber"
          className={inputCls}
        />
      </Field>

      {status.kind === "error" && (
        <div className="flex items-start gap-2 rounded-lg bg-red-950/40 ring-1 ring-red-900 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{status.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={status.kind === "loading" || closed || !time || !barber}
        className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-brand-500 px-5 py-3 font-medium text-stone-900 hover:bg-brand-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status.kind === "loading" && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        Confirmar cita
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg bg-stone-950/60 ring-1 ring-stone-800 px-3 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-400 transition";

function ToggleRow({
  icon,
  title,
  subtitle,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 ring-1 transition text-left ${
        checked
          ? "bg-brand-500/15 ring-brand-400"
          : "bg-stone-950/40 ring-stone-800 hover:ring-stone-700"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">
        <span
          className={`block text-sm font-medium ${
            checked ? "text-brand-100" : "text-stone-200"
          }`}
        >
          {title}
        </span>
        <span className="block text-xs text-stone-400">{subtitle}</span>
      </span>
      <span
        className={`h-5 w-9 rounded-full ring-1 transition relative ${
          checked
            ? "bg-brand-500 ring-brand-400"
            : "bg-stone-800 ring-stone-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-stone-100 transition-all ${
            checked ? "left-4" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-300 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
