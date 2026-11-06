"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { aplicarTemaMarca, CLAVE_MARCA_KIOSCO, esMarcaSlug } from "@/lib/brands";

/**
 * Aplica la identidad visual de la marca a toda la app:
 *  - Usuario con sesión: la marca de su sede.
 *  - Sin sesión (pantalla de login en tablet): la marca recordada del kiosco.
 *  - Super Admin / sin sede: tema BOCO.
 */
export function BrandThemeSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const slugUsuario = user?.sede?.marca?.slug;
    if (user) {
      aplicarTemaMarca(slugUsuario);
      // La tablet recuerda su marca para la siguiente pantalla de login
      try {
        if (esMarcaSlug(slugUsuario)) localStorage.setItem(CLAVE_MARCA_KIOSCO, slugUsuario);
      } catch {}
      return;
    }
    let slugKiosco: string | null = null;
    try {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("m");
      if (esMarcaSlug(param)) {
        localStorage.setItem(CLAVE_MARCA_KIOSCO, param);
        slugKiosco = param;
      } else {
        slugKiosco = localStorage.getItem(CLAVE_MARCA_KIOSCO);
      }
    } catch {}
    aplicarTemaMarca(slugKiosco);
  }, [user, loading]);

  return null;
}

