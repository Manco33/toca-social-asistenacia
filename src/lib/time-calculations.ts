import { differenceInMinutes } from 'date-fns';

export interface TimeStats {
    totalWorkedMinutes: number; // productive + office
    projectMinutes: number;
    officeMinutes: number;
    lunchMinutes: number;
    idleMinutes: number; // Transit or unassigned time
    overtimeMinutes: number; // approved extras
    projectBreakdown: Record<string, number>; // Project Name -> Minutes
    projectsById: Record<string, number>; // Project ID -> Minutes
}

export function calculateTimeStats(logs: any[], extras: any[]): TimeStats {
    // 1. Sort logs
    const sortedLogs = [...logs].sort((a, b) => {
        const dateA = new Date(a.created_at || `${a.fecha}T${a.hora_marcaje}`);
        const dateB = new Date(b.created_at || `${b.fecha}T${b.hora_marcaje}`);
        return dateA.getTime() - dateB.getTime();
    });

    let projectMinutes = 0;
    let officeMinutes = 0;
    let lunchMinutes = 0;
    let overtimeMinutes = 0;
    let totalIntervalMinutes = 0;

    const projectBreakdown: Record<string, number> = {};
    const projectsById: Record<string, number> = {};

    // 2. Iterate Intervals
    for (let i = 0; i < sortedLogs.length - 1; i++) {
        const a = sortedLogs[i];
        const b = sortedLogs[i + 1];

        const type = (a.tipo_actividad || '').toLowerCase();

        // Parse Dates
        // We assume logs have full context or we construct it. 
        // If running solely on {fecha, hora_marcaje}, constructing the date is safe.
        const start = new Date(a.created_at || `${a.fecha}T${a.hora_marcaje}`);
        const end = new Date(b.created_at || `${b.fecha}T${b.hora_marcaje}`);

        const diff = differenceInMinutes(end, start);

        // Sanity checks
        if (diff <= 0) continue;
        if (diff > 12 * 60) continue; // Skip huge jumps (e.g. forgot to clock out overnight)

        totalIntervalMinutes += diff;

        // Classification
        if (type.includes('iniciar almuerzo')) {
            lunchMinutes += diff;
        } else if (
            type.includes('llegada a oficina') ||
            type.includes('inicio en oficina') ||
            (type.includes('terminar almuerzo') && !a.proyecto) // Resume to Office
        ) {
            officeMinutes += diff;
        } else if (
            type.includes('llegada a proyecto') ||
            type.includes('inicio en proyecto') ||
            (type.includes('terminar almuerzo') && a.proyecto) // Resume to Project
        ) {
            // Active Project Time
            projectMinutes += diff;

            // Attribution
            const pName = String(a.proyecto || '').trim();
            const pId = a.proyecto_id ? String(a.proyecto_id) : null;

            if (pName) {
                const key = pName.toLowerCase();
                projectBreakdown[key] = (projectBreakdown[key] || 0) + diff;
            }
            if (pId) {
                projectsById[pId] = (projectsById[pId] || 0) + diff;
            }
        } else {
            // Transit or Idle (Salida de..., etc)
            // Logic: everything else is Idle/Transit
        }
    }

    // 3. Add Overtime (Extras)
    // Extras are separated now.
    extras.forEach(ex => {
        let mins = 0;
        if (ex.hora_inicio && ex.hora_fin) {
            const [h1, m1] = String(ex.hora_inicio).split(':').map(Number);
            const [h2, m2] = String(ex.hora_fin).split(':').map(Number);
            const startMins = h1 * 60 + m1;
            const endMins = h2 * 60 + m2;
            let diff = endMins - startMins;
            if (diff < 0) diff += 24 * 60;
            mins = diff;
        } else {
            mins = Math.round(Number(ex.horas || 0) * 60);
        }

        if (mins > 0) {
            overtimeMinutes += mins;
            // distinct from projectMinutes (GPS)
        }
    });

    const totalWorkedMinutes = projectMinutes + officeMinutes;
    // idleMinutes: The remaining time in intervals that wasn't worked or lunch.
    // Note: totalIntervalMinutes includes everything logged via GPS/intervals.
    // Extras are usually "outside" GPS intervals or overlapping?
    // User requested "Mobilization" (idle) = Travel time.
    const idleMinutes = Math.max(0, totalIntervalMinutes - totalWorkedMinutes - lunchMinutes);

    return {
        totalWorkedMinutes,
        projectMinutes,
        officeMinutes,
        lunchMinutes,
        idleMinutes,
        overtimeMinutes,
        projectBreakdown,
        projectsById
    };
}
