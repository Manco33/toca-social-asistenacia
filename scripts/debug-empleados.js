#!/usr/bin/env node
/**
 * Debug script para inspeccionar la estructura de la tabla empleados
 * Ejecutar: node scripts/debug-empleados.js
 */

const { createClient } = require('@supabase/supabase-js');

async function debugEmpleados() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
    console.log('Asegúrate de que .env.local tiene estas variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('\n🔍 DEBUGGER: Inspeccionando tabla "empleados"...\n');

  // Listar estructura de la tabla
  console.log('📋 ESTRUCTURA DE DATOS:');
  const { data: sample, error: sampleError } = await supabase
    .from('empleados')
    .select('*')
    .limit(1);

  if (sample && sample.length > 0) {
    console.log('\nColumnas y tipos:');
    const cols = sample[0];
    Object.entries(cols).forEach(([key, value]) => {
      console.log(`  - ${key}: ${typeof value} = ${JSON.stringify(value)}`);
    });
  } else {
    console.error('No se pudo obtener datos de ejemplo');
  }

  // Contar empleados
  console.log('\n\n📊 ESTADÍSTICAS:');
  const { count, error: countError } = await supabase
    .from('empleados')
    .select('*', { count: 'exact', head: true });

  console.log(`Total de empleados: ${count}`);

  // Listar algunos empleados
  console.log('\n\n👥 PRIMEROS 10 EMPLEADOS:');
  const { data: employees, error: empError } = await supabase
    .from('empleados')
    .select('id, usuario, nombre, rol, horas_estandar, tiempo_almuerzo')
    .limit(10);

  if (employees) {
    employees.forEach((emp, idx) => {
      console.log(`${idx + 1}. ID=${emp.id} (${typeof emp.id}) | usuario=${emp.usuario} | nombre=${emp.nombre}`);
    });
  }

  // Revisar registro_horas
  console.log('\n\n⏰ ÚLTIMAS ENTRADAS EN "registro_horas":');
  const { data: hours, error: hoursError } = await supabase
    .from('registro_horas')
    .select('*')
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
    .limit(5);

  if (hours) {
    hours.forEach((h, idx) => {
      console.log(`${idx + 1}. ${h.fecha} | usuario=${h.usuario} | trabajadas=${h.horas_trabajadas} | extras=${h.horas_extras}`);
    });
  } else if (hoursError) {
    console.log('(Tabla vacía o error)');
  }

  console.log('\n✅ Debug completado\n');
}

debugEmpleados().catch(console.error);
