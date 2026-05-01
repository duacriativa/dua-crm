import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Dua CRM",
  description: "CRM inteligente para marcas de moda",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Aplica tema salvo antes do paint para evitar flash */}
        <script dangerouslySetInnerHTML={{ __html: `
(function() {
  try {
    var THEMES = {
      padrao:      { bg:"240 14% 6%",  card:"240 12% 9%",  p:"263 85% 65%", pg:"280 90% 72%", b:"240 8% 16%",  m:"240 8% 14%",  sb:"240 14% 5%",  dark:true },
      midnight:    { bg:"230 25% 4%",  card:"230 20% 7%",  p:"217 91% 60%", pg:"213 94% 68%", b:"230 15% 14%", m:"230 15% 11%", sb:"230 25% 3%",  dark:true },
      amoled:      { bg:"0 0% 0%",     card:"0 0% 4%",     p:"330 81% 60%", pg:"336 84% 68%", b:"0 0% 10%",    m:"0 0% 8%",     sb:"0 0% 0%",     dark:true },
      blackblue:   { bg:"0 0% 0%",     card:"0 0% 5%",     p:"213 94% 68%", pg:"210 100% 74%",b:"0 0% 12%",    m:"0 0% 9%",     sb:"0 0% 0%",     dark:true },
      blackgreen:  { bg:"0 0% 0%",     card:"0 0% 5%",     p:"142 71% 45%", pg:"142 76% 55%", b:"0 0% 12%",    m:"0 0% 9%",     sb:"0 0% 0%",     dark:true },
      blackpurple: { bg:"0 0% 0%",     card:"0 0% 5%",     p:"258 90% 66%", pg:"262 83% 74%", b:"0 0% 12%",    m:"0 0% 9%",     sb:"0 0% 0%",     dark:true },
      emerald:     { bg:"215 50% 9%",  card:"215 45% 12%", p:"160 84% 39%", pg:"158 64% 52%", b:"215 30% 18%", m:"215 30% 14%", sb:"215 50% 7%",  dark:true },
      ocean:       { bg:"215 55% 8%",  card:"215 50% 11%", p:"189 94% 43%", pg:"187 96% 54%", b:"215 30% 17%", m:"215 30% 13%", sb:"215 55% 6%",  dark:true },
      purplerain:  { bg:"272 60% 7%",  card:"272 55% 10%", p:"270 91% 65%", pg:"272 96% 74%", b:"272 35% 17%", m:"272 35% 13%", sb:"272 60% 5%",  dark:true },
      monochrome:  { bg:"0 0% 98%",    card:"0 0% 100%",   p:"0 0% 9%",     pg:"0 0% 20%",    b:"0 0% 89%",    m:"0 0% 94%",    sb:"0 0% 96%",    dark:false },
      rosaclaro:   { bg:"350 100% 97%",card:"0 0% 100%",   p:"347 77% 50%", pg:"345 83% 62%", b:"350 30% 88%", m:"350 20% 94%", sb:"350 50% 96%", dark:false },
      azulclaro:   { bg:"214 100% 97%",card:"0 0% 100%",   p:"217 91% 60%", pg:"213 94% 68%", b:"214 30% 88%", m:"214 50% 93%", sb:"214 60% 95%", dark:false },
    };
    var saved = localStorage.getItem("dua-crm-theme");
    var t = saved && THEMES[saved] ? THEMES[saved] : null;
    if (t) {
      var r = document.documentElement;
      r.style.setProperty("--background", t.bg);
      r.style.setProperty("--foreground", t.dark ? "0 0% 98%" : "240 10% 4%");
      r.style.setProperty("--card", t.card);
      r.style.setProperty("--card-foreground", t.dark ? "0 0% 98%" : "240 10% 4%");
      r.style.setProperty("--popover", t.card);
      r.style.setProperty("--primary", t.p);
      r.style.setProperty("--primary-glow", t.pg);
      r.style.setProperty("--muted", t.m);
      r.style.setProperty("--muted-foreground", t.dark ? "240 5% 60%" : "240 4% 46%");
      r.style.setProperty("--border", t.b);
      r.style.setProperty("--input", t.b);
      r.style.setProperty("--ring", t.p);
      r.style.setProperty("--sidebar-background", t.sb);
      r.style.setProperty("--sidebar-primary", t.p);
      r.style.setProperty("--sidebar-border", t.m);
      r.style.setProperty("--gradient-primary", "linear-gradient(135deg, hsl(" + t.p + "), hsl(" + t.pg + "))");
    }
    var fs = localStorage.getItem("dua-crm-fontsize");
    var sizes = { normal:16, reduzido:14, compacto:13 };
    if (fs && sizes[fs]) document.documentElement.style.fontSize = sizes[fs] + "px";
  } catch(e) {}
})();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
