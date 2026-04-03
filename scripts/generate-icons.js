// Generate PWA icons as simple PNG files
// Uses raw PNG creation without external dependencies

const fs = require('fs');
const path = require('path');

function createPNG(size) {
  // Create a simple PNG with green background and "FT" text
  // Using minimal PNG format

  const { createCanvas } = (() => {
    try {
      return require('canvas');
    } catch {
      return { createCanvas: null };
    }
  })();

  if (createCanvas) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Green circle background
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
    ctx.fill();

    // White text "FT"
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FT', size/2, size/2);

    return canvas.toBuffer('image/png');
  }

  return null;
}

// Try canvas approach first, fall back to SVG-based approach
const icon192 = createPNG(192);
const icon512 = createPNG(512);

if (icon192 && icon512) {
  fs.writeFileSync(path.join(__dirname, '../public/icons/icon-192.png'), icon192);
  fs.writeFileSync(path.join(__dirname, '../public/icons/icon-512.png'), icon512);
  console.log('Icons generated with canvas');
} else {
  console.log('canvas not available, creating SVG icons instead');

  // Create SVG files that will work as icons
  const createSVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#15803d"/>
  <text x="${size/2}" y="${size/2}" font-family="Arial,sans-serif" font-weight="bold" font-size="${size*0.4}" fill="white" text-anchor="middle" dominant-baseline="central">FT</text>
</svg>`;

  fs.writeFileSync(path.join(__dirname, '../public/icons/icon-192.svg'), createSVG(192));
  fs.writeFileSync(path.join(__dirname, '../public/icons/icon-512.svg'), createSVG(512));
  console.log('SVG icons created - convert to PNG for best compatibility');
}
