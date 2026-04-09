"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignInPage, Testimonial } from "@/components/ui/sign-in";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const testimonials: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Camila Ferreira",
    handle: "@camilamodas",
    text: "Minha taxa de conversão dobrou em 3 semanas. O bot de qualificação é incrível.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/68.jpg",
    name: "Juliana Rocha",
    handle: "@julianastyle",
    text: "Finalmente um CRM que entende o ritmo de uma marca de moda. Simples e poderoso.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)?.value;

    try {
      const { data } = await axios.post(`${API_URL}/api/v1/auth/login`, { email, password });
      localStorage.setItem("access_token", data.accessToken);
      localStorage.setItem("refresh_token", data.refreshToken);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.message || "E-mail ou senha incorretos.");
    }
  };

  return (
    <div className="relative">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 px-6 py-3 rounded-2xl shadow-lg text-sm font-medium">
          {error}
        </div>
      )}
      <SignInPage
        title={
          <>
            Bem-vindo de{" "}
            <span className="text-brand-600">volta</span>
          </>
        }
        description="Acesse sua conta e acompanhe suas marcas em tempo real."
        heroImageSrc="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80"
        testimonials={testimonials}
        onSignIn={handleSignIn}
        onGoogleSignIn={() => alert("Em breve!")}
        onResetPassword={() => alert("Enviaremos um link para seu e-mail.")}
        onCreateAccount={undefined}
      />
    </div>
  );
}
