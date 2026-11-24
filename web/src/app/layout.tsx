import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NARANJO · Tutor Inteligente de Estudio",
  description: "Estudia con tus propios libros, apuntes y programas académicos con asistencia de Inteligencia Artificial.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
