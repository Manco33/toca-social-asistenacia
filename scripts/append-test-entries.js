require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');

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
      'Fecha y Hora': now.toISOString(),
      'Tipo de Actividad': 'Hora de salida',
      'coordenadas': '12.3456, -65.4321',
      'horas trabajadas': '8:30',
      'horas extras': '0:30',
      'proyecto': 'Prueba Proyecto',
      'historial horas de actividades': `${now.toISOString()} - Hora de salida - Prueba Proyecto`,
      'historial coordenadas gps': '12.3456, -65.4321'
    };

    const entry2 = {
      usuario: 'test-user',
      'Fecha y Hora': new Date(now.getTime() + 1000).toISOString(),
      'Tipo de Actividad': 'Jornada Finalizada',
      'coordenadas': '12.3456, -65.4321',
      'horas trabajadas': '8:30',
      'horas extras': '0:30',
      'proyecto': 'Prueba Proyecto',
      'historial horas de actividades': `${new Date(now.getTime() + 1000).toISOString()} - Jornada Finalizada`,
      'historial coordenadas gps': '12.3456, -65.4321'
    };

    await sheet.addRow(entry1);
    console.log('Entry1 added');
    await sheet.addRow(entry2);
    console.log('Entry2 added');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();