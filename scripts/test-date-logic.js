const now = new Date();
console.log('Original (UTC implied via ISO):', now.toISOString());

// Mimic the logic in actions.ts
const guateOffset = -6 * 60 * 60 * 1000;
const guateTime = new Date(now.getTime() + guateOffset);

const nowDate = guateTime.toISOString().split('T')[0];
const nowTime = guateTime.toISOString().split('T')[1].split('.')[0];

console.log('Guate Shifted ISO:', guateTime.toISOString());
console.log('Extracted Date:', nowDate);
console.log('Extracted Time:', nowTime);

// Verify parsing logic from getTechnicianTodaysEntries
function guatemalaLocalToUtc(fecha, hora) {
    const [y, m, d] = String(fecha || '').split('-').map(Number);
    const [hh = 0, mm = 0, ss = 0] = String(hora || '00:00:00').split(':').map(Number);
    // Construct UTC timestamp by adding 6 hours to local time
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1, (hh || 0) + 6, mm || 0, ss || 0));
}

const reconstructed = guatemalaLocalToUtc(nowDate, nowTime);
console.log('Reconstructed UTC from stored parts:', reconstructed.toISOString());
