import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // En desarrollo lanzamos un warning para facilitar el debugging.
  // En runtime el cliente fallará con un mensaje claro al intentar usarlo.
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
  );
}

export const supabase = createClient(
  supabaseUrl ?? "http://localhost",
  supabaseAnonKey ?? "public-anon-placeholder"
);

export type Service = "corte" | "corte_barba";
export type Currency = "USD" | "VES";
export type Barber = "jose" | "gabriel" | "alejandro";
export type Drink = "cerveza" | "malta" | "coca_cola";

export interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  service: Service;
  barber: Barber;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // HH:MM:SS
  price_usd: number;
  payment_currency: Currency;
  payment_method: string;
  extra_mask: boolean;
  extra_massage: boolean;
  drink: Drink | null;
  notes: string | null;
  status: string;
  created_at: string;
}
