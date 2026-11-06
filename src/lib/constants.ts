import type { TimeEntryType } from './types';

export const TIME_ENTRY_SEQUENCE: readonly TimeEntryType[] = [
  'Llegada a oficina',
  'Salida de oficina',
  'Llegada a proyecto',
  'Iniciar Almuerzo',
  'Terminar Almuerzo',
  'Salida de proyecto',
  'Regreso a oficina',
  'Hora de salida',
] as const;

export const PROJECT_TIME_ENTRIES: readonly TimeEntryType[] = [
  'Llegada a proyecto',
  'Salida de proyecto',
]

export const STANDARD_WORK_HOURS = 9;
