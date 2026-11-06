import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

function createIcon(size, isMaskable = false) {
  const png = new PNG({ width: size, height: size });
  const center = size / 2;
  const radius = size * 0.42;

  // Colors:
  // Brand Forest Green #064E3B -> (6, 78, 59)
  // Emerald #0D766E -> (13, 118, 110)
  // Deep Blue #0284C7 -> (2, 132, 199)
  // Gold #F59E0B -> (245, 158, 11)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background gradient from top-left (0,0) to bottom-right (size,size)
      const gradT = (x + y) / (size * 2);
      let r = Math.round(6 + (2 - 6) * gradT);
      let g = Math.round(78 + (132 - 78) * gradT);
      let b = Math.round(59 + (199 - 59) * gradT);
      let a = 255;

      if (!isMaskable) {
        // Rounded corner for regular icon
        const cornerRadius = size * 0.22;
        const cornerDistX = Math.max(0, Math.abs(x - center) - (center - cornerRadius));
        const cornerDistY = Math.max(0, Math.abs(y - center) - (center - cornerRadius));
        const cornerDist = Math.sqrt(cornerDistX * cornerDistX + cornerDistY * cornerDistY);
        if (cornerDist > cornerRadius) {
          a = 0;
        }
      }

      // If within inner ring (badge)
      if (a > 0 && dist < radius) {
        // Inner circle with golden/teal border
        if (dist > radius - size * 0.035) {
          // Gold border
          r = 245;
          g = 158;
          b = 11;
        } else if (dist < size * 0.25) {
          // Center emblem circle (emerald highlight)
          if (dist > size * 0.25 - size * 0.02) {
            r = 52;
            g = 211;
            b = 153;
          } else {
            r = 4;
            g = 120;
            b = 87;
            // Draw a stylized checkmark
            // Center is (center, center)
            const ndx = (x - center) / size;
            const ndy = (y - center) / size;
            // checkmark legs: (-0.08, 0) to (-0.02, 0.06) to (0.09, -0.06)
            const dLine1 = Math.abs(ndy - (ndx + 0.08));
            const inL1 = ndx >= -0.08 && ndx <= -0.01 && dLine1 < 0.018;
            const dLine2 = Math.abs(ndy - (-1.2 * ndx + 0.048));
            const inL2 = ndx >= -0.02 && ndx <= 0.09 && dLine2 < 0.018;

            if (inL1 || inL2) {
              r = 255;
              g = 255;
              b = 255;
            }
          }
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return png;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const targets = [
  { name: 'pwa-192x192.png', size: 192, maskable: false },
  { name: 'pwa-512x512.png', size: 512, maskable: false },
  { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
];

for (const target of targets) {
  const filePath = path.join(publicDir, target.name);
  const png = createIcon(target.size, target.maskable);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${target.name} (${target.size}x${target.size})`);
}
