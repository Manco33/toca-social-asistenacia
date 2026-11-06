const mysql = require('mysql2/promise');

async function check(user, password) {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || 'M3g4Gr3n1nj41!', database: process.env.DB_NAME || 'tiempo_Aktiva' });
  const [rows] = await conn.query('SELECT * FROM empleados WHERE usuario = ? LIMIT 1', [user]);
  if (!rows || rows.length === 0) {
    console.log(`${user}: not found`);
    await conn.end();
    return;
  }
  const r = rows[0];
  console.log(`${user}: row=`, { id: r.id, nombre: r.nombre, usuario: r.usuario, rol: r.rol, contrasena: r.contrasena });
  const cmp = r.contrasena === password || r.contrasena === (password || '').trim();
  console.log(`${user}: compare with '${password}' => ${cmp}`);
  await conn.end();
}

(async () => {
  const user = process.argv[2];
  const pass = process.argv[3];
  if (!user || !pass) {
    console.error('Usage: node scripts/check-user.js <usuario> <password>');
    process.exit(2);
  }
  await check(user, pass);
})().catch(e => { console.error(e); process.exit(1); });
