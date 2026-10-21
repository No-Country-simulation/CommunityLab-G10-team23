import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Community Lab - Hub de Distribución y Análisis",
  description: "Pipeline inteligente integrado con FastAPI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-slate-100">{children}</body>
    </html>
  );
}
