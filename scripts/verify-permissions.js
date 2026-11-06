require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function checkPermissions() {
    try {
        // Create auth client
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        // Initialize the sheet
        const doc = new GoogleSpreadsheet(process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID, serviceAccountAuth);
        
        console.log('Attempting to access spreadsheet...');
        await doc.loadInfo();
        
        console.log('Successfully accessed the spreadsheet!');
        console.log(`Title: ${doc.title}`);
        console.log(`Sheet Count: ${doc.sheetCount}`);
        
        // Try to modify the spreadsheet to verify edit permissions
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        console.log('Headers:', sheet.headerValues);
        
    } catch (error) {
        console.error('Error accessing spreadsheet:', error.message);
        if (error.message.includes('404')) {
            console.error('The spreadsheet was not found. Please verify the ID and make sure the service account has access.');
        }
        if (error.message.includes('403')) {
            console.error('Permission denied. The service account needs editor access to the spreadsheet.');
        }
        process.exit(1);
    }
}

checkPermissions();