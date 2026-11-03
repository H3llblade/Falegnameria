/**
 * Preparazione dei pixel per l'OCR (funzione pura, usata nel browser e negli script di prova).
 * `d` è un buffer RGBA di `w`×`h` pixel, modificato sul posto. Passaggi:
 *  1. scala di grigi; i temi scuri vengono invertiti (testo chiaro su fondo scuro);
 *  2. le fasce orizzontali a fondo scuro (es. intestazione di una tabella) vengono invertite;
 *  3. contrasto stirato rispetto al colore della carta (mediana): carta e filigrane diventano
 *     bianche, l'inchiostro grigio chiaro tipico dei giochi diventa scuro. I grigi restano
 *     (niente bianco/nero), perché negli screenshot piccoli le lettere sono sottili;
 *  4. le linee lunghe orizzontali e verticali (griglie delle tabelle) vengono cancellate,
 *     perché confondono l'analisi della pagina di Tesseract.
 */
export function preprocessPixels(d: Uint8ClampedArray | Uint8Array, w: number, h: number): void {
  const n = w * h;
  const g = new Uint8Array(n);
  let sum = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const v = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    g[p] = v;
    sum += v;
  }
  if (sum / n < 120) for (let p = 0; p < n; p++) g[p] = 255 - g[p];

  // colore della carta (mediana)
  const hist = new Array<number>(256).fill(0);
  for (let p = 0; p < n; p++) hist[g[p]]++;
  let median = 0;
  for (let acc = 0; median < 255 && acc + hist[median] < n / 2; median++) acc += hist[median];

  // 2. fasce scure → invertite. Solo fasce alte (intestazioni), non le singole linee della griglia
  const darkRow = new Uint8Array(h);
  for (let y = 0; y < h; y++) {
    let c = 0;
    for (let x = 0; x < w; x++) if (g[y * w + x] < median - 70) c++;
    darkRow[y] = c > w * 0.6 ? 1 : 0;
  }
  const minBand = Math.max(6, Math.round(h / 120));
  for (let y = 0; y < h; ) {
    if (!darkRow[y]) {
      y++;
      continue;
    }
    let e = y;
    while (e < h && darkRow[e]) e++;
    if (e - y >= minBand) for (let k = y * w; k < e * w; k++) g[k] = 255 - g[k];
    y = e;
  }

  // 3. contrasto rispetto alla carta
  const hi = Math.max(80, median - 15); // da qui in su: bianco (carta, filigrane)
  const lo = Math.max(0, hi - 80); // da qui in giù: nero
  const out = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const t = Math.min(1, Math.max(0, (g[p] - lo) / (hi - lo)));
    out[p] = Math.round(255 * t * t);
  }

  // 4. cancella le linee lunghe (più lunghe di qualunque tratto di lettera)
  const ink = (p: number) => out[p] < 150;
  const minH = Math.max(60, Math.round(w * 0.06));
  const minV = Math.max(60, Math.round(h * 0.06));
  const wipe: number[] = [];
  for (let y = 0; y < h; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && ink(y * w + x);
      if (on && start < 0) start = x;
      else if (!on && start >= 0) {
        if (x - start >= minH) for (let k = start; k < x; k++) wipe.push(y * w + k);
        start = -1;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let start = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && ink(y * w + x);
      if (on && start < 0) start = y;
      else if (!on && start >= 0) {
        if (y - start >= minV) for (let k = start; k < y; k++) wipe.push(k * w + x);
        start = -1;
      }
    }
  }
  for (const p of wipe) out[p] = 255;

  for (let p = 0; p < n; p++) {
    const i = p * 4;
    d[i] = d[i + 1] = d[i + 2] = out[p];
    d[i + 3] = 255;
  }
}
