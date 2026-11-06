require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { format } = require('date-fns');

async function run() {
  try {
    const { JWT } = require('google-auth-library');
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const doc = new GoogleSpreadsheet(process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['horarios y gps'] || doc.sheetsByTitle['Horarios y GPS'] || doc.sheetsByTitle['horarios'];
    if (!sheet) {
      console.error('No se encontró la hoja de horarios.');
      process.exit(1);
    }

    const now = new Date();
    const fecha = format(now, 'yyyy-MM-dd');
    
    // 1. Llegada a oficina
    const entry1 = {
      usuario: 'test-flujo',
      'Fecha': fecha,
      'hora de marcaje': format(now, 'HH:mm:ss'),
      'Tipo de Actividad': 'Llegada a oficina',
      'coordenadas': '12.3456, -65.4321',
      'Proyecto': ''
    };

    // 2. Llegada a proyecto (30 minutos después)
    const timeProject = new Date(now.getTime() + 30 * 60000);
    const entry2 = {
      usuario: 'test-flujo',
      'Fecha': fecha,
      'hora de marcaje': format(timeProject, 'HH:mm:ss'),
      'Tipo de Actividad': 'Llegada a proyecto',
      'coordenadas': '12.3457, -65.4322',
      'Proyecto': 'Proyecto Test Flujo'
    };

    // 3. Jornada Finalizada (4 horas después)
    const timeEnd = new Date(timeProject.getTime() + 4 * 60 * 60000);
    const entry3 = {
      usuario: 'test-flujo',
      'Fecha': fecha,
      'hora de marcaje': format(timeEnd, 'HH:mm:ss'),
      'Tipo de Actividad': 'Jornada Finalizada',
      'coordenadas': '12.3458, -65.4323',
      'Proyecto': 'Proyecto Test Flujo'
    };

    console.log('Insertando registros de prueba...');
    
    await sheet.addRow(entry1);
    console.log('✅ Entrada 1 añadida - Llegada a oficina');
    
    await sheet.addRow(entry2);
    console.log('✅ Entrada 2 añadida - Llegada a proyecto');
    
    await sheet.addRow(entry3);
    console.log('✅ Entrada 3 añadida - Jornada Finalizada');

    // Verificar los últimos registros
    const rows = await sheet.getRows();
    const lastRows = rows.slice(-3).map(row => ({
      usuario: row.get('usuario'),
      fecha: row.get('Fecha'),
      hora: row.get('hora de marcaje'),
      tipo: row.get('Tipo de Actividad'),
      coordenadas: row.get('coordenadas'),
      proyecto: row.get('Proyecto')
    }));

    console.log('\nÚltimos 3 registros añadidos:');
    console.table(lastRows);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();