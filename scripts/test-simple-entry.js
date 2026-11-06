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
    const entry1 = {
      usuario: 'test-user',
      'hora de marcaje': format(now, 'HH:mm:ss'),
      'coordenadas': '12.3456, -65.4321',
      'Proyecto': 'Prueba Proyecto'
    };

    await sheet.addRow(entry1);
    console.log('Entry added');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();