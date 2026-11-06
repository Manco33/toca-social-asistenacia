// ==============================================================================
// IDENTIDAD VISUAL POR MARCA - BOCO MARCAJE
// Los colores se expresan como canales RGB ("r g b") para que Tailwind pueda
// aplicar opacidad (bg-brand-primary/20) a partir de variables CSS.
// ==============================================================================

export type MarcaSlug = 'boco' | 'sky_zone' | 'toca_social' | 'bounce_city' | 'epic_zone';

export interface TemaMarca {
  slug: MarcaSlug;
  nombre: string;
  /** Logo en /public. `null` = usar el logo BOCO por defecto */
  logo: string | null;
  /** Fondo del contenedor del logo para que siempre se lea (el logo de Epic Zone es blanco) */
  logoFondo: string;
  logoAncho: number;
  /** Canales RGB */
  dark: string;
  darkHover: string;
  primary: string;
  primaryHover: string;
  accent: string;
  accentHover: string;
  /** Color hex para <meta theme-color> y degradados */
  hexDark: string;
  hexPrimary: string;
  eslogan: string;
}

export const MARCAS: Record<MarcaSlug, TemaMarca> = {
  boco: {
    slug: 'boco',
    nombre: 'BOCO',
    logo: null,
    logoFondo: '#FFFFFF',
    logoAncho: 110,
    dark: '30 34 56',
    darkHover: '44 50 82',
    primary: '56 116 255',
    primaryHover: '47 101 246',
    accent: '72 213 151',
    accentHover: '56 194 133',
    hexDark: '#1E2238',
    hexPrimary: '#3874FF',
    eslogan: 'Control de Asistencia & Aprendizaje',
  },
  sky_zone: {
    slug: 'sky_zone',
    nombre: 'Sky Zone',
    logo: '/marcas/sky-zone.png',
    logoFondo: '#FFFFFF',
    logoAncho: 112,
    dark: '23 24 28',
    darkHover: '42 43 50',
    primary: '255 82 0',
    primaryHover: '222 70 0',
    accent: '255 160 102',
    accentHover: '255 138 61',
    hexDark: '#17181C',
    hexPrimary: '#FF5200',
    eslogan: 'Equipo Sky Zone',
  },
  toca_social: {
    slug: 'toca_social',
    nombre: 'Toca Social',
    logo: '/marcas/toca-social.svg',
    logoFondo: '#FFFFFF',
    logoAncho: 104,
    dark: '27 23 50',
    darkHover: '45 40 78',
    primary: '123 92 250',
    primaryHover: '104 71 230',
    accent: '244 192 99',
    accentHover: '233 171 62',
    hexDark: '#1B1732',
    hexPrimary: '#7B5CFA',
    eslogan: 'Equipo Toca Social',
  },
  bounce_city: {
    slug: 'bounce_city',
    nombre: 'Bounce City',
    logo: '/marcas/bounce-city.jpg',
    logoFondo: '#14169E',
    logoAncho: 56,
    dark: '15 20 112',
    darkHover: '28 34 140',
    primary: '255 107 107',
    primaryHover: '240 82 82',
    accent: '30 214 192',
    accentHover: '16 190 169',
    hexDark: '#0F1470',
    hexPrimary: '#FF6B6B',
    eslogan: 'Equipo Bounce City',
  },
  epic_zone: {
    slug: 'epic_zone',
    nombre: 'Epic Zone',
    logo: '/marcas/epic-zone.png',
    logoFondo: '#1C1C1E',
    logoAncho: 64,
    dark: '28 28 30',
    darkHover: '52 52 56',
    primary: '255 136 0',
    primaryHover: '230 120 0',
    accent: '255 196 107',
    accentHover: '255 176 56',
    hexDark: '#1C1C1E',
    hexPrimary: '#FF8800',
    eslogan: 'Equipo Epic Zone',
  },
};

export const MARCAS_OPERATIVAS: MarcaSlug[] = ['sky_zone', 'toca_social', 'bounce_city', 'epic_zone'];

export function esMarcaSlug(valor: unknown): valor is MarcaSlug {
  return typeof valor === 'string' && valor in MARCAS;
}

export function obtenerTema(slug?: string | null): TemaMarca {
  return esMarcaSlug(slug) ? MARCAS[slug] : MARCAS.boco;
}

/** Aplica el tema como variables CSS en <html>. Seguro de llamar solo en el cliente. */
export function aplicarTemaMarca(slug?: string | null) {
  if (typeof document === 'undefined') return;
  const t = obtenerTema(slug);
  const root = document.documentElement;
  root.dataset.marca = t.slug;
  root.style.setProperty('--brand-dark', t.dark);
  root.style.setProperty('--brand-dark-hover', t.darkHover);
  root.style.setProperty('--brand-primary', t.primary);
  root.style.setProperty('--brand-primary-hover', t.primaryHover);
  root.style.setProperty('--brand-accent', t.accent);
  root.style.setProperty('--brand-accent-hover', t.accentHover);
}

export const CLAVE_MARCA_KIOSCO = 'boco_marca_kiosco';

