// Genera le icone della PWA (manifest, iOS, favicon) da un'unica immagine
// quadrata, usando il Chromium gia' installato per Playwright: nessuna
// dipendenza di grafica in piu'.
//
//   node splitFront/scripts/generate-icons.mts [sorgente]
//
// Sorgente predefinita: splitFront/icon/icon.svg. Va bene anche un PNG/JPG
// quadrato (almeno 1024x1024). Requisiti della sorgente in doc/PWA.md: sfondo
// pieno fino ai bordi, niente trasparenza, disegno entro il cerchio centrale di
// raggio 40%. Con una sorgente cosi' la stessa immagine serve per tutte le
// icone, "maskable" compresa.
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const source = resolve(process.argv[2] ?? `${root}/icon/icon.svg`);
const publicDir = `${root}/src/public`;

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const TARGETS: { file: string; size: number }[] = [
  { file: 'icons/icon-192.png', size: 192 },
  { file: 'icons/icon-512.png', size: 512 },
  { file: 'icons/icon-maskable-512.png', size: 512 },
  { file: 'icons/apple-touch-icon.png', size: 180 },
  { file: 'favicon.png', size: 64 },
];

const mime = MIME[extname(source).toLowerCase()];
if (!mime) {
  throw new Error(`Formato non supportato: ${source} (usa svg, png o jpg)`);
}
const dataUrl = `data:${mime};base64,${(await readFile(source)).toString('base64')}`;

await mkdir(`${publicDir}/icons`, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size } of TARGETS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0"><img src="${dataUrl}" style="display:block;width:${size}px;height:${size}px"></body>`,
    );
    await page.locator('img').evaluate((img: HTMLImageElement) => img.decode());
    await page.screenshot({ path: `${publicDir}/${file}` });
    console.log(`${file} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
