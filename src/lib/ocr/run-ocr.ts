"use client";

import type { OcrLine } from "./parser";
import { preprocessPixels } from "./preprocess";

export const OCR_MAX_BYTES = 10 * 1024 * 1024;
export const OCR_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Validazione dell'immagine: tipo, dimensione e decodifica reale (contenuto non attendibile) */
export async function validateImage(file: Blob): Promise<ImageBitmap> {
  if (!OCR_TYPES.includes(file.type)) throw new Error("Formato non supportato: usare PNG, JPEG o WebP");
  if (file.size > OCR_MAX_BYTES) throw new Error("Immagine troppo grande (massimo 10 MB)");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("Il file non è un'immagine valida");
  }
  if (bmp.width < 20 || bmp.height < 20 || bmp.width > 10000 || bmp.height > 10000) {
    bmp.close();
    throw new Error("Dimensioni dell'immagine non valide");
  }
  return bmp;
}

/**
 * Prepara lo screenshot per l'OCR: ingrandisce le immagini piccole, converte in scala di grigi,
 * inverte i temi scuri (testo chiaro su fondo scuro, tipico dei giochi) e aumenta il contrasto.
 */
export function preprocess(bmp: ImageBitmap): HTMLCanvasElement {
  const scale = bmp.width < 1400 ? Math.min(3, 1400 / bmp.width) : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  preprocessPixels(img.data, w, h);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

type Progress = (p: { status: string; progress: number }) => void;

/** OCR locale con Tesseract.js: l'immagine non lascia il browser */
export async function recognize(canvas: HTMLCanvasElement, onProgress: Progress): Promise<OcrLine[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["ita", "eng"], 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    workerBlobURL: false,
    ...(process.env.NEXT_PUBLIC_OCR_LANG_PATH ? { langPath: process.env.NEXT_PUBLIC_OCR_LANG_PATH } : {}),
    logger: (m: { status: string; progress: number }) => onProgress(m),
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1" } as never);
    const { data } = await worker.recognize(canvas);
    const lines = (data.lines ?? []).map((l) => ({
      text: l.text.replace(/\n$/, ""),
      confidence: l.confidence,
      words: l.words.map((w) => ({ text: w.text, confidence: w.confidence, x0: w.bbox.x0, x1: w.bbox.x1 })),
    }));
    return lines;
  } finally {
    await worker.terminate();
  }
}
