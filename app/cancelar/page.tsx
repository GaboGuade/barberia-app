"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarX,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BUSINESS } from "@/lib/constants";

function CancelContent() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const token = params.get("token") ?? "";

  const [state, setState] = useState<
    "idle" | "loading" | "done" | "failed" | "invalid"
  >(!id || !token ? "invalid" : "idle");

  async function handleCancel() {
    setState("loading");
    const { data, error } = await supabase.rpc("cancel_appointment", {
      p_id: id,
      p_token: token,
    });
    if (error || data !== true) {
      setState("failed");
      return;
    }
    setState("done");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-brand-200 hover:text-brand-100 mb-10"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al inicio
      </Link>

      <div className="rounded-2xl bg-stone-900/70 backdrop-blur p-6 md:p-8 ring-1 ring-stone-800 shadow-xl text-center">
        {state === "invalid" && (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-amber-400" />
            <h1 className="mt-4 font-display text-xl text-brand-100">
              Enlace inválido
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              Este enlace de cancelación no es válido o está incompleto.
            </p>
          </>
        )}

        {(state === "idle" || state === "loading") && (
          <>
            <CalendarX className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-4 font-display text-xl text-brand-100">
              Cancelar cita
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              ¿Seguro que quieres cancelar tu cita en {BUSINESS.name}? Esta
              acción libera tu horario y no se puede deshacer.
            </p>
            <button
              onClick={handleCancel}
              disabled={state === "loading"}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition disabled:opacity-50"
            >
              {state === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarX className="h-4 w-4" />
              )}
              Sí, cancelar mi cita
            </button>
          </>
        )}

        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-4 font-display text-xl text-brand-100">
              Cita cancelada
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              Tu cita fue cancelada y el horario quedó libre. ¡Te esperamos en
              otra ocasión!
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-stone-900 hover:bg-brand-400 transition"
            >
              Agendar nueva cita
            </Link>
          </>
        )}

        {state === "failed" && (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-amber-400" />
            <h1 className="mt-4 font-display text-xl text-brand-100">
              No se pudo cancelar
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              La cita ya fue cancelada, ya pasó su horario, o el enlace no es
              válido. Si necesitas ayuda contáctanos directamente.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function CancelarPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-4 py-16 flex items-center gap-2 text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </main>
      }
    >
      <CancelContent />
    </Suspense>
  );
}
