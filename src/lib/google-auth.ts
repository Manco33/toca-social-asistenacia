'use server';

let doc: any = null;

// Load and authenticate the GoogleSpreadsheet doc on the server only.
export async function getAuthenticatedDoc() {
    if (doc) return doc;

    // Dynamic import to avoid bundling Node-only modules into the client build
    const [{ GoogleSpreadsheet }, { JWT }] = await Promise.all([
        await import('google-spreadsheet'),
        await import('google-auth-library'),
    ]);

    const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error('La variable de entorno NEXT_PUBLIC_GOOGLE_SHEET_ID no está configurada.');

    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (!privateKey || !clientEmail) throw new Error('Credenciales de Service Account no configuradas.');

    const serviceAccountAuth = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const tempDoc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    try {
        await tempDoc.loadInfo();
    } catch (err: any) {
        console.error('Error loading spreadsheet info:', err?.message || err);
        // Provide a clearer error message for common causes
        if (err && err.response && err.response.status === 404) {
            throw new Error('Spreadsheet not found (404). Verifica que NEXT_PUBLIC_GOOGLE_SHEET_ID es correcto y que la hoja existe.');
        }
        if (err && err.response && (err.response.status === 403 || err.response.status === 401)) {
            throw new Error('Acceso denegado al spreadsheet. Asegúrate de compartir la hoja con la cuenta de servicio y que las credenciales sean válidas.');
        }
        throw new Error('Error al cargar la hoja de cálculo: ' + (err?.message || String(err)));
    }
    // assign the fully-loaded doc to the cached variable to avoid returning a partially-initialized doc
    doc = tempDoc;
    return doc;
}

export async function getSheetByTitle(title: string) {
    const document = await getAuthenticatedDoc();
    const sheet = document.sheetsByTitle[title];
    if (!sheet) throw new Error(`Hoja "${title}" no encontrada.`);
    // Ensure header row is loaded for later access
    try {
        await sheet.loadHeaderRow();
    } catch (e) {
        // some sheets might not have header row set, but addRow will still work
    }
    return sheet;
}

/**
 * Tries to get a sheet by trying multiple possible titles.
 * Throws an error if no sheet is found.
 * @param primaryTitle The preferred title.
 * @param fallbackTitles An array of alternative titles to try.
 */
export async function getSheetByTitleOrThrow(primaryTitle: string, fallbackTitles: string[] = []) {
    'use server';
    const document = await getAuthenticatedDoc();
    const titlesToTry = [primaryTitle, ...fallbackTitles];

    for (const title of titlesToTry) {
        const sheet = document.sheetsByTitle[title];
        if (sheet) {
            try {
                await sheet.loadHeaderRow();
            } catch (e) { /* ignore if no header */ }
            return sheet;
        }
    }
    throw new Error(`No se encontró la hoja. Se intentó con: ${titlesToTry.join(', ')}.`);
}
