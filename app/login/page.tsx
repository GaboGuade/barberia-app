"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, Scissors } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStaff } from "@/lib/auth";
import { BUSINESS } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const { loading: sessionLoading, staff } = useStaff();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión de staff, redirigir según rol
  useEffect(() => {
    if (sessionLoading || !staff) return;
    router.replace(staff.role === "admin" ? "/citas" : "/panel");
  }, [sessionLoading, staff, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setError("El correo no tiene un formato válido.");
      return;
    }

    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setSubmitting(false);

    if (authError) {
      setError(
        authError.message.includes("Invalid login credentials")
          ? "Correo o contraseña incorrectos."
          : authError.message
      );
      return;
    }
    // El useEffect redirige cuando cargue el perfil de staff
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-brand-200 hover:text-brand-100 mb-10"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al inicio
      </Link>

      <div className="rounded-2xl bg-stone-900/70 backdrop-blur p-6 md:p-8 ring-1 ring-stone-800 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-brand-500/20 p-2 ring-1 ring-brand-500/40">
            <Scissors className="h-5 w-5 text-brand-300" />
          </div>
          <div>
            <h1 className="font-display text-xl text-brand-100">
              {BUSINESS.name} · Acceso
            </h1>
            <p className="text-xs text-stone-400">
              Solo empleados y administrador.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-stone-300 mb-1.5">
              Correo
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-stone-300 mb-1.5">
              Contraseña
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </label>

          {error && (
            <div className="rounded-lg bg-red-950/40 ring-1 ring-red-900 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || sessionLoading}
            className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-brand-500 px-5 py-3 font-medium text-stone-900 hover:bg-brand-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Iniciar sesión
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-stone-500">
        ¿Eres cliente? No necesitas cuenta:{" "}
        <Link href="/" className="text-brand-300 hover:underline">
          agenda tu cita aquí
        </Link>
        .
      </p>
    </main>
  );
}

const inputCls =
  "w-full rounded-lg bg-stone-950/60 ring-1 ring-stone-800 px-3 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-400 transition";
