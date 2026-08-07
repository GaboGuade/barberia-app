import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import {
  Scissors,
  Clock,
  MapPin,
  BadgeDollarSign,
  Sparkles,
  GlassWater,
  HandHeart,
} from "lucide-react";
import { BARBERS, BUSINESS, SERVICES } from "@/lib/constants";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-500/20 p-2 ring-1 ring-brand-500/40">
            <Scissors className="h-6 w-6 text-brand-300" />
          </div>
          <span className="font-display text-xl tracking-wide text-brand-100">
            {BUSINESS.name}
          </span>
        </div>
        <Link
          href="/login"
          className="text-sm text-brand-200 hover:text-brand-100 underline-offset-4 hover:underline"
        >
          Acceso empleados
        </Link>
      </header>

      <section className="grid gap-10 md:grid-cols-2 md:gap-16 items-start">
        <div>
          <h1 className="font-display text-4xl md:text-5xl leading-tight text-brand-50">
            Agenda tu corte <span className="text-brand-300">en línea</span>
          </h1>
          <p className="mt-4 text-stone-300 max-w-md">
            Reserva en intervalos de 1 hora. Atendemos hasta{" "}
            {BUSINESS.barbersCount} clientes simultáneamente. Pago al asistir,
            en bolívares o dólares en efectivo.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <ServiceCard
              title={SERVICES.corte.label}
              price={SERVICES.corte.priceUsd}
              description="Corte clásico o moderno, lavado y peinado."
            />
            <ServiceCard
              title={SERVICES.corte_barba.label}
              price={SERVICES.corte_barba.priceUsd}
              description="Corte completo + arreglo y perfilado de barba."
            />
          </div>

          <ul className="mt-8 space-y-3 text-sm text-stone-300">
            <li className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-brand-300" />
              Lunes a Sábado · {BUSINESS.openHour}:00 a {BUSINESS.closeHour}:00
            </li>
            <li className="flex items-center gap-3">
              <BadgeDollarSign className="h-4 w-4 text-brand-300" />
              Pago en efectivo: USD o Bolívares
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-brand-300" />
              Te esperamos en el local. Llega 5 min antes.
            </li>
          </ul>

          <div className="mt-10">
            <h2 className="font-display text-xl text-brand-100">
              Nuestros barberos
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              Elige con quién quieres atenderte.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {BARBERS.map((b) => (
                <div
                  key={b.value}
                  className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 p-4"
                >
                  <div className="flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-brand-300" />
                    <span className="font-medium text-brand-100">{b.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-400">{b.tagline}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-xl bg-stone-900/60 ring-1 ring-stone-800 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-300" />
              <h2 className="font-display text-lg text-brand-100">
                Experiencia personalizada
              </h2>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-brand-300/80">
                Cortesía
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-stone-300">
              <li className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-brand-300" /> Mascarilla facial
              </li>
              <li className="flex items-center gap-3">
                <HandHeart className="h-4 w-4 text-brand-300" /> Masaje capilar
              </li>
              <li className="flex items-center gap-3">
                <GlassWater className="h-4 w-4 text-brand-300" /> Bebida: cerveza, malta o Coca-Cola
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl bg-stone-900/70 backdrop-blur p-6 md:p-8 ring-1 ring-stone-800 shadow-xl">
          <h2 className="font-display text-2xl text-brand-100 mb-1">
            Reserva tu cita
          </h2>
          <p className="text-sm text-stone-400 mb-6">
            Completa los datos y confirma tu turno.
          </p>
          <BookingForm />
        </div>
      </section>

      <footer className="mt-20 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} {BUSINESS.name}. Todos los derechos
        reservados.
      </footer>
    </main>
  );
}

function ServiceCard({
  title,
  price,
  description,
}: {
  title: string;
  price: number;
  description: string;
}) {
  return (
    <div className="rounded-xl bg-stone-900/60 ring-1 ring-stone-800 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg text-brand-100">{title}</h3>
        <span className="text-brand-300 font-semibold">${price}</span>
      </div>
      <p className="mt-2 text-sm text-stone-400">{description}</p>
    </div>
  );
}
