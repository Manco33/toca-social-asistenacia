const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function check(user) {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || 'M3g4Gr3n1nj41!', database: process.env.DB_NAME || 'tiempo_Aktiva' });
  const [rows] = await conn.query('SELECT * FROM empleados WHERE usuario = ? LIMIT 1', [user]);
  if (!rows || rows.length === 0) {
    console.log(`${user}: not found`);
    await conn.end();
    return;
  }
  const r = rows[0];
  console.log(`${user}: row=`, { id: r.id, nombre: r.nombre, usuario: r.usuario, rol: r.rol, contrasena: r.contrasena });
  const plain = user === 'admin' ? 'adminpass' : (user === 'tech' ? 'techpass' : '');
  const cmp = r.contrasena === plain;
  console.log(`${user}: compare with '${plain}' => ${cmp}`);

  await conn.end();
}

(async () => {
  await check('admin');
  await check('tech');
})().catch(e => { console.error(e); process.exit(1); });
