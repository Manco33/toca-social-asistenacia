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
      console.error('No se encontró la hoja de horarios (nombres probados: "horarios y gps", "Horarios y GPS", "horarios").');
      process.exit(1);
    }

    const now = new Date();
    
    // Simular llegada a proyecto
    const entry1 = {
      usuario: 'test-user',
      'Fecha': format(now, 'yyyy-MM-dd'),
      'hora de marcaje': format(now, 'HH:mm:ss'),
      'Tipo de Actividad': 'Llegada a proyecto',
      'coordenadas': '12.3456, -65.4321',
      'Proyecto': 'Proyecto Test A'
    };

    // Simular salida de proyecto (1 minuto después)
    const laterTime = new Date(now.getTime() + 60000);
    const entry2 = {
      usuario: 'test-user',
      'Fecha': format(laterTime, 'yyyy-MM-dd'),
      'hora de marcaje': format(laterTime, 'HH:mm:ss'),
      'Tipo de Actividad': 'Salida de proyecto',
      'coordenadas': '12.3457, -65.4322',
      'Proyecto': 'Proyecto Test A'
    };

    await sheet.addRow(entry1);
    console.log('Entry1 added - Llegada a proyecto');
    await sheet.addRow(entry2);
    console.log('Entry2 added - Salida de proyecto');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();