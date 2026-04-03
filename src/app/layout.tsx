import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frutos Tropicales - Sistema de Asistencia",
  description: "Sistema de control de asistencia y gestión de comidas - Frutos Tropicales del Perú",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f0fdf4]">{children}</body>
    </html>
  );
}
