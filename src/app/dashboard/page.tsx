"use client";

import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { normalizeRole } from "@/lib/types";
import { BocoSuperAdminDashboard } from "@/components/boco-superadmin-dashboard";
import { BocoRrhhDashboard } from "@/components/boco-rrhh-dashboard";
import { BocoAsignadorDashboard } from "@/components/boco-asignador-dashboard";
import { BocoColaboradorDashboard } from "@/components/boco-colaborador-dashboard";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-2" />
        <span className="text-sm text-slate-500">Cargando panel BOCO...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const role = normalizeRole(user.rol);

  switch (role) {
    case "superadmin":
      return <BocoSuperAdminDashboard />;
    case "rrhh":
      return <BocoRrhhDashboard />;
    case "asignador":
      return <BocoAsignadorDashboard />;
    case "colaborador":
    default:
      return <BocoColaboradorDashboard />;
  }
}
