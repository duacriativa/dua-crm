"use client";

import { useState } from "react";
import {
  User,
  Building2,
  Bell,
  Shield,
  Smartphone,
  Users,
  ChevronRight,
  Save,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";

const sections = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "equipe", label: "Equipe", icon: Users },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "seguranca", label: "Segurança", icon: Shield },
];

export default function ConfiguracoesPage() {
  const [activeSection, setActiveSection] = useState("perfil");
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [perfil, setPerfil] = useState({
    name: "Daniel Guedes",
    email: "suporte@duacriativa.com.br",
    phone: "+55 11 99999-9999",
    role: "Proprietário",
  });

  const [empresa, setEmpresa] = useState({
    name: "Dua Criativa",
    slug: "dua-criativa",
    plan: "ESCALA",
  });

  const [notifs, setNotifs] = useState({
    newMessage: true,
    newLead: true,
    botAlert: false,
    campaignResult: true,
    emailDigest: false,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="h-full bg-gray-50 flex overflow-hidden">
      {/* Sidebar nav */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-4 shrink-0">
        <div className="px-4 mb-4">
          <h1 className="text-base font-bold text-gray-900">Configurações</h1>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  activeSection === s.id
                    ? "bg-brand-50 text-brand-600"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl p-8">
          {/* ── Perfil ── */}
          {activeSection === "perfil" && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-6">Meu Perfil</h2>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-600 font-bold text-2xl flex items-center justify-center">
                    {perfil.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{perfil.name}</p>
                    <p className="text-xs text-gray-400">{perfil.role}</p>
                    <button className="mt-1.5 text-xs text-brand-600 hover:underline">Alterar foto</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome</label>
                    <input
                      value={perfil.name}
                      onChange={(e) => setPerfil((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Telefone</label>
                    <input
                      value={perfil.phone}
                      onChange={(e) => setPerfil((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">E-mail</label>
                    <input
                      value={perfil.email}
                      onChange={(e) => setPerfil((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <button onClick={handleSave} className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors ${saved ? "bg-green-500 text-white" : "bg-brand-600 hover:bg-brand-700 text-white"}`}>
                  {saved ? <><Check className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar alterações</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Empresa ── */}
          {activeSection === "empresa" && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-6">Dados da Empresa</h2>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome da Empresa</label>
                  <input
                    value={empresa.name}
                    onChange={(e) => setEmpresa((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Slug (URL)</label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
                    <span className="px-3 py-2.5 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">crm.duacriativa.com.br/</span>
                    <input
                      value={empresa.slug}
                      onChange={(e) => setEmpresa((p) => ({ ...p, slug: e.target.value }))}
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Plano</label>
                  <div className="flex items-center gap-3 p-4 bg-brand-50 border border-brand-100 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-brand-700">Plano {empresa.plan}</p>
                      <p className="text-xs text-brand-500">Atendentes ilimitados · Bots ilimitados · Campanhas</p>
                    </div>
                  </div>
                </div>
                <button onClick={handleSave} className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors ${saved ? "bg-green-500 text-white" : "bg-brand-600 hover:bg-brand-700 text-white"}`}>
                  {saved ? <><Check className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Equipe ── */}
          {activeSection === "equipe" && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-6">Equipe</h2>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                {[
                  { name: "Daniel Guedes", email: "suporte@duacriativa.com.br", role: "OWNER", status: "online" },
                ].map((member) => (
                  <div key={member.email} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 font-bold text-sm flex items-center justify-center">
                          {member.name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{member.name}</p>
                        <p className="text-xs text-gray-400">{member.email}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold bg-brand-100 text-brand-700 px-2 py-1 rounded-full">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
              <button className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors">
                + Convidar membro
              </button>
            </div>
          )}

          {/* ── Notificações ── */}
          {activeSection === "notificacoes" && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-6">Notificações</h2>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                {[
                  { key: "newMessage", label: "Nova mensagem recebida", desc: "Quando um contato enviar uma mensagem" },
                  { key: "newLead", label: "Novo lead adicionado", desc: "Quando um novo contato entrar no funil" },
                  { key: "botAlert", label: "Alertas de Bot", desc: "Erros ou conversões importantes nos bots" },
                  { key: "campaignResult", label: "Resultado de campanha", desc: "Após o envio de uma campanha finalizar" },
                  { key: "emailDigest", label: "Resumo diário por e-mail", desc: "Receba um resumo do dia no seu e-mail" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifs((p) => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        notifs[item.key as keyof typeof notifs] ? "bg-brand-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          notifs[item.key as keyof typeof notifs] ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={handleSave} className={`mt-4 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors ${saved ? "bg-green-500 text-white" : "bg-brand-600 hover:bg-brand-700 text-white"}`}>
                {saved ? <><Check className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar</>}
              </button>
            </div>
          )}

          {/* ── Segurança ── */}
          {activeSection === "seguranca" && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-6">Segurança</h2>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Senha atual</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 pr-10"
                    />
                    <button onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Nova senha</label>
                  <input
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Confirmar nova senha</label>
                  <input
                    type="password"
                    placeholder="Repita a nova senha"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <button onClick={handleSave} className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors ${saved ? "bg-green-500 text-white" : "bg-brand-600 hover:bg-brand-700 text-white"}`}>
                  {saved ? <><Check className="w-4 h-4" /> Atualizado!</> : <><Shield className="w-4 h-4" /> Atualizar senha</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
