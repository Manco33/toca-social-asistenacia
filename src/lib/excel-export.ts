import * as XLSX from 'xlsx';
import type { MarcajeAsistencia, UsuarioBoco, BancoHorasCompensacion, LMSAvanceColaborador } from './types';

export interface ReporteFiltros {
  fechaInicio?: string;
  fechaFin?: string;
  puestoId?: string;
  sedeId?: string;
  usuarioId?: string;
}

/**
 * Genera y descarga un archivo Excel (.xlsx) profesional con pestañas organizadas
 * para Recursos Humanos de BOCO, priorizando el ID Único de RRHH en cada hoja.
 */
export function exportarReporteCompletoBoco(data: {
  colaboradores: UsuarioBoco[];
  marcajes: MarcajeAsistencia[];
  bancoHoras?: BancoHorasCompensacion[];
  avancesLMS?: (LMSAvanceColaborador & { usuario?: UsuarioBoco; tituloCurso?: string })[];
  nombreArchivo?: string;
}) {
  const wb = XLSX.utils.book_new();

  // 1. Hoja: RESUMEN DE ASISTENCIA Y HORAS (ID RRHH en columna A para cruces y VLOOKUP)
  const rowsResumen = data.marcajes.map((m) => {
    return {
      'ID Único RRHH': m.usuario?.codigo_rrhh || 'N/A',
      'Usuario': m.usuario?.username || 'N/A',
      'Nombre Colaborador': m.usuario?.nombre_completo || 'N/A',
      'Fecha': m.fecha,
      'Puesto': m.usuario?.puesto?.nombre || 'General',
      'Sede Asignada': m.usuario?.sede?.nombre || 'Sin Sede',
      'Hora Entrada': m.hora_entrada ? new Date(m.hora_entrada).toLocaleTimeString() : 'Sin marcar',
      'Tomó Almuerzo': m.tomo_almuerzo ? 'SÍ' : 'NO',
      'Inicio Almuerzo': m.hora_inicio_almuerzo ? new Date(m.hora_inicio_almuerzo).toLocaleTimeString() : '-',
      'Fin Almuerzo': m.hora_fin_almuerzo ? new Date(m.hora_fin_almuerzo).toLocaleTimeString() : '-',
      'Hora Salida': m.hora_salida ? new Date(m.hora_salida).toLocaleTimeString() : 'Sin marcar',
      'Horas Regulares': Number(m.horas_regulares || 0).toFixed(2),
      'Horas Extras': Number(m.horas_extras || 0).toFixed(2),
      'Total Horas': Number(m.horas_trabajadas_totales || 0).toFixed(2),
      'Dentro de Geocerca': m.en_rango_entrada && m.en_rango_salida ? 'VÁLIDO (EN SEDE)' : 'FUERA DE SEDE',
      'Estado': m.estado.toUpperCase(),
    };
  });

  const wsResumen = XLSX.utils.json_to_sheet(rowsResumen.length > 0 ? rowsResumen : [{ Nota: 'Sin registros para este periodo' }]);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Asistencias');

  // 2. Hoja: BANCO DE HORAS Y COMPENSACIONES FLEXIBLES
  if (data.bancoHoras && data.bancoHoras.length > 0) {
    const rowsBanco = data.bancoHoras.map((b) => ({
      'ID Único RRHH': b.usuario?.codigo_rrhh || 'N/A',
      'Usuario': b.usuario?.username || 'N/A',
      'Nombre Colaborador': b.usuario?.nombre_completo || 'N/A',
      'Semana': `${b.semana_inicio} al ${b.semana_fin}`,
      'Horas Meta Reglamentarias': Number(b.horas_meta || 40).toFixed(2),
      'Horas Trabajadas': Number(b.horas_trabajadas || 0).toFixed(2),
      'Balance Semanal (+ a favor / - debe)': Number(b.diferencia_horas || 0).toFixed(2),
      'Días Festivos Laborados (Por Compensar)': b.dias_festivos_laborados || 0,
      'Días Compensados Tomados': b.dias_compensados_tomados || 0,
      'Saldo Neto de Horas Acumuladas': Number(b.saldo_neto_horas || 0).toFixed(2),
      'Notas / Observaciones': b.notas || 'Sin notas',
    }));

    const wsBanco = XLSX.utils.json_to_sheet(rowsBanco);
    XLSX.utils.book_append_sheet(wb, wsBanco, 'Banco de Horas');
  }

  // 3. Hoja: CAPACITACIÓN Y CURSOS LMS (Segmentado por Puesto)
  if (data.avancesLMS && data.avancesLMS.length > 0) {
    const rowsLms = data.avancesLMS.map((l) => ({
      'ID Único RRHH': l.usuario?.codigo_rrhh || 'N/A',
      'Usuario': l.usuario?.username || 'N/A',
      'Nombre Colaborador': l.usuario?.nombre_completo || 'N/A',
      'Puesto': l.usuario?.puesto?.nombre || 'General',
      'Curso': l.tituloCurso || l.curso?.titulo || 'Capacitación BOCO',
      'Segundos de Lectura': l.segundos_lectura_reales || 0,
      'Tiempo de Lectura (Min)': (Number(l.segundos_lectura_reales || 0) / 60).toFixed(1),
      'Lectura de Seguridad': l.lectura_completada ? 'CUMPLIDA' : 'PENDIENTE',
      'Puntuación Obtenida': l.puntuacion_obtenida !== undefined ? Number(l.puntuacion_obtenida).toFixed(1) : 'Sin test',
      'Estatus': l.aprobado ? 'APROBADO' : 'PENDIENTE',
      'Fecha Aprobación': l.fecha_aprobacion ? new Date(l.fecha_aprobacion).toLocaleDateString() : '-',
    }));

    const wsLms = XLSX.utils.json_to_sheet(rowsLms);
    XLSX.utils.book_append_sheet(wb, wsLms, 'Capacitacion LMS');
  }

  // 4. Hoja: DIRECTORIO DE COLABORADORES BOCO
  const rowsColab = data.colaboradores.map((c) => ({
    'ID Único RRHH': c.codigo_rrhh || 'N/A',
    'Usuario (Login)': c.username || 'N/A',
    'Nombre Completo': c.nombre_completo,
    'Rol': c.rol.toUpperCase(),
    'Puesto': c.puesto?.nombre || 'Sin puesto asignado',
    'Sede': c.sede?.nombre || 'Sin sede asignada',
    'Email': c.email,
    'Teléfono WhatsApp': c.telefono || 'Sin teléfono',
    'Rostro Enrolado': c.facial_enrolled ? 'SÍ' : 'NO',
    'Estatus': c.activo ? 'ACTIVO' : 'INACTIVO',
  }));

  const wsColab = XLSX.utils.json_to_sheet(rowsColab.length > 0 ? rowsColab : [{ Nota: 'Sin colaboradores registrados' }]);
  XLSX.utils.book_append_sheet(wb, wsColab, 'Directorio Colaboradores');

  // Descarga del archivo
  const fechaStr = new Date().toISOString().slice(0, 10);
  const fileName = data.nombreArchivo || `Reporte_General_BOCO_${fechaStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
