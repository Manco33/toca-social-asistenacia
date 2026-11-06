import type { Metadata } from "next";
import { AuthProvider } from "@/context/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { BrandThemeSync } from "@/components/brand-theme-sync";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "BOCO - Control de Asistencia, Horarios y Capacitación",
  description: "Plataforma integral de gestión de turnos, marcaje biométrico y aprendizaje para colaboradores de BOCO.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BOCO Marcaje",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased bg-slate-50 text-slate-900" suppressHydrationWarning>
        <ServiceWorkerRegister />
        <AuthProvider>
          <BrandThemeSync />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
