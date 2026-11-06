import React from "react";
import Image from "next/image";

interface BocoBrandProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showSubtitle?: boolean;
  subtitle?: string;
  variant?: "light" | "dark" | "default";
}

export function BocoLogo({
  className = "",
  size = "md",
  showSubtitle = false,
  subtitle = "Gestión de Asistencia & Operaciones",
  variant = "default",
}: BocoBrandProps) {
  const dimensions = {
    sm: { height: 26, width: 90 },
    md: { height: 36, width: 125 },
    lg: { height: 48, width: 165 },
    xl: { height: 64, width: 220 },
  };

  const { height, width } = dimensions[size] || dimensions.md;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex items-center">
        {/* Usamos el logo oficial BOCO */}
        <Image
          src="/boco-logo.png"
          alt="BOCO"
          width={width}
          height={height}
          priority
          className="object-contain select-none transition-transform hover:scale-[1.02]"
        />
      </div>
      {showSubtitle && (
        <div className="hidden sm:block border-l border-slate-300/60 dark:border-slate-700 pl-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Isotipo circular oficial vectorizado de 4 colores BOCO
 * (Naranja, Azul, Menta y Azul Oscuro)
 */
export function BocoIsotype({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
    >
      {/* Segmento Superior Izquierdo: Naranja / Ámbar #F5A623 */}
      <path
        d="M 28 32 A 38 38 0 0 1 70 20"
        stroke="#F5A623"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* Segmento Superior Derecho: Azul Eléctrico #3874FF */}
      <path
        d="M 80 30 A 38 38 0 0 1 83 70"
        stroke="#3874FF"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* Segmento Inferior: Verde Menta / Jade #48D597 */}
      <path
        d="M 72 82 A 38 38 0 0 1 30 82"
        stroke="#48D597"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* Segmento Izquierdo Inferior: Navy Profundo #1E2238 */}
      <path
        d="M 20 70 A 38 38 0 0 1 20 44"
        stroke="#1E2238"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* Conectores / puntos circulares característicos */}
      <circle cx="76" cy="24" r="5" fill="#3874FF" />
      <circle cx="83" cy="76" r="4.5" fill="#48D597" />
      <circle cx="24" cy="80" r="5" fill="#1E2238" />
      <circle cx="21" cy="36" r="5" fill="#F5A623" />
    </svg>
  );
}

