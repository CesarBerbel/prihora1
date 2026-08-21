import type { Metadata } from "next";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { SessionProvider } from "@/lib/auth";

import "./globals.css";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "prihora";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} - marque profissionais de estética perto de si`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Encontre manicures, podologos, tatuadores, esteticistas e mais. " +
    "Veja perfis, preços e a agenda em tempo real. Agende em poucos cliques.",
  keywords: [
    "manicure", "pedicure", "podologia", "tatuagem", "sobrancelhas",
    "estética", "marcação online", "profissionais liberais",
  ],
  openGraph: {
    title: `${SITE_NAME} - profissionais de estética perto de si`,
    description: "Busque, compare e marque com profissionais da estética na sua região.",
    type: "website",
    locale: "pt_PT",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="flex min-h-screen flex-col">
        <SessionProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
