const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setPassword(usuario, plain) {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || 'M3g4Gr3n1nj41!', database: process.env.DB_NAME || 'tiempo_Aktiva' });
  const value = plain; // store as plain text for testing

  // Try to update existing user
  const [res] = await conn.query('UPDATE empleados SET contrasena = ? WHERE usuario = ?', [value, usuario]);
  if (res && res.affectedRows === 0) {
    // Insert new user with default role tecnico and empty nombre
    await conn.query('INSERT INTO empleados (nombre, rol, usuario, contrasena) VALUES (?, ?, ?, ?)', ['Auto-created', 'tecnico', usuario, value]);
    console.log(`Created user ${usuario}`);
  } else {
    console.log(`Updated password for ${usuario}`);
  }

  await conn.end();
}

if (require.main === module) {
  const [,, usuario, plain] = process.argv;
  if (!usuario || !plain) {
    console.error('Usage: node scripts/set-password.js <usuario> <password>');
    process.exit(1);
  }
  setPassword(usuario, plain).catch(e => { console.error(e); process.exit(1); });
}
