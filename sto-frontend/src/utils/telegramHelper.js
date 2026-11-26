/**
 * ============================================================================
 * TELEGRAM NOTIFICATION DISPATCHER (Dual-Dispatch: Express API + Direct Bot API)
 * ============================================================================
 * Menjamin notifikasi Telegram terkirim aman & bebas error entitas HTML:
 * 1. Mencoba via backend Express lokal (/api/telegram/send) jika backend aktif.
 * 2. Jika backend offline / error / di hosting Vercel, otomatis fallback
 *    mengirim langsung ke Telegram Bot API dengan sanitasi HTML & batas 4000 char.
 * ============================================================================
 */

const TELEGRAM_BOT_TOKEN = '8893464249:AAFhp-jmadAfKHrYfM56EzWyLN2d9_iaMm4';
const TELEGRAM_CHAT_ID = '-1003981401195';

export const TELEGRAM_SEPARATOR = '━━━━━━━━━━━━━━━━━━━━';
export const TELEGRAM_MAX_LENGTH = 4000;

/**
 * Sanitasi karakter khusus HTML Telegram (&, <, >, ") untuk mencegah
 * error 400 Bad Request: can't parse entities.
 */
export const escTelegramHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Pemotongan aman pesan HTML Telegram (maksimal 4000 karakter) tanpa merusak
 * tag HTML yang sedang terbuka.
 */
export const truncateTelegramMessage = (text, maxLength = TELEGRAM_MAX_LENGTH) => {
  const str = String(text ?? '');
  if (str.length <= maxLength) return str;

  const suffix = '\n\n<i>...(Pesan diringkas karena melebihi batas panjang Telegram)</i>';
  const allowedTags = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a', 'blockquote', 'tg-spoiler']);

  const buildTruncated = (limit) => {
    let cut = str.slice(0, Math.max(0, limit)).replace(/<[^>]*$/, '');
    const lastNewline = cut.lastIndexOf('\n');
    if (lastNewline > limit * 0.6) {
      cut = cut.slice(0, lastNewline);
    }

    const stack = [];
    const tagRegex = /<\/?([a-zA-Z0-9-]+)(?:\s[^>]*)?>/g;
    let match;
    while ((match = tagRegex.exec(cut)) !== null) {
      const full = match[0];
      const tag = match[1].toLowerCase();
      if (!allowedTags.has(tag)) continue;
      if (full.startsWith('</')) {
        const idx = stack.lastIndexOf(tag);
        if (idx !== -1) stack.splice(idx, 1);
      } else if (!full.endsWith('/>')) {
        stack.push(tag);
      }
    }

    let closingTags = '';
    for (let i = stack.length - 1; i >= 0; i--) {
      closingTags += `</${stack[i]}>`;
    }

    return `${cut}${closingTags}${suffix}`;
  };

  let limit = Math.max(50, maxLength - suffix.length - 40);
  let result = buildTruncated(limit);
  while (result.length > maxLength && limit > 20) {
    limit -= Math.max(40, result.length - maxLength + 20);
    result = buildTruncated(limit);
  }
  return result.length <= maxLength ? result : result.slice(0, maxLength);
};

/**
 * Format nomor telepon menjadi tautan ramah klik (tel: & WhatsApp) yang sudah di-escape.
 */
export const formatTelegramPhoneLinks = (rawPhone) => {
  const raw = String(rawPhone || '').trim();
  const digits = raw.replace(/[^0-9]/g, '');
  if (!raw || digits.length < 6) {
    return 'Belum terdata';
  }
  let out = `<a href="${escTelegramHtml(`tel:${digits}`)}">${escTelegramHtml(raw)}</a>`;
  if (digits.startsWith('08') || digits.startsWith('628')) {
    const waDigits = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
    out += ` | <a href="${escTelegramHtml(`https://wa.me/${waDigits}`)}">Chat WA</a>`;
  }
  return out;
};

/**
 * Bangun tautan Google Maps aman dari koordinat GPS atau alamat teks.
 */
export const formatTelegramMapsUrl = (latitude, longitude, address = '') => {
  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  if (
    latitude !== null &&
    latitude !== undefined &&
    latitude !== '' &&
    longitude !== null &&
    longitude !== undefined &&
    longitude !== '' &&
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum)
  ) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${latNum},${lngNum}`)}`;
  }
  const cleanAddr = String(address || '').trim();
  if (cleanAddr && cleanAddr !== '-' && cleanAddr !== 'Alamat belum terdata') {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddr)}`;
  }
  return '';
};

export const sendTelegramAlert = async (text, options = {}) => {
  if (!text) return false;
  const safeText = truncateTelegramMessage(text);

  // 1. Coba kirim via Express Backend API (timeout 1200ms)
  let sentViaBackend = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);

    const res = await fetch('http://localhost:5000/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: safeText,
        options: {
          disable_web_page_preview: true,
          ...options
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      sentViaBackend = true;
      console.log('[TelegramAlert] Berhasil terkirim via Backend Express.');
      return true;
    } else {
      console.error('[TelegramBot Error]: Backend Express merespons status', res.status);
    }
  } catch (backendErr) {
    // Backend offline / mode standalone / Vercel
    if (backendErr?.name !== 'AbortError') {
      console.warn('[TelegramAlert] Backend offline, beralih ke fallback Telegram Bot API:', backendErr?.message || backendErr);
    }
  }

  // 2. Direct Fallback ke Telegram Bot API (HTTPS Langsung dari Browser)
  if (!sentViaBackend) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: safeText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...options
        })
      });

      const data = await response.json();
      if (data && data.ok) {
        console.log('[TelegramAlert] Berhasil terkirim langsung via Telegram Bot API (ID:', data.result?.message_id, ')');
        return true;
      } else {
        console.error('[TelegramBot Error]:', data?.description || data);
      }
    } catch (err) {
      console.error('[TelegramBot Error]:', err.message);
    }
  }

  return false;
};

export default sendTelegramAlert;
