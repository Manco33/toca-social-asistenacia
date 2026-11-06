const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function generate() {
    // Install sharp if not present
    try {
        require.resolve('sharp');
    } catch (e) {
        console.log('Installing sharp...');
        execSync('npm install --no-save sharp', { stdio: 'inherit' });
    }

    const sharp = require('sharp');
    const publicDir = path.join(__dirname, '../public');

    // SVG strings for icons
    const iconSvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="100" fill="#1e3a5f"/>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="200" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">AM</text>
    </svg>
  `;

    const maskableSvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#1e3a5f"/>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="200" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">AM</text>
    </svg>
  `;

    const checkinSvg = `
    <svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
      <rect width="192" height="192" rx="40" fill="#1e3a5f"/>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="#10b981" text-anchor="middle" dominant-baseline="middle">ENT</text>
    </svg>
  `;

    const checkoutSvg = `
    <svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
      <rect width="192" height="192" rx="40" fill="#1e3a5f"/>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="#ef4444" text-anchor="middle" dominant-baseline="middle">SAL</text>
    </svg>
  `;

    const mobileScreenshotSvg = `
    <svg width="540" height="720" viewBox="0 0 540 720" xmlns="http://www.w3.org/2000/svg">
      <rect width="540" height="720" fill="#f8fafc"/>
      <rect width="540" height="80" fill="#1e3a5f"/>
      <text x="50%" y="45" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">Aktiva Marcaje</text>
      <rect x="40" y="120" width="460" height="100" rx="10" fill="#ffffff" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"/>
      <text x="270" y="170" font-family="Arial, sans-serif" font-size="24" fill="#333" text-anchor="middle" dominant-baseline="middle">Panel de Control</text>
    </svg>
  `;

    const desktopScreenshotSvg = `
    <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
      <rect width="1280" height="720" fill="#f8fafc"/>
      <rect x="0" y="0" width="250" height="720" fill="#1e3a5f"/>
      <text x="125" y="50" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">Aktiva</text>
      <rect x="290" y="40" width="950" height="640" rx="10" fill="#ffffff" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"/>
      <text x="765" y="100" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#333" text-anchor="middle" dominant-baseline="middle">Dashboard Principal</text>
    </svg>
  `;

    const tasks = [
        { svg: iconSvg, path: 'icon-512x512.png', size: 512 },
        { svg: iconSvg, path: 'icon-192x192.png', size: 192 },
        { svg: maskableSvg, path: 'icon-maskable-512x512.png', size: 512 },
        { svg: maskableSvg, path: 'icon-maskable-192x192.png', size: 192 },
        { svg: checkinSvg, path: 'icon-checkin-192x192.png', size: 192 },
        { svg: checkoutSvg, path: 'icon-checkout-192x192.png', size: 192 },
        { svg: mobileScreenshotSvg, path: 'screenshot-540x720.png', width: 540, height: 720 },
        { svg: desktopScreenshotSvg, path: 'screenshot-1280x720.png', width: 1280, height: 720 },
    ];

    console.log('Generating PWA assets...');

    for (const task of tasks) {
        const outPath = path.join(publicDir, task.path);
        if (!fs.existsSync(outPath)) {
            await sharp(Buffer.from(task.svg))
                .png()
                .toFile(outPath);
            console.log('Created:', task.path);
        } else {
            console.log('Exists:', task.path);
        }
    }
    console.log('Done!');
}

generate().catch(console.error);
