require('dotenv').config({ path: '.env.local' });

(async () => {
  try {
    const [{ GoogleSpreadsheet }, { JWT }] = await Promise.all([
      import('google-spreadsheet'),
      import('google-auth-library'),
    ]);

    const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error('NEXT_PUBLIC_GOOGLE_SHEET_ID is not set');

    const privateKey = process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (!privateKey || !clientEmail) throw new Error('Service account credentials are missing in environment variables');

    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();

    console.log('Spreadsheet title:', doc.title);
    console.log('Available sheets:', Object.keys(doc.sheetsByTitle));
  } catch (err) {
    console.error('ERROR:', err && err.message ? err.message : err);
    if (err && err.response) {
      console.error('HTTP status:', err.response.status);
      try { console.error('Response data:', JSON.stringify(err.response.data)); } catch(e) { /* ignore */ }
    }
    process.exitCode = 1;
  }
})();