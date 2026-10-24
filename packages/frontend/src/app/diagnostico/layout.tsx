import type { Metadata } from "next";

// Link privado de cada cliente: não indexar
export const metadata: Metadata = {
  title: "Análise de Perfil · Dua Criativa",
  robots: { index: false, follow: false },
};

export default function DiagnosticoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
