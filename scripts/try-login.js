const fetch = require('node-fetch');
(async ()=>{
  try {
    const res = await fetch('http://localhost:3000/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: process.argv[2] || 'aquelex', password: process.argv[3] || 'uhef78y34' }) });
    console.log('status', res.status);
    const t = await res.text();
    console.log('body', t);
  } catch (e) { console.error(e); process.exit(1); }
})();
