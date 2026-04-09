"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// ─── Icons ────────────────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.917z" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-gray-200 bg-gray-50 transition-colors focus-within:border-brand-400 focus-within:bg-brand-50/30">
    {children}
  </div>
);

const TestimonialCard = ({
  testimonial,
  delay,
}: {
  testimonial: Testimonial;
  delay: string;
}) => (
  <div
    className={`${delay} flex items-start gap-3 rounded-3xl bg-white/30 backdrop-blur-xl border border-white/20 p-5 w-64 shadow-lg`}
  >
    <img
      src={testimonial.avatarSrc}
      className="h-10 w-10 object-cover rounded-2xl shrink-0"
      alt={testimonial.name}
    />
    <div className="text-sm leading-snug">
      <p className="font-semibold text-white">{testimonial.name}</p>
      <p className="text-white/60 text-xs">{testimonial.handle}</p>
      <p className="mt-1 text-white/85">{testimonial.text}</p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const SignInPage: React.FC<SignInPageProps> = ({
  title = (
    <span className="font-light text-gray-900 tracking-tighter">
      Bem-vindo
    </span>
  ),
  description = "Acesse sua conta e gerencie seus clientes com inteligência",
  heroImageSrc,
  testimonials = [],
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row w-full">
      {/* Left — form */}
      <section className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-600 shadow-md">
              <span className="text-white font-bold text-lg leading-none">D</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight">Dua CRM</p>
              <p className="text-xs text-gray-400">Para marcas de moda</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-gray-900">
                {title}
              </h1>
              <p className="mt-2 text-gray-500">{description}</p>
            </div>

            <form className="space-y-4" onSubmit={onSignIn}>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  E-mail
                </label>
                <GlassInputWrapper>
                  <input
                    name="email"
                    type="email"
                    placeholder="seu@email.com.br"
                    required
                    className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-gray-900 placeholder:text-gray-400"
                  />
                </GlassInputWrapper>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Senha
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha"
                      required
                      className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-gray-900 placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      ) : (
                        <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-gray-600">Manter conectado</span>
                </label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onResetPassword?.();
                  }}
                  className="text-brand-600 hover:text-brand-700 hover:underline transition-colors font-medium"
                >
                  Esqueci a senha
                </a>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-600 py-4 font-semibold text-white hover:bg-brand-700 active:bg-brand-800 transition-colors shadow-sm"
              >
                Entrar
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <span className="w-full border-t border-gray-200" />
              <span className="px-4 text-sm text-gray-400 bg-white absolute">
                ou continue com
              </span>
            </div>

            <button
              onClick={onGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-2xl py-3.5 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <GoogleIcon />
              Continuar com Google
            </button>

            <p className="text-center text-sm text-gray-500">
              Novo por aqui?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onCreateAccount?.();
                }}
                className="text-brand-600 hover:underline font-medium"
              >
                Criar conta
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Right — hero */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div
            className="absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          >
            {/* Overlay */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

            {/* Brand tag */}
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-2">
              <div className="w-6 h-6 rounded-lg bg-brand-500 flex items-center justify-center">
                <span className="text-white font-bold text-xs">D</span>
              </div>
              <span className="text-white text-sm font-semibold">Dua CRM</span>
            </div>

            {/* Testimonials */}
            {testimonials.length > 0 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 px-6 w-full justify-center">
                <TestimonialCard
                  testimonial={testimonials[0]}
                  delay=""
                />
                {testimonials[1] && (
                  <div className="hidden xl:flex">
                    <TestimonialCard
                      testimonial={testimonials[1]}
                      delay=""
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default SignInPage;
