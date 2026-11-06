"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, MapPin, Shield, Calendar, Users, Globe2 } from "lucide-react";
import { BocoLogo } from "@/components/boco-brand";
import { obtenerTema } from "@/lib/brands";

export function BocoHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const tema = obtenerTema(user?.sede?.marca?.slug);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const badgeBase =
    "bg-brand-dark hover:bg-brand-dark-hover text-white font-bold text-[10px] tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1";

  const getRoleBadge = (rol?: string) => {
    switch (rol) {
      case "superadmin":
        return (
          <Badge className={badgeBase}>
            <Globe2 className="h-3 w-3 text-brand-accent" />
            SUPER ADMIN
          </Badge>
        );
      case "rrhh":
        return (
          <Badge className={badgeBase}>
            <Shield className="h-3 w-3 text-brand-accent" />
            RECURSOS HUMANOS
          </Badge>
        );
      case "asignador":
        return (
          <Badge className={badgeBase}>
            <Calendar className="h-3 w-3 text-brand-accent" />
            ASIGNADOR / LÍDER
          </Badge>
        );
      default:
        return (
          <Badge className={badgeBase}>
            <Users className="h-3 w-3 text-brand-accent" />
            COLABORADOR
          </Badge>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-sm">
      {/* Franja de color de la marca */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-primary via-brand-accent to-brand-dark" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* LOGO DE LA MARCA + BOCO MARCAJE */}
        <div className="flex items-center gap-3 min-w-0">
          {tema.logo && (
            <>
              <div
                className="flex items-center justify-center rounded-xl px-2 h-10 shrink-0 border border-slate-200/70"
                style={{ backgroundColor: tema.logoFondo }}
              >
                <Image
                  src={tema.logo}
                  alt={tema.nombre}
                  width={tema.logoAncho}
                  height={32}
                  className="object-contain max-h-8 w-auto"
                  priority
                />
              </div>
              <div className="h-7 w-px bg-slate-200" />
            </>
          )}
          <BocoLogo size="sm" showSubtitle subtitle={tema.slug === "boco" ? "Control de Asistencia" : "Marcaje"} />
          <div className="hidden sm:block">{getRoleBadge(user?.rol)}</div>
        </div>

        {/* DETALLES DE USUARIO Y LOGOUT */}
        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-900 flex items-center justify-end gap-1">
                <User className="h-3.5 w-3.5 text-slate-400" />
                {user.nombre_completo}
              </span>
              <div className="flex items-center justify-end gap-2 text-[11px] text-slate-500">
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                  {user.codigo_rrhh}
                </span>
                {user.sede && (
                  <span className="flex items-center gap-0.5 text-brand-primary font-medium">
                    <MapPin className="h-3 w-3 text-brand-primary" />
                    {user.sede.nombre}
                  </span>
                )}
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs gap-1.5 border border-slate-200"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
