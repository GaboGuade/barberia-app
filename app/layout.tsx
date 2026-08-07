import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barbería El Navaja · Agenda tu cita",
  description:
    "Reserva tu corte en línea. Cortes desde 10$ y corte + barba desde 15$.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
