"use client";

import { useRouter } from "next/navigation";
import { SignInPage, Testimonial } from "@/components/ui/sign-in";

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

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: conectar com API /auth/login
    // Por ora redireciona direto pro dashboard
    router.push("/dashboard");
  };

  return (
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
      onCreateAccount={() => router.push("/cadastro")}
    />
  );
}
