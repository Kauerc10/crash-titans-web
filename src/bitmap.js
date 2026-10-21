// Original bitmap glyphs from the user's PS2 disc. Canvas labels stay inside
// native DOM controls so keyboard navigation and accessible names remain intact.
const base = new URL('../public/assets/', import.meta.url);
const images = new Map();
let fonts;

export async function initFonts() {
  const res = await fetch(new URL('fonts.json', base));
  if (!res.ok) throw new Error('Could not load original fonts');
  fonts = await res.json();
  const files = new Set(Object.values(fonts).flatMap(f => Object.values(f.glyphs).map(g => g.texture)));
  await Promise.all([...files].map(async file => {
    const img = new Image(); img.src = new URL(file, base); await img.decode(); images.set(file, img);
  }));
}

export function label(text, size = 40, color = '#f7df95', small = false, maxWidth = 760) {
  const font = fonts[small ? 'Titans_Small' : 'Titans_Large'];
  const glyphs = [...text.toUpperCase()].map(c => {
    const original = font.glyphs[c];
    if (original?.width || c === ' ') return { ...original };
    const [base, accent] = c.normalize('NFD');
    const fallback = font.glyphs[base];
    if (accent && fallback?.width) return { ...fallback, accent };
    return { ...(original || font.glyphs['?']) };
  });
  const factor = size / font.size;
  const width = Math.max(1, glyphs.reduce((sum, g) => sum + g.advance, 0) * factor + 8);
  const height = font.height * factor + 10;
  const fit = Math.min(1, maxWidth / width);
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr);
  canvas.style.width = `${width * fit}px`; canvas.style.height = `${height * fit}px`;
  canvas.setAttribute('aria-hidden', 'true'); canvas.className = 'bitmap';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr * factor, dpr * factor);
  let x = 4 / factor;
  for (const g of glyphs) {
    if (g.width > 0) ctx.drawImage(images.get(g.texture), g.x, g.y, g.width, g.height, x + g.left, 0, g.width, g.height);
    // The USA atlas leaves Ã, Õ and Ê blank. Add the missing accents over
    // the original base letter rather than dropping letters in Portuguese.
    if (g.accent) {
      const mid = x + g.advance / 2;
      const w = font.size * .12, y = font.size * .08;
      ctx.strokeStyle = 'white'; ctx.lineWidth = Math.max(1.5, font.size * .045); ctx.lineCap = 'round';
      ctx.beginPath();
      if (g.accent === '\u0303') { ctx.moveTo(mid - w, y + 1); ctx.bezierCurveTo(mid - w / 2, y - 5, mid + w / 2, y + 6, mid + w, y); }
      else if (g.accent === '\u0302') { ctx.moveTo(mid - w, y + 2); ctx.lineTo(mid, y - 2); ctx.lineTo(mid + w, y + 2); }
      else { ctx.moveTo(mid - 2, y + 2); ctx.lineTo(mid + 3, y - 2); }
      ctx.stroke();
    }
    x += g.advance;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

export function asset(name) { return new URL(name, base).href; }
