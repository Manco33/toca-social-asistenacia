#!/usr/bin/env node

/**
 * Script para generar hashes bcrypt válidos para las contraseñas de prueba
 * Uso: node scripts/generate-password-hashes.js
 */

const bcrypt = require('bcryptjs');

const credentials = [
  {
    usuario: 'admin',
    password: 'Admin123456!',
    email: 'admin@aktivacorp.com',
  },
  {
    usuario: 'rrhh',
    password: 'RRHH123456!',
    email: 'rrhh@aktivacorp.com',
  },
  {
    usuario: 'tecnico',
    password: 'Tecnico123456!',
    email: 'tecnico@aktivacorp.com',
  },
];

console.log('🔐 Generando hashes bcrypt para contraseñas\n');
console.log('═'.repeat(80));

const sqlLines = ['BEGIN;', ''];

credentials.forEach((cred) => {
  const hash = bcrypt.hashSync(cred.password, 10);

  console.log(`\n📝 Usuario: ${cred.usuario}`);
  console.log(`   Email: ${cred.email}`);
  console.log(`   Contraseña: ${cred.password}`);
  console.log(`   Hash bcrypt: ${hash}`);

  // Verificar que el hash funciona
  const matches = bcrypt.compareSync(cred.password, hash);
  console.log(`   Verificación: ${matches ? '✅ OK' : '❌ FAIL'}`);

  // Generar SQL
  const sqlLine = `UPDATE empleados SET contrasena = '${hash}' WHERE usuario = '${cred.usuario}';`;
  sqlLines.push(sqlLine);
});

sqlLines.push('', 'COMMIT;');

console.log('\n' + '═'.repeat(80));
console.log('\n📋 SCRIPT SQL A EJECUTAR EN SUPABASE:\n');
console.log(sqlLines.join('\n'));

console.log('\n' + '═'.repeat(80));
console.log('\n✅ CREDENCIALES DE PRUEBA:\n');

credentials.forEach((cred) => {
  console.log(`Usuario: ${cred.usuario}`);
  console.log(`Email: ${cred.email}`);
  console.log(`Contraseña: ${cred.password}`);
  console.log('');
});

console.log('═'.repeat(80));
