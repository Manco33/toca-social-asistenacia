"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { normalizeRole, type Role } from "@/lib/types";
import { Loader2 } from "lucide-react";

/** Solo muestra a sus hijos si el usuario tiene uno de los roles permitidos; si no, lo manda a su panel. */
export function RoleGuard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const rol = user ? normalizeRole(user.rol) : null;
  const permitido = !!rol && roles.includes(rol);

  useEffect(() => {
    if (!loading && user && !permitido) router.replace("/dashboard");
  }, [loading, user, permitido, router]);

  if (loading || !user || !permitido) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-7 w-7 animate-spin text-brand-primary" />
      </div>
    );
  }
  return <>{children}</>;
}

