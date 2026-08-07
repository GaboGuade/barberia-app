export const BUSINESS = {
  name: "Barbería",
  // Lunes a sábado 9:00 a 19:00 (último turno empieza 18:00). Domingo cerrado.
  openHour: 9,
  closeHour: 19, // exclusivo: el último slot empieza a las 18:00
  closedWeekdays: [0], // 0 = domingo
  barbersCount: 3,
  // Número de WhatsApp del negocio (formato internacional sin +, ej: 584141234567)
  whatsappPhone: process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? "",
};

export const SERVICES = {
  corte: { label: "Corte de cabello", priceUsd: 10 },
  corte_barba: { label: "Corte + Barba", priceUsd: 15 },
} as const;

export type ServiceKey = keyof typeof SERVICES;

export const BARBERS = [
  {
    value: "jose",
    label: "Jose",
    tagline: "Especialista en cortes clásicos",
  },
  {
    value: "gabriel",
    label: "Gabriel",
    tagline: "Fades modernos y diseños",
  },
  {
    value: "alejandro",
    label: "Alejandro",
    tagline: "Barba y arreglo de precisión",
  },
] as const;

export type BarberKey = (typeof BARBERS)[number]["value"];

export const DRINKS = [
  { value: "cerveza", label: "Cerveza" },
  { value: "malta", label: "Malta" },
  { value: "coca_cola", label: "Coca-Cola" },
] as const;

export type DrinkKey = (typeof DRINKS)[number]["value"];

export const DRINK_LABELS: Record<DrinkKey, string> = DRINKS.reduce(
  (acc, d) => ({ ...acc, [d.value]: d.label }),
  {} as Record<DrinkKey, string>
);

export const BARBER_LABELS: Record<BarberKey, string> = BARBERS.reduce(
  (acc, b) => ({ ...acc, [b.value]: b.label }),
  {} as Record<BarberKey, string>
);

export const PAYMENT_METHODS = [
  { value: "efectivo_usd", label: "Efectivo (USD)", currency: "USD" as const },
  { value: "efectivo_ves", label: "Efectivo (Bolívares)", currency: "VES" as const },
];

export function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = BUSINESS.openHour; h < BUSINESS.closeHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

export function isClosedDate(dateStr: string): boolean {
  // dateStr en formato YYYY-MM-DD interpretado como local
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return BUSINESS.closedWeekdays.includes(date.getDay());
}
