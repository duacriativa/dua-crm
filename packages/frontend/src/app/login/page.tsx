"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/v1/auth/login`, { email, password });
      localStorage.setItem("access_token", data.accessToken);
      localStorage.setItem("refresh_token", data.refreshToken);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.message || "E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0e0a1a]">

      {/* ── Painel esquerdo — formulário ── */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 py-12 relative">

        {/* Logo */}
        <div className="absolute top-8 left-8 sm:left-16 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-black text-lg leading-none">D</span>
          </div>
          <div>
            <p className="text-white font-black text-base leading-tight tracking-tight">dua<span className="text-[#CCFF00]">.</span></p>
            <p className="text-white/40 text-[10px] leading-tight">CRM Interno</p>
          </div>
        </div>

        {/* Formulário */}
        <div className="max-w-sm w-full mx-auto">
          <h1 className="text-3xl font-black text-white mb-2 leading-tight">
            Bem-vindo de<br />
            <span className="text-primary">volta</span>
          </h1>
          <p className="text-white/50 text-sm mb-8">Acesso exclusivo — equipe Dua Criativa</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs font-medium block mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@duacriativa.com.br"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/60 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-white/60 text-xs font-medium block mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type={showPass ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/60 transition-all"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 transition-all shadow-lg shadow-violet-900/40 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-white/20 text-xs text-center mt-8">
            Acesso restrito à equipe interna.<br />
            Não compartilhe suas credenciais.
          </p>
        </div>
      </div>

      {/* ── Painel direito — imagem de moda ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        {/* Imagem de fundo */}
        <img
          src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1200&q=90&auto=format&fit=crop"
          alt="Moda"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Overlay escuro roxo */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0e0a1a]/80 via-violet-950/60 to-[#0e0a1a]/40" />

        {/* Logo flutuante */}
        <div className="absolute top-8 left-8 flex items-center gap-2 z-10">
          <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
            <span className="text-white font-black text-sm">D</span>
          </div>
          <span className="text-white font-black text-sm">dua<span className="text-[#CCFF00]">.</span></span>
        </div>

        {/* Texto sobre a imagem */}
        <div className="absolute bottom-12 left-8 right-8 z-10">
          <p className="text-white/90 text-2xl font-black leading-tight mb-2">
            Gerencie sua agência<br />
            <span className="text-violet-300">com inteligência.</span>
          </p>
          <p className="text-white/40 text-sm">
            CRM exclusivo para marcas de moda.
          </p>
        </div>

        {/* Grade decorativa */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

    </div>
  );
}
