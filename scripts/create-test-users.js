/**
 * Script para crear 3 usuarios de prueba en Supabase y tabla users
 * 
 * Uso:
 * node scripts/create-test-users.js
 * 
 * IMPORTANTE: Asegúrate de tener en .env.local:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testUsers = [
  {
    email: 'admin@aktivacorp.com',
    password: 'Admin123456!',
    fullName: 'Administrador Sistema',
    role: 'administrator',
  },
  {
    email: 'rrhh@aktivacorp.com',
    password: 'RRHH123456!',
    fullName: 'Recursos Humanos',
    role: 'rrhh',
  },
  {
    email: 'tecnico@aktivacorp.com',
    password: 'Tecnico123456!',
    fullName: 'Juan Técnico Prueba',
    role: 'technician',
  },
];

async function createTestUsers() {
  console.log('🚀 Iniciando creación de usuarios de prueba...\n');

  for (const testUser of testUsers) {
    try {
      console.log(`📝 Creando usuario: ${testUser.email}`);

      // 1. Crear en Supabase Auth
      const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true, // Marcar como confirmado
      });

      if (authError) {
        console.error(`   ❌ Error en Auth: ${authError.message}`);
        continue;
      }

      console.log(`   ✅ Usuario creado en Auth: ${user.id}`);

      // 2. Crear en tabla users
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .insert([
          {
            supabase_id: user.id,
            email: testUser.email,
            full_name: testUser.fullName,
            role: testUser.role,
            status: 'active',
          },
        ])
        .select()
        .single();

      if (dbError) {
        console.error(`   ❌ Error en BD: ${dbError.message}`);
        // Limpiar usuario de auth si falla la BD
        await supabase.auth.admin.deleteUser(user.id);
        continue;
      }

      console.log(`   ✅ Usuario creado en BD con rol: ${testUser.role}`);
      console.log(`   📧 Email: ${testUser.email}`);
      console.log(`   🔑 Contraseña: ${testUser.password}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Error inesperado: ${error.message}\n`);
    }
  }

  console.log('✅ Proceso completado!\n');
  console.log('📋 Credenciales de prueba:');
  console.log('─'.repeat(50));
  testUsers.forEach((user) => {
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${user.password}`);
    console.log(`Rol: ${user.role}`);
    console.log('');
  });

  process.exit(0);
}

createTestUsers().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
