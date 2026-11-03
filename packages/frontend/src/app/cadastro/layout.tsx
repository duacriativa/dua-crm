import type { Metadata } from "next";

// Link privado de cada cliente: não indexar
export const metadata: Metadata = {
  title: "Ficha de cadastro · Dua Criativa",
  robots: { index: false, follow: false },
};

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
