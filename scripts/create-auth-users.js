#!/usr/bin/env node

/**
 * Script para crear 3 usuarios de prueba en Supabase Auth
 * Uso: node scripts/create-auth-users.js
 * 
 * Requiere:
 * - SUPABASE_URL en variables de entorno
 * - SUPABASE_SERVICE_ROLE_KEY en variables de entorno
 */

const { createClient } = require('@supabase/supabase-js');

// Validar variables de entorno
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Variables de entorno faltantes');
  console.error('   Configura: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Crear cliente admin de Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Datos de los 3 usuarios a crear
const usuarios = [
  {
    email: 'admin@aktivacorp.com',
    password: 'Admin123456!',
    nombre: 'Administrador Sistema',
    rol: 'administrator',
  },
  {
    email: 'rrhh@aktivacorp.com',
    password: 'RRHH123456!',
    nombre: 'Recursos Humanos',
    rol: 'rrhh',
  },
  {
    email: 'tecnico@aktivacorp.com',
    password: 'Tecnico123456!',
    nombre: 'Juan Técnico Prueba',
    rol: 'technician',
  },
];

async function crearUsuarios() {
  console.log('🚀 Creando usuarios en Supabase Auth...\n');

  const usuariosCreados = [];

  for (const usuario of usuarios) {
    try {
      console.log(`📧 Creando: ${usuario.email}`);

      // Crear usuario en auth.users
      const { data, error } = await supabase.auth.admin.createUser({
        email: usuario.email,
        password: usuario.password,
        email_confirm: true, // Marca como verificado automáticamente
      });

      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
        continue;
      }

      if (data?.user) {
        console.log(`   ✅ Usuario creado (UUID: ${data.user.id})`);
        usuariosCreados.push({
          supabase_id: data.user.id,
          email: usuario.email,
          nombre: usuario.nombre,
          rol: usuario.rol,
        });
      }
    } catch (err) {
      console.error(`   ❌ Error inesperado: ${err.message}`);
    }
  }

  if (usuariosCreados.length === 0) {
    console.error('\n❌ No se crearon usuarios');
    process.exit(1);
  }

  // Mostrar los UUIDs para el siguiente paso
  console.log('\n✅ Usuarios creados exitosamente!\n');
  console.log('📋 Ahora ejecuta el siguiente script en Supabase SQL Editor:');
  console.log('   Archivo: scripts/migrate-create-test-users.sql\n');
  console.log('🔄 O usa estos UUIDs para actualizar manualmente:\n');

  for (const user of usuariosCreados) {
    console.log(`${user.email}: ${user.supabase_id}`);
  }

  console.log('\n💾 Guardando UUIDs en archivo...');

  // Guardar UUIDs en un archivo para referencia
  const fs = require('fs');
  const uuidContent = usuariosCreados
    .map((u) => `${u.email}=${u.supabase_id}`)
    .join('\n');

  fs.writeFileSync('scripts/.auth-uuids.txt', uuidContent);
  console.log('   ✅ UUIDs guardados en scripts/.auth-uuids.txt\n');
}

// Ejecutar
crearUsuarios().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
