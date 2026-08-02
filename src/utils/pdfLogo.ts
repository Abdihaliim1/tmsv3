import { jsPDF } from 'jspdf';

export type PdfImageFormat = 'PNG' | 'JPEG';

/**
 * Load a company logo (data URL or remote URL) into a jsPDF-compatible PNG/JPEG data URL.
 * Uses canvas so WEBP/GIF and odd MIME types normalize cleanly.
 */
export async function loadLogoForPdf(
  logoUrl?: string | null
): Promise<{ dataUrl: string; format: PdfImageFormat } | null> {
  if (!logoUrl || typeof logoUrl !== 'string') return null;

  // Fast path for already-normalized PNG/JPEG data URLs
  if (logoUrl.startsWith('data:image/png')) {
    return { dataUrl: logoUrl, format: 'PNG' };
  }
  if (logoUrl.startsWith('data:image/jpeg') || logoUrl.startsWith('data:image/jpg')) {
    return { dataUrl: logoUrl, format: 'JPEG' };
  }

  return new Promise(resolve => {
    const img = new Image();
    // Required for remote Firebase Storage URLs when CORS allows it.
    if (!logoUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(null);
          return;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        // Prefer PNG to preserve transparent logos from Settings uploads.
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl, format: 'PNG' });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
}

/** Draw a logo scaled to fit maxW×maxH, preserving aspect ratio. Returns true if drawn. */
export function drawPdfLogo(
  doc: jsPDF,
  logo: { dataUrl: string; format: PdfImageFormat },
  x: number,
  y: number,
  maxW: number,
  maxH: number
): boolean {
  try {
    const props = doc.getImageProperties(logo.dataUrl);
    const ratio = props.width / props.height;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    doc.addImage(logo.dataUrl, logo.format, x, y, w, h, undefined, 'FAST');
    return true;
  } catch (error) {
    console.warn('Failed to draw PDF logo:', error);
    return false;
  }
}
