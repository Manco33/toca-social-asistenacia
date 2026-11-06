require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('SCAN THIS QR CODE WITH WHATSAPP:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    console.log('Scheduler initialized (Timezone: America/Guatemala):');
    console.log(`Server Time: ${new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' })}`);
    console.log('- 06:30 AM: Check Late Arrivals');
    console.log('- 08:30 PM: Check Forgotten Checkouts');
});
                                                                                                                                                                                                                                                 
client.on('authenticated', () => {
    console.log('Authenticated successfully');
});

client.initialize();

// --- LOGIC ---

// Helper to format phone number for WhatsApp (502xxxxxxxx@c.us)
function formatPhoneNumber(rawNumber) {
    if (!rawNumber) return null;
    let num = rawNumber.replace(/\D/g, '');
    if (num.length === 8) num = '502' + num;
    return `${num}@c.us`;
}

// Helper: Check if today is weekend
function isWeekend() {
    const day = new Date().getDay();
    return day === 0 || day === 6; // 0=Sun, 6=Sat
}

// 1. Check Late Arrivals (Dynamic based on assigned time)
// checksTime: '06:30', '07:00', '07:30', '08:00'
async function checkLateArrivals(checkTimeStr) {
    if (isWeekend()) return;
    console.log(`[Job] Checking Late Arrivals for ${checkTimeStr}...`);
    const today = new Date().toISOString().split('T')[0];

    try {
        // Get technicians with specific entry time
        const { data: employees, error: empError } = await supabase
            .from('empleados')
            .select('id, nombre, usuario, numero_celular, horario_entrada')
            .eq('rol', 'tecnico');

        if (empError) throw empError;

        // Filter employees who match this check time (defaulting null to 06:30)
        const targetEmployees = employees.filter(e => {
            const entry = (e.horario_entrada || '06:30').slice(0, 5); // Ensure HH:MM
            return entry === checkTimeStr;
        });

        if (targetEmployees.length === 0) return;

        // Get today's logs
        const { data: logs, error: logError } = await supabase
            .from('horarios_gps')
            .select('usuario')
            .eq('fecha', today);

        if (logError) throw logError;

        const clockedInUsers = new Set(logs.map(l => l.usuario));

        for (const emp of targetEmployees) {
            if (clockedInUsers.has(emp.usuario)) continue;

            const chatId = formatPhoneNumber(emp.numero_celular);
            if (!chatId) {
                console.log(`User ${emp.usuario} missing phone. Skipping.`);
                continue;
            }

            const message = `👋 Hola ${emp.nombre || emp.usuario}, son las ${checkTimeStr} y tienes configurada tu entrada a esta hora. No hemos registrado tu marcaje. ¡Por favor marca en la app!`;

            try {
                await client.sendMessage(chatId, message);
                console.log(`Sent entry reminder to ${emp.usuario} (${checkTimeStr})`);
            } catch (msgErr) {
                console.error(`Failed to send to ${emp.usuario}:`, msgErr.message);
            }
        }
    } catch (err) {
        console.error('Error in checkLateArrivals:', err);
    }
}

// Helper: Fetch Weather from wttr.in (text format)
async function getWeatherReport() {
    try {
        const response = await fetch('https://wttr.in/Guatemala_City?format=%C+%t');
        if (!response.ok) return "Clima: No disponible";
        const text = await response.text();
        return `Clima: ${text.trim()}`;
    } catch (e) {
        console.error('Error fetching weather:', e);
        return "Clima: No disponible por el momento";
    }
}

// Helper: Get Traffic Link REMOVED as per request


// 2. 11:00 AM Report + Reminder
async function sendMidMorningReport() {
    if (isWeekend()) return;
    console.log('[Job] Sending 11:00 AM Report...');

    // Fetch real data
    const weather = await getWeatherReport();
    // Traffic info removed

    const reportMsg = `🌤️ *Reporte del día*:\n${weather}\n\n👋 Hola, esperamos que estés teniendo un excelente día.`;
    const reminderMsg = "Recuerda realizar tus marcajes en la app para mantener tu reporte al día. ¡Ánimo!";

    try {
        const { data: employees } = await supabase
            .from('empleados')
            .select('usuario, numero_celular, nombre')
            .eq('rol', 'tecnico');

        for (const emp of employees || []) {
            const chatId = formatPhoneNumber(emp.numero_celular);
            if (!chatId) continue;

            try {
                await client.sendMessage(chatId, `${reportMsg}\n\n${reminderMsg}`);
                console.log(`Sent 11am report to ${emp.usuario}`);
            } catch (e) {
                console.error(`Error sending 11am to ${emp.usuario}:`, e.message);
            }
        }
    } catch (err) {
        console.error('Error in sendMidMorningReport:', err);
    }
}

// 3. Lunch Reminder (Dynamic)
// Run periodically or at specific times? User said "12:00 pm or assigned". 
// We will run this every 30 mins from 11:30 to 14:30 and check if current time matches their lunch time.
async function checkLunchTime() {
    if (isWeekend()) return;
    const now = new Date();
    const currentHM = now.toTimeString().slice(0, 5); // HH:MM
    console.log(`[Job] Checking Lunch Time at ${currentHM}...`);

    try {
        const { data: employees } = await supabase
            .from('empleados')
            .select('usuario, numero_celular, nombre, horario_almuerzo')
            .eq('rol', 'tecnico');

        for (const emp of employees || []) {
            const lunchTime = (emp.horario_almuerzo || '12:00').slice(0, 5);
            // Relaxed match: if within last 29 mins? Or exact? 
            // Since cron runs every 30 mins, we check if lunchTime is within this window [now-30, now].
            // Simpler: Just check if lunchTime == currentHM (assuming cron aligned with :00 and :30)

            if (lunchTime === currentHM) {
                const chatId = formatPhoneNumber(emp.numero_celular);
                if (!chatId) continue;

                const msg = `🍽️ Hola ${emp.nombre}, es hora de tu almuerzo (${lunchTime}). ¡Buen provecho! Recuerda marcar tu salida a comer.`;
                await client.sendMessage(chatId, msg);
                console.log(`Sent lunch reminder to ${emp.usuario}`);
            }
        }
    } catch (err) {
        console.error('Error in checkLunchTime:', err);
    }
}

// 4. 3:00 PM Reminder
async function sendAfternoonReminder() {
    if (isWeekend()) return;
    console.log('[Job] Sending 3:00 PM Reminder...');

    const weather = await getWeatherReport();
    // Traffic removed

    try {
        const { data: employees } = await supabase.from('empleados').select('numero_celular').eq('rol', 'tecnico');
        for (const emp of employees || []) {
            const chatId = formatPhoneNumber(emp.numero_celular);
            if (chatId) {
                const msg = `🕒 Son las 3:00 PM.\n${weather}\n\n👋 Pasamos a desearte una buena tarde. Por favor verifica si tienes marcajes pendientes. ¡Sigue así!`;
                await client.sendMessage(chatId, msg);
            }
        }
    } catch (err) { console.error(err); }
}

// 5. Exit Reminder (Dynamic + Friday Logic)
async function checkExitTime() {
    if (isWeekend()) return;
    const now = new Date();
    const currentHM = now.toTimeString().slice(0, 5);
    const dayOfWeek = now.getDay(); // 1=Mon, 5=Fri
    const isFriday = dayOfWeek === 5;

    console.log(`[Job] Checking Exit Time at ${currentHM} (Friday=${isFriday})...`);

    try {
        const { data: employees } = await supabase
            .from('empleados')
            .select('usuario, numero_celular, nombre, horario_salida')
            .eq('rol', 'tecnico');

        for (const emp of employees || []) {
            let exitTime = (emp.horario_salida || '16:30').slice(0, 5);

            // Adjust for Friday (-1 hour)
            if (isFriday) {
                const [h, m] = exitTime.split(':').map(Number);
                const newH = h - 1;
                exitTime = `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }

            if (exitTime === currentHM) {
                const chatId = formatPhoneNumber(emp.numero_celular);
                if (!chatId) continue;

                const msg = `🎉 Felicidades ${emp.nombre}, has completado tu jornada. Recuerda hacer tus marcajes de salida. ¡Buen descanso!`;
                await client.sendMessage(chatId, msg);
                console.log(`Sent exit msg to ${emp.usuario} (Target: ${exitTime})`);
            }
        }
    } catch (err) {
        console.error('Error in checkExitTime:', err);
    }
}


// --- SCHEDULES ---

const cronOptions = {
    scheduled: true,
    timezone: "America/Guatemala"
};

// Entry Checks (6:30, 7:00, 7:30, 8:00)
cron.schedule('30 6 * * *', () => checkLateArrivals('06:30'), cronOptions);
cron.schedule('0 7 * * *', () => checkLateArrivals('07:00'), cronOptions);
cron.schedule('30 7 * * *', () => checkLateArrivals('07:30'), cronOptions);
cron.schedule('0 8 * * *', () => checkLateArrivals('08:00'), cronOptions);

// 11:00 AM Report
cron.schedule('0 11 * * *', () => sendMidMorningReport(), cronOptions);

// Lunch Check (Every 30 mins from 11:30 to 14:30)
cron.schedule('*/30 11-14 * * *', () => checkLunchTime(), cronOptions);

// 3:00 PM Reminder
cron.schedule('0 15 * * *', () => sendAfternoonReminder(), cronOptions);

// Exit Check (Every 30 mins from 15:00 to 19:00 to cover various shifts)
cron.schedule('*/30 15-19 * * *', () => checkExitTime(), cronOptions);


// Testing Flags
const args = process.argv.slice(2);
if (args.includes('--test-now')) {
    // Run all logic assuming "now" is a specific time? 
    // Just run one by one immediately for current real time
    setTimeout(() => {
        console.log('--- RUNNING IMMEDIATE TESTS ---');
        // We can't easily force the "time" inside the functions without refactoring.
        // We will just run them and they will check against current system time.
        // To test specific logic, we'd need to mock time.
        // For now, running 11am report as it's time-independent mostly.
        sendMidMorningReport();
        sendAfternoonReminder();
    }, 5000);
}
// Force specific checks (ignoring current time constraints would require refactoring,
// but we can add special 'force' flags to functions if needed.
// For this MVP, we rely on the logic reading system time.)

