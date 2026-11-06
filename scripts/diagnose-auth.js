#!/usr/bin/env node

/**
 * Script de diagnóstico para validar credenciales de usuarios
 * Uso: node scripts/diagnose-auth.js
 */

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Variables de entorno faltantes');
  console.error('   Configura: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

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

async function diagnoseAuth() {
  console.log('🔍 Diagnóstico de Autenticación\n');

  try {
    // 1. Validar hash de contraseña
    console.log('1️⃣  VALIDANDO HASH DE CONTRASEÑA\n');
    
    const testPassword = 'admin123';
    const storedHash = '$2a$10$YIjlrJy5Ck9r8Z5mK3p9e.9K8L7M6N5O4P3Q2R1S0T9U8V7W6X5Y4Z3';
    
    console.log(`   Contraseña a probar: "${testPassword}"`);
    console.log(`   Hash almacenado: ${storedHash}\n`);
    
    try {
      const matches = bcrypt.compareSync(testPassword, storedHash);
      if (matches) {
        console.log('   ✅ Hash coincide con contraseña "admin123"\n');
      } else {
        console.log('   ❌ Hash NO coincide con contraseña "admin123"\n');
      }
    } catch (err) {
      console.log(`   ❌ Error al validar hash: ${err.message}\n`);
    }

    // 2. Validar que empleados tienen contraseña
    console.log('2️⃣  VALIDANDO EMPLEADOS EN BASE DE DATOS\n');
    
    const { data: empleados, error } = await supabase
      .from('empleados')
      .select('id, usuario, nombre, rol, contrasena, supabase_id')
      .order('id', { ascending: true });
    
    if (error) {
      console.log(`   ❌ Error al consultar empleados: ${error.message}\n`);
    } else {
      console.log(`   ✅ Empleados encontrados: ${empleados?.length || 0}\n`);
      
      if (empleados && empleados.length > 0) {
        empleados.forEach((emp, idx) => {
          console.log(`   ${idx + 1}. ${emp.usuario} (${emp.nombre})`);
          console.log(`      ID: ${emp.id}`);
          console.log(`      Rol: ${emp.rol}`);
          console.log(`      Contraseña: ${emp.contrasena ? '✅ Presente' : '❌ FALTA'}`);
          
          if (emp.contrasena) {
            const isHashedFormat = emp.contrasena.startsWith('$2a$') || 
                                  emp.contrasena.startsWith('$2b$') || 
                                  emp.contrasena.startsWith('$2y$');
            console.log(`      Hash válido: ${isHashedFormat ? '✅ Sí' : '❌ No'}`);
            
            // Verificar si coincide con el hash conocido
            if (emp.contrasena === storedHash) {
              console.log(`      Coincide con hash de "admin123": ✅ Sí`);
            } else {
              console.log(`      Coincide con hash de "admin123": ❌ No`);
            }
          }
          
          console.log(`      supabase_id: ${emp.supabase_id || '❌ NULL'}`);
          console.log('');
        });
      }
    }

    // 3. Validar usuarios en Supabase Auth
    console.log('3️⃣  VALIDANDO USUARIOS EN SUPABASE AUTH\n');
    
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log(`   ❌ Error: ${authError.message}\n`);
    } else {
      console.log(`   ✅ Usuarios en Supabase Auth: ${users?.length || 0}\n`);
      
      if (users && users.length > 0) {
        const targetEmails = ['admin@aktivacorp.com', 'rrhh@aktivacorp.com', 'tecnico@aktivacorp.com'];
        
        users.forEach((user) => {
          const isTarget = targetEmails.includes(user.email);
          console.log(`   ${isTarget ? '✅' : '⚪'} ${user.email}`);
          console.log(`      ID: ${user.id}`);
          console.log(`      Status: ${user.user_metadata?.email_verified ? '✅ Verificado' : '⚠️  No verificado'}`);
          console.log('');
        });
      }
    }

    // 4. Validar tabla users
    console.log('4️⃣  VALIDANDO TABLA USERS (roles)\n');
    
    const { data: users_table, error: usersError } = await supabase
      .from('users')
      .select('id, supabase_id, email, role, status')
      .order('created_at', { ascending: true });
    
    if (usersError) {
      console.log(`   ❌ Error: ${usersError.message}\n`);
    } else {
      console.log(`   ✅ Usuarios en tabla 'users': ${users_table?.length || 0}\n`);
      
      if (users_table && users_table.length > 0) {
        users_table.forEach((user) => {
          console.log(`   📧 ${user.email}`);
          console.log(`      UUID: ${user.supabase_id}`);
          console.log(`      Role: ${user.role}`);
          console.log(`      Status: ${user.status}`);
          console.log('');
        });
      }
    }

    // 5. Validar vinculación empleados <-> users
    console.log('5️⃣  VALIDANDO VINCULACIÓN (empleados.supabase_id <-> users.supabase_id)\n');
    
    const { data: joined, error: joinError } = await supabase
      .from('empleados')
      .select(`
        user_id:id,
        usuario,
        nombre,
        supabase_id,
        users:supabase_id (email, role, status)
      `)
      .order('id', { ascending: true });
    
    if (joinError) {
      console.log(`   ❌ Error al hacer JOIN: ${joinError.message}\n`);
    } else {
      console.log(`   ✅ Vinculaciones encontradas:\n`);
      
      if (joined && joined.length > 0) {
        joined.forEach((emp) => {
          const hasAuth = emp.users && emp.users.length > 0;
          console.log(`   ${hasAuth ? '✅' : '❌'} ${emp.usuario}`);
          console.log(`      Usuario en empleados: ${emp.usuario}`);
          console.log(`      Nombre: ${emp.nombre}`);
          
          if (hasAuth) {
            console.log(`      Email en Auth: ${emp.users[0].email}`);
            console.log(`      Rol en Auth: ${emp.users[0].role}`);
            console.log(`      Status: ${emp.users[0].status}`);
          } else {
            console.log(`      ⚠️  SIN VINCULACIÓN A SUPABASE AUTH`);
          }
          console.log('');
        });
      }
    }

    // 6. Recomendaciones
    console.log('6️⃣  RECOMENDACIONES\n');
    console.log('   Contraseña de prueba para todos los usuarios: admin123\n');
    console.log('   ⚠️  Pasos si el login NO funciona:');
    console.log('   1. Verifica que el hash está correcto en empleados');
    console.log('   2. Excepto los credenciales sean: usuario="admin", password="admin123"');
    console.log('   3. Si empleados.supabase_id es NULL, ejecuta:');
    console.log('      scripts/migrate-link-empleados-users.sql\n');
    console.log('   📚 Scripts de ayuda:');
    console.log('   - Regenerar contraseñas: node scripts/reset-passwords.js');
    console.log('   - Ver tabla empleados: SELECT * FROM empleados;');
    console.log('   - Ver tabla users: SELECT * FROM users;');
    console.log('   - Ver tabla auth.users: SELECT * FROM auth.users;');

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

diagnoseAuth();
