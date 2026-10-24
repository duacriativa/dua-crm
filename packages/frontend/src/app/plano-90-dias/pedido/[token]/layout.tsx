import type { Metadata } from "next";

// Link privado de cada pedido: não indexar
export const metadata: Metadata = {
  title: "Seu pedido · Dua Criativa",
  robots: { index: false, follow: false },
};

export default function PedidoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
