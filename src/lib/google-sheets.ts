// This file is deprecated. Its contents have been moved to src/app/actions.ts as Server Actions.
// The original file is kept for reference but is no longer used by the application to prevent
// server-side modules from being bundled in the client.
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Project, User, Geolocation, TimeEntryType } from './types';
import { format } from 'date-fns';

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID as string, serviceAccountAuth);


async function getSheet(title: string) {
  await doc.loadInfo();
  return doc.sheetsByTitle[title];
}

export async function getProjects(): Promise<Project[]> {
  const sheet = await getSheet('proyectos');
  if (!sheet) {
      throw new Error('Project sheet not found');
  }
  const rows = await sheet.getRows();
  return rows.map((row, index) => ({
    id: `proj-${index + 1}`,
    name: row.get('proyectos') || '',
    address: row.get('Ubicacion del proyecto') || '',
    contactPerson: row.get('Soluciones') || '', // Assuming 'Soluciones' is the contact person
        assignedTo: [],
  }));
}

export async function getEmployees(): Promise<(User & { password?: string })[]> {
  const sheet = await getSheet('Empleados');
  if (!sheet) {
      throw new Error('Employees sheet not found');
  }
  const rows = await sheet.getRows();
  return rows.map((row, index) => ({
    id: row.get('user') || `user-${index + 1}`,
    name: row.get('nombre') || '',
    email: row.get('user') || '',
    role: (row.get('rol') || 'technician').toLowerCase(),
    password: row.get('contraseña') || '',
    avatarUrl: `https://picsum.photos/seed/${110 + index}/100/100`, // Placeholder avatar
  }));
}

export async function getTodaysEntries() {
    const sheet = await getSheet('horarios y gps');
    if (!sheet) {
        throw new Error('horarios y gps sheet not found');
    }
    const rows = await sheet.getRows();
    const today = format(new Date(), 'yyyy-MM-dd');
    return rows.filter(row => row.get('fecha') && format(new Date(row.get('fecha')), 'yyyy-MM-dd') === today)
               .map(row => row.toObject());
}

export async function saveTimeEntry(
    userId: string,
    activity: TimeEntryType,
    location: Geolocation | null,
    projectName: string | null = null
): Promise<void> {
    const sheet = await getSheet('horarios y gps');
    if (!sheet) {
        throw new Error('horarios y gps sheet not found');
    }
    const now = new Date();
    const row = {
        usuario: userId,
        'historial horas de actividades': `${now.toISOString()} - ${activity}${projectName ? ` - ${projectName}` : ''}`,
        'historial coordenadas gps': location ? `${location.latitude}, ${location.longitude}` : 'N/A',
        fecha: format(now, 'yyyy-MM-dd'),
    };
    await sheet.addRow(row);
}

export async function saveFinalHours(
    userId: string,
    totalHours: string,
    overtimeHours: string
): Promise<void> {
    const sheet = await getSheet('horarios y gps');
    if (!sheet) {
        throw new Error('horarios y gps sheet not found');
    }
    const now = new Date();
    const row = {
        usuario: userId,
        fecha: format(now, 'yyyy-MM-dd'),
        'horas trabajadas': totalHours,
        'horas extras': overtimeHours,
        'historial horas de actividades': `${now.toISOString()} - Jornada Finalizada`,
    };
    await sheet.addRow(row);
}

interface ActivityLog {
    userId: string;
    action: string;
    timestamp: Date;
    // ...other properties...
}

const saveActivityLog = (logData: ActivityLog) => {
    // Logic to save user activity logs to the 'horarios y gps' sheet
};
