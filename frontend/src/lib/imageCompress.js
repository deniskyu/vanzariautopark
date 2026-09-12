// ============================================================================
//  src/lib/imageCompress.js — compresie imagini în browser, înainte de upload
// ----------------------------------------------------------------------------
//  sharp nu rulează în Cloudflare Workers, deci redimensionarea + compresia se
//  fac AICI, în browserul patronului (decizia din Batch 3).
//
//  O poză de telefon are 8-12 MB. Treisprezece bucăți = ~130 MB pe 4G, cu bara
//  de progres blocată minute în șir. După compresie (1600px, JPEG 0.82):
//  ~2-3 MB fiecare, câteva secunde.
//
//  Returnăm și dimensiunile REALE ale imaginii comprimate — le trimitem la
//  upload (?w=&h=) ca să ajungă în <img width height> pe site, pentru CLS 0.
// ============================================================================

const MAX_DIM = 1600;      // latura mare, în px
const QUALITY = 0.82;      // JPEG

// Citește fișierul într-un element <img>, respectând orientarea EXIF.
// createImageBitmap aplică automat orientarea pe browserele moderne.
async function loadBitmap(file) {
    if ('createImageBitmap' in window) {
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
            // unele browsere nu suportă opțiunea — cădem pe varianta cu <img>
        }
    }
    return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Imagine invalidă'));
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Comprimă un fișier imagine.
 * @param {File} file
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function compressImage(file) {
    // Fișierele non-imagine sau deja mici trec fără procesare grea, dar tot le
    // trecem prin canvas ca să normalizăm formatul la JPEG.
    const bitmap = await loadBitmap(file);
    const sw = bitmap.width;
    const sh = bitmap.height;

    // Calculăm dimensiunea țintă păstrând proporția.
    let tw = sw, th = sh;
    if (Math.max(sw, sh) > MAX_DIM) {
        if (sw >= sh) { tw = MAX_DIM; th = Math.round((sh / sw) * MAX_DIM); }
        else { th = MAX_DIM; tw = Math.round((sw / sh) * MAX_DIM); }
    }

    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, tw, th);
    if (bitmap.close) bitmap.close();

    const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    );
    if (!blob) throw new Error('Compresia a eșuat');

    return { blob, width: tw, height: th };
}

/** Verifică dacă un fișier e imagine acceptată, înainte de compresie. */
export function isAcceptedImage(file) {
    return /^image\/(jpe?g|png|webp)$/i.test(file.type);
}

/** Format lizibil pentru mărimea unui fișier. */
export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default { compressImage, isAcceptedImage, formatBytes };
