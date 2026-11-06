// Genera importar_empleados_planilla.sql a partir de la hoja de cálculo de RRHH.
// Uso:  node scripts/generar-sql-planilla.mjs "<ruta al .xlsx>"
import XLSX from 'xlsx';
import fs from 'node:fs';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Indica la ruta del .xlsx');
  process.exit(1);
}

// Encabezado de la hoja -> código de sede (debe coincidir con migracion_multimarca.sql)
const SEDES = [
  { match: /majadas/i, codigo: 'SZM' },
  { match: /cayal/i, codigo: 'SZC' },
  { match: /tiffany/i, codigo: 'SZT' },
  { match: /bounce/i, codigo: 'BCY' },
  { match: /fun zone|epic/i, codigo: 'EPZ' }, // "FUN ZONE CAES" = Epic Zone CAES
  { match: /toca/i, codigo: 'TCS' },
];

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const titulo = (s) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && PARTICULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

function limpiarNombre(raw) {
  return titulo(
    String(raw)
      .replace(/[-*]+$/g, '') // "LÓPEZ-*"
      .replace(/\*/g, '')
      .replace(/,/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// "Monitor 3" -> "Monitor", "Host -Bienvenida- 2" -> "Host Bienvenida"
function normalizarPuesto(raw) {
  let p = String(raw).replace(/-/g, ' ').replace(/\s+\d+\s*$/, '').replace(/\s+/g, ' ').trim();
  return p;
}

function departamento(puesto) {
  const p = puesto.toLowerCase();
  if (/vendedor/.test(p)) return 'Ventas';
  if (/gerente|líder|lider/.test(p)) return 'Gerencia y Operación';
  if (/cajero/.test(p)) return 'Caja';
  if (/host/.test(p)) return 'Recepción y Anfitriones';
  if (/monitor|amenidades/.test(p)) return 'Monitores y Atracciones';
  if (/cocina/.test(p)) return 'Cocina';
  if (/cleaning|limpieza/.test(p)) return 'Limpieza';
  return 'Operaciones';
}

const esc = (s) => String(s).replace(/'/g, "''");

const wb = XLSX.readFile(ruta);
const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

let sedeActual = null;
const contadores = {};
const empleados = [];
const puestos = new Map();

for (const [a, b] of filas) {
  const col1 = String(a).trim();
  const col2 = String(b).trim();
  if (!col1) continue;

  if (!col2) {
    // Fila de encabezado de sede
    const s = SEDES.find((x) => x.match.test(col1));
    if (!s) throw new Error(`Sede no reconocida en la hoja: "${col1}"`);
    sedeActual = s.codigo;
    continue;
  }

  if (!sedeActual) throw new Error(`Empleado sin sede: ${col1}`);
  contadores[sedeActual] = (contadores[sedeActual] || 0) + 1;
  const codigo = `${sedeActual}-${String(contadores[sedeActual]).padStart(3, '0')}`;
  const puesto = normalizarPuesto(col2);
  puestos.set(puesto, departamento(puesto));
  empleados.push({
    sede: sedeActual,
    codigo,
    username: codigo.toLowerCase(),
    nombre: limpiarNombre(col1),
    puesto,
  });
}

const lineas = [];
lineas.push(`-- ==============================================================================`);
lineas.push(`-- BOCO MARCAJE: IMPORTACIÓN DE COLABORADORES DESDE LA PLANILLA DE RRHH`);
lineas.push(`-- Generado automáticamente: ${empleados.length} colaboradores, ${puestos.size} puestos.`);
lineas.push(`-- Requiere haber ejecutado antes: migracion_multimarca.sql`);
lineas.push(`--`);
lineas.push(`-- * ID RRHH provisional  = <SEDE>-<NNN>  (ej. SZM-001). El Super Admin puede`);
lineas.push(`--   reemplazarlo por el ID real de nómina desde el panel (pestaña Colaboradores).`);
lineas.push(`-- * Usuario de acceso    = ID en minúsculas (ej. szm-001). También pueden entrar con su ID RRHH.`);
lineas.push(`-- * Contraseña inicial   = Boco2026#   (cada quien la cambia en "Mi Clave")`);
lineas.push(`-- * Quedan SIN asignador y SIN correo; se asignan después desde el panel.`);
lineas.push(`-- * Es idempotente: si se vuelve a ejecutar, no duplica usuarios.`);
lineas.push(`-- ==============================================================================`);
lineas.push('');
lineas.push(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
lineas.push('');
lineas.push(`-- 1. PUESTOS`);
lineas.push(`INSERT INTO departamentos_puestos (nombre, departamento, descripcion) VALUES`);
lineas.push(
  [...puestos.entries()]
    .map(([n, d]) => `  ('${esc(n)}', '${esc(d)}', 'Puesto importado de la planilla de RRHH')`)
    .join(',\n')
);
lineas.push(`ON CONFLICT (nombre) DO NOTHING;`);
lineas.push('');
lineas.push(`-- 2. COLABORADORES`);
lineas.push(`INSERT INTO usuarios (username, codigo_rrhh, nombre_completo, password_hash, rol, puesto_id, sede_id, activo)`);
lineas.push(
  `SELECT v.username, v.codigo, v.nombre, crypt('Boco2026#', gen_salt('bf', 10)), 'colaborador', p.id, s.id, true`
);
lineas.push(`FROM (VALUES`);
lineas.push(
  empleados
    .map((e) => `  ('${e.sede}', '${e.codigo}', '${e.username}', '${esc(e.nombre)}', '${esc(e.puesto)}')`)
    .join(',\n')
);
lineas.push(`) AS v(sede_codigo, codigo, username, nombre, puesto)`);
lineas.push(`JOIN sedes_zonas s ON s.codigo = v.sede_codigo`);
lineas.push(`JOIN departamentos_puestos p ON p.nombre = v.puesto`);
lineas.push(`ON CONFLICT (username) DO NOTHING;`);
lineas.push('');
lineas.push(`-- 3. VERIFICACIÓN: colaboradores por sede (debe sumar ${empleados.length} + los que ya existían)`);
lineas.push(
  `-- SELECT s.nombre, count(*) FROM usuarios u JOIN sedes_zonas s ON s.id = u.sede_id WHERE u.rol = 'colaborador' GROUP BY s.nombre ORDER BY s.nombre;`
);
lineas.push('');

fs.writeFileSync('importar_empleados_planilla.sql', lineas.join('\n'), 'utf8');
console.log('OK', empleados.length, 'colaboradores;', puestos.size, 'puestos');
console.log(contadores);
console.log([...puestos.keys()].join(' | '));

