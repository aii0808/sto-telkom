/**
 * ============================================================================
 * TELEGRAM BOT SERVICE (sto-backend/src/services/telegramService.js)
 * ============================================================================
 * Bot Telegram Resmi: @sto_pyk_bot (ID: 8893464249)
 * Mendukung Alur Kerja Sidang KP & Dual Broadcast:
 * 1. Broadcast Tiket Baru ke Teknisi dengan Tombol Inline [🔘 AMBIL TIKET SEKARANG]
 * 2. Magic Link Auth Tokens Generator & Auto-Login
 * 3. Polling Callback Query Telegram & Auto-Claim Tiket
 * 4. Notifikasi Permohonan & Rilis Material Gudang
 * 5. Notifikasi Check-In & Closing BASTP
 * ============================================================================
 */

const crypto = require('crypto');
const supabase = require('../config/supabaseClient');

const BOT_TOKEN = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '8893464249:AAFhp-jmadAfKHrYfM56EzWyLN2d9_iaMm4';
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_SEPARATOR = '━━━━━━━━━━━━━━━━━━━━';
const TELEGRAM_MAX_LENGTH = 4000;

// Helper Escape HTML lengkap untuk sanitasi teks Telegram (Anti-Crash Entities)
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Truncate pesan HTML Telegram secara aman hingga batas maksimal (default 4000 karakter)
 * tanpa meninggalkan tag HTML terbuka atau terpotong di tengah tag.
 */
function truncateTelegramMessage(text, maxLength = TELEGRAM_MAX_LENGTH) {
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
}

/**
 * Ekstrak metadata pelanggan/telepon/catatan dari string tugas.lokasi tanpa duplikasi.
 */
function parseTaskLocationMeta(rawLokasi, explicitPelanggan = '', explicitTelp = '', explicitNote = '') {
  let address = String(rawLokasi || '').trim();
  let pelangganNama = String(explicitPelanggan || '').trim();
  let pelangganTelp = String(explicitTelp || '').trim();
  let catatan = String(explicitNote || '').trim();

  // Format backend: "Alamat (Pelanggan: Nama | Telp: 08xx | Catatan: ...)"
  const parenMeta = address.match(/\(([^)]*(?:Pelanggan:|Telp:|Catatan:)[^)]*)\)\s*$/i);
  if (parenMeta) {
    const inner = parenMeta[1];
    const mPel = inner.match(/Pelanggan:\s*([^|]+)/i);
    const mTel = inner.match(/Telp:\s*([^|]+)/i);
    const mCat = inner.match(/Catatan:\s*([^|]+)/i);
    if (mPel && !pelangganNama) pelangganNama = mPel[1].trim();
    if (mTel && !pelangganTelp) pelangganTelp = mTel[1].trim();
    if (mCat && !catatan) catatan = mCat[1].trim();
    address = address.slice(0, parenMeta.index).trim();
  }

  // Format frontend: "Nama (Telp) - Alamat [Catatan]"
  const bracketCat = address.match(/\[([^\]]+)\]\s*$/);
  if (bracketCat) {
    if (!catatan) catatan = bracketCat[1].trim();
    address = address.slice(0, bracketCat.index).trim();
  }
  const dashSplit = address.match(/^([^(]+?)(?:\s*\(([^)]+)\))?\s+-\s+(.+)$/);
  if (dashSplit && !/^(jl|jalan|kel|kec|gang)/i.test(dashSplit[1].trim())) {
    if (!pelangganNama) pelangganNama = dashSplit[1].trim();
    if (dashSplit[2] && !pelangganTelp) pelangganTelp = dashSplit[2].trim();
    address = dashSplit[3].trim();
  }

  return {
    address: address || 'Alamat belum terdata',
    pelangganNama: pelangganNama || 'Pelanggan Belum Terdata',
    pelangganTelp: pelangganTelp || '',
    catatan: catatan || ''
  };
}

/**
 * Format nomor telepon pelanggan menjadi tautan klik tel: & WhatsApp (jika nomor seluler).
 */
function formatPhoneLinks(rawPhone) {
  const raw = String(rawPhone || '').trim();
  const digits = raw.replace(/[^0-9]/g, '');
  if (!raw || digits.length < 6) {
    return 'Belum terdata';
  }
  const telHref = `tel:${digits}`;
  let out = `<a href="${esc(telHref)}">${esc(raw)}</a>`;
  if (digits.startsWith('08') || digits.startsWith('628')) {
    const waDigits = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
    out += ` | <a href="${esc(`https://wa.me/${waDigits}`)}">Chat WA</a>`;
  }
  return out;
}

/**
 * Bangun tautan Google Maps aman dari koordinat GPS atau alamat teks.
 */
function formatMapsUrl(latitude, longitude, address = '') {
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
}

// Pemeriksaan status aktif broadcast Telegram (dapat dinonaktifkan sementara via env TELEGRAM_ENABLED=false)
const isTelegramEnabled = () => {
  return process.env.TELEGRAM_ENABLED === 'true' || process.env.TELEGRAM_ENABLED === '1';
};

// Fungsi pengiriman langsung ke Telegram Group (Sesuai SOP Alur Telegram)
async function kirimKeGrup(teks, options = {}) {
  if (!isTelegramEnabled()) {
    console.log('[Telegram Service] Broadcast Telegram dinonaktifkan sementara (TELEGRAM_ENABLED=false).');
    return { ok: true, disabled: true, message: 'Broadcast Telegram dinonaktifkan sementara.' };
  }

  const token = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || BOT_TOKEN;
  const groupId = process.env.TELEGRAM_GROUP_ID || process.env.TELEGRAM_CHAT_ID || '-1003981401195';
  const safeText = truncateTelegramMessage(teks);

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: groupId,
          text: safeText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...options
        }),
      }
    );
    const data = await res.json();
    if (!data.ok) {
      console.error('[TelegramBot Error]:', data.description || data);
    }
    return data;
  } catch (err) {
    console.error('[TelegramBot Error]:', err.message);
    return { ok: false, error: err.message };
  }
}

// Registry Chat ID Penerima Aktif (Default terisi Group ID utama)
const defaultGroupId = process.env.TELEGRAM_GROUP_ID || '-1003981401195';
const registeredChatIds = new Set([defaultGroupId]);

// Inisialisasi dari environment variables jika ada
if (process.env.TELEGRAM_CHAT_ID) {
  process.env.TELEGRAM_CHAT_ID.split(',').forEach(id => {
    const clean = id.trim();
    if (clean) registeredChatIds.add(clean);
  });
}
if (process.env.TELEGRAM_GROUP_ID) {
  registeredChatIds.add(process.env.TELEGRAM_GROUP_ID.trim());
}

let lastUpdateId = 0;
let isPollingActive = false;

/**
 * Mengambil updates dari Telegram untuk mendeteksi chat_id & group_id pengirim
 */
async function getRecentUpdates() {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/getUpdates?offset=${lastUpdateId + 1}`);
    const result = await response.json();
    if (result.ok && Array.isArray(result.result)) {
      const chats = result.result
        .map(u => u.message?.chat || u.my_chat_member?.chat || u.channel_post?.chat || u.callback_query?.message?.chat)
        .filter(Boolean)
        .map(c => ({
          id: String(c.id),
          type: c.type, // 'private' | 'group' | 'supergroup' | 'channel'
          title: c.title || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || 'Tanpa Nama',
          username: c.username || null,
          isGroup: c.type === 'group' || c.type === 'supergroup'
        }));

      // Unikkan berdasarkan id & daftarkan otomatis ke registeredChatIds
      const uniqueChats = [];
      const seen = new Set();
      for (const c of chats) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          uniqueChats.push(c);
          registeredChatIds.add(c.id);
        }
      }

      // Update lastUpdateId
      for (const u of result.result) {
        if (u.update_id > lastUpdateId) {
          lastUpdateId = u.update_id;
        }
      }

      return {
        success: true,
        chats: uniqueChats,
        registeredCount: registeredChatIds.size,
        allRecipients: Array.from(registeredChatIds)
      };
    }
    return { success: false, error: 'Tidak ada updates' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Memproses interaksi callback query tombol inline [ 🔘 AMBIL TIKET SEKARANG ]
 */
async function handleTelegramCallbackQuery(cq) {
  const data = cq.data || '';
  const from = cq.from || {};
  const senderChatId = String(from.id || cq.message?.chat?.id || '');
  const senderUsername = from.username || '';
  const senderName = `${from.first_name || ''} ${from.last_name || ''}`.trim() || from.username || 'Teknisi Lapangan';

  // Tangani aksi Lihat Tiket (view_ID)
  if (data.startsWith('view_')) {
    const tugasId = parseInt(data.replace('view_', ''), 10);
    const baseUrl = (process.env.APP_FRONTEND_URL || 'https://sto-telkom.vercel.app').replace(/\/+$/, '');
    await fetch(`${TELEGRAM_API_BASE}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: cq.id,
        text: `Membuka Tiket #${tugasId} di browser...`
      })
    });
    await kirimKeGrup(`ℹ️ <b>Detail Tiket #${tugasId}:</b> <a href="${baseUrl}">${baseUrl}</a>`);
    return;
  }

  if (!data.startsWith('claim_')) return;

  const tugasId = parseInt(data.replace('claim_', ''), 10);
  if (isNaN(tugasId) || tugasId <= 0) return;

  try {
    // 0. Ambil detail tiket & titik ODP
    let taskData = null;
    try {
      const { data: tData } = await supabase
        .from('tugas')
        .select('*, odp(*)')
        .eq('id', tugasId)
        .single();
      if (tData) taskData = tData;
    } catch (errTask) {
      console.warn('[handleTelegramCallbackQuery] Task lookup notice:', errTask.message);
    }

    // 1. Identifikasi teknisi di tabel users
    let techUser = null;
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'teknisi');

      if (usersData && usersData.length > 0) {
        techUser = usersData.find(u =>
          (u.telegram_chat_id && String(u.telegram_chat_id) === senderChatId) ||
          (u.username_telegram && u.username_telegram.toLowerCase() === senderUsername.toLowerCase())
        ) || usersData[0];

        // Jika user belum memiliki telegram_chat_id, simpan otomatis
        if (techUser && (!techUser.telegram_chat_id || !techUser.username_telegram)) {
          await supabase.from('users').update({
            telegram_chat_id: senderChatId,
            username_telegram: senderUsername || null
          }).eq('id', techUser.id);
        }
      }
    } catch (err) {
      console.warn('[handleTelegramCallbackQuery] Lookup user notice:', err.message);
    }

    const assignedUserId = techUser?.id || 2;
    const assignedUserName = techUser?.nama_lengkap || senderName;

    // 2. Buat token magic link di tabel auth_tokens
    const token = crypto.randomBytes(24).toString('hex');
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('auth_tokens').insert([{
      token,
      user_id: assignedUserId,
      tugas_id: tugasId,
      expired_at: expiredAt,
      is_used: false
    }]);

    // 3. Update status tugas menjadi Progress / diambil teknisi
    await supabase.from('tugas').update({
      teknisi_id: assignedUserId,
      status: 'Progress'
    }).eq('id', tugasId);

    // 4. Jawab callback query Telegram dengan alert modal resmi
    await fetch(`${TELEGRAM_API_BASE}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: cq.id,
        text: `✅ Tiket #${tugasId} berhasil Anda klaim! Segera menuju Gudang STO Payakumbuh untuk serah terima material.`,
        show_alert: true
      })
    });

    // 5. Kirim pengumuman update dispatch ke Grup Telegram & instruksikan teknisi ke Portal
    const baseUrl = getAppFrontendUrl();
    const magicLink = baseUrl;

    const odpKode = taskData?.odp?.kode_odp || taskData?.odp_kode || 'Titik ODP Belum Ditentukan';
    const groupBroadcastText = templateKlaimTiket({
      tugas: {
        ...(taskData || {}),
        id: tugasId,
        odp_kode: odpKode
      },
      teknisiNama: assignedUserName,
      magicLink
    });

    await kirimKeGrup(groupBroadcastText, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📦 AJUKAN MATERIAL / BUKA TIKET',
              url: magicLink
            }
          ]
        ]
      }
    });

    // Notifikasi privat langsung ke pengirim jika chat ID valid
    if (senderChatId && senderChatId !== defaultGroupId) {
      try {
        await sendTelegramMessage(
          `✅ <b>KLAIM TIKET TELKOM AKSES BERHASIL</b>\n\nTiket #${esc(tugasId)} telah terikat ke akun Anda (${esc(assignedUserName)}).\nSilakan ajukan material di portal jika diperlukan, lalu menuju lokasi pelanggan.\n\n👉 <a href="${esc(magicLink)}">Buka Portal Tiket</a>`,
          senderChatId
        );
      } catch (privErr) {
        console.error('[TelegramBot Error]:', privErr.message);
      }
    }
  } catch (err) {
    console.error('[TelegramBot Error]:', err.message);
  }
}

/**
 * Worker polling berkala Telegram untuk menerima aksi klik tombol inline teknisi
 */
async function pollTelegramUpdates() {
  if (!isTelegramEnabled()) return;
  if (isPollingActive) return;
  isPollingActive = true;

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/getUpdates?offset=${lastUpdateId + 1}&timeout=3`);
    const data = await res.json();

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        if (update.update_id > lastUpdateId) {
          lastUpdateId = update.update_id;
        }

        if (update.callback_query) {
          await handleTelegramCallbackQuery(update.callback_query);
        } else if (update.message?.chat?.id) {
          registeredChatIds.add(String(update.message.chat.id));
        }
      }
    }
  } catch {
    // Abaikan error polling sementara
  } finally {
    isPollingActive = false;
  }
}

// Jalankan polling setiap 4 detik untuk merespons tombol inline teknisi (hanya jika aktif)
let pollInterval = null;
if (isTelegramEnabled()) {
  pollInterval = setInterval(pollTelegramUpdates, 4000);
  if (pollInterval && typeof pollInterval.unref === 'function') {
    pollInterval.unref();
  }
  pollTelegramUpdates().catch(() => {});
}

/**
 * Mengirim pesan teks terformat HTML ke satu atau banyak target chat Telegram
 */
async function sendTelegramMessage(text, target = null, options = {}) {
  if (!isTelegramEnabled()) {
    return { success: true, count: 0, disabled: true, message: 'Broadcast Telegram dinonaktifkan sementara.' };
  }
  let targets = [];

  if (target && typeof target === 'string' && target !== 'all' && target !== 'teknisi' && target !== 'gudang') {
    targets = target.split(',').map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(target) && target.length > 0) {
    targets = target.map(String);
  } else {
    const defaultGroup = process.env.TELEGRAM_GROUP_ID || '-1003981401195';
    targets = [defaultGroup];
    registeredChatIds.forEach(id => {
      if (!targets.includes(id)) targets.push(id);
    });
  }

  const results = [];
  const safeText = truncateTelegramMessage(text);

  for (const chatId of targets) {
    try {
      const payload = {
        chat_id: chatId,
        text: safeText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      };

      const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await response.json();
      if (resJson.ok) {
        results.push({ chatId, success: true, messageId: resJson.result.message_id });
      } else {
        console.error(`[TelegramBot Error] Chat ${chatId}:`, resJson.description);
        results.push({ chatId, success: false, error: resJson.description });
      }
    } catch (err) {
      console.error(`[TelegramBot Error] Chat ${chatId}:`, err.message);
      results.push({ chatId, success: false, error: err.message });
    }
  }

  const anySuccess = results.some(r => r.success);
  return {
    success: anySuccess,
    deliveredCount: results.filter(r => r.success).length,
    totalAttempted: targets.length,
    details: results,
    draftMessage: safeText
  };
}

/**
 * Menambahkan chat/group id secara manual
 */
function addChatRecipient(chatId) {
  if (chatId) {
    registeredChatIds.add(String(chatId).trim());
  }
  return Array.from(registeredChatIds);
}

function getAllRecipients() {
  return Array.from(registeredChatIds);
}

// ============================================================================
// TEMPLATE PESAN RESMI DUAL BROADCAST & ALUR KERJA SIDANG KP
// ============================================================================

/**
 * Helper mendapatkan Frontend Base URL yang terbebas dari trailing slash & default ke production Vercel
 */
function getAppFrontendUrl() {
  const url = process.env.APP_FRONTEND_URL || 'https://sto-telkom.vercel.app';
  return url.replace(/\/+$/, '');
}

/**
 * FASE 1: Broadcast Tiket Baru Pimpinan ke Teknisi (Standar SOP Telkom Akses)
 */
function templateTiketBaru(param1, param2, param3) {
  let tugas, baseUrl, magicUrl, mode, teknisiNama;
  const defaultFrontend = getAppFrontendUrl();

  if (param1 && param1.tugas) {
    tugas = param1.tugas;
    baseUrl = (param1.baseUrl || defaultFrontend).replace(/\/+$/, '');
    magicUrl = param1.magicUrl;
    mode = param1.mode || (tugas.teknisi_id ? 'assigned' : 'open');
    teknisiNama = param1.teknisiNama || null;
  } else {
    tugas = param1 || {};
    baseUrl = defaultFrontend;
    magicUrl = typeof param2 === 'string' ? param2 : param3;
    if (param2 && typeof param2 === 'object' && param2.kode_odp) {
      tugas.odp_kode = param2.kode_odp;
    }
    mode = tugas.teknisi_id ? 'assigned' : 'open';
    teknisiNama = null;
  }

  const meta = parseTaskLocationMeta(
    tugas.lokasi,
    tugas.pelanggan_nama,
    tugas.pelanggan_telp,
    tugas.keterangan || tugas.catatan
  );

  const odpKode = tugas.odp_kode || tugas.odp?.kode_odp || 'Titik ODP Belum Ditentukan';
  const jenisKerja = tugas.jenis_kerja || 'Penugasan Lapangan';
  const targetUrl = (magicUrl || baseUrl).replace(/\/+$/, '');
  const mapsUrl = formatMapsUrl(tugas.target_lat || tugas.latitude, tugas.target_lng || tugas.longitude, meta.address);
  const kontakHtml = formatPhoneLinks(meta.pelangganTelp);
  const isAssigned = mode === 'assigned' && Boolean(teknisiNama || tugas.teknisi_id);

  const headerTag = isAssigned
    ? '📌 <b>[TELKOM AKSES STO PAYAKUMBUH — PENUGASAN LANGSUNG]</b>'
    : '🚨 <b>[TELKOM AKSES STO PAYAKUMBUH — SPK BARU]</b>';

  const statusLine = isAssigned
    ? `👷 <b>Teknisi Ditugaskan:</b> ${esc(teknisiNama || 'Teknisi Lapangan')}\n📊 <b>Status:</b> <code>ASSIGNED — Menunggu Pengerjaan</code>`
    : `📊 <b>Status:</b> <code>OPEN POOL — Menunggu Klaim Teknisi</code>`;

  const lines = [
    headerTag,
    TELEGRAM_SEPARATOR,
    `📋 <b>Tiket:</b> #${esc(tugas.id || 'BARU')} • <b>${esc(jenisKerja)}</b>`,
    `🔌 <b>ODP Target:</b> <code>${esc(odpKode)}</code>`,
    `👤 <b>Pelanggan:</b> ${esc(meta.pelangganNama)}`,
    `📞 <b>Kontak:</b> ${kontakHtml}`,
    `📍 <b>Alamat:</b> ${esc(meta.address)}${mapsUrl ? ` (<a href="${esc(mapsUrl)}">Buka Maps</a>)` : ''}`,
    meta.catatan ? `📝 <b>Instruksi NOC:</b> ${esc(meta.catatan)}` : null,
    statusLine,
    `⏱️ <b>Target SLA:</b> &lt; 3 Jam (Prioritas Operasional)`,
    TELEGRAM_SEPARATOR,
    isAssigned
      ? `👉 <a href="${esc(targetUrl)}">Buka Detail Tiket di Portal</a>`
      : `⚡ <i>Teknisi siaga, silakan klaim tiket melalui tombol di bawah:</i>\n👉 <a href="${esc(targetUrl)}">Buka Detail Tiket di Portal</a>`
  ].filter(Boolean);

  return truncateTelegramMessage(lines.join('\n'));
}

/**
 * Membangun markup tombol inline Telegram [ 🔘 AMBIL TIKET SEKARANG ]
 */
function buildInlineKeyboardTiket(param1, param2) {
  let tugas, magicUrl;
  const defaultFrontend = getAppFrontendUrl();

  if (param1 && param1.tugas) {
    tugas = param1.tugas;
    magicUrl = param1.magicUrl;
  } else {
    tugas = typeof param1 === 'object' ? param1 : { id: param1 };
    magicUrl = param2;
  }

  const webUrl = (magicUrl || defaultFrontend).replace(/\/+$/, '');

  return {
    inline_keyboard: [
      [
        {
          text: '🔘 AMBIL TIKET SEKARANG',
          callback_data: `claim_${tugas?.id || 'new'}`
        }
      ],
      [
        {
          text: '🌐 BUKA DETAIL TIKET',
          url: webUrl
        }
      ]
    ]
  };
}

/**
 * Template Klaim Tiket oleh Teknisi (seragam untuk tombol Telegram & Portal Web)
 */
function templateKlaimTiket({ tugas = {}, teknisiNama = 'Teknisi Lapangan', magicLink = null, baseUrl = null }) {
  const defaultFrontend = (baseUrl || getAppFrontendUrl()).replace(/\/+$/, '');
  const targetUrl = (magicLink || defaultFrontend).replace(/\/+$/, '');
  const meta = parseTaskLocationMeta(tugas.lokasi, tugas.pelanggan_nama, tugas.pelanggan_telp, tugas.keterangan);
  const odpKode = tugas.odp_kode || tugas.odp?.kode_odp || 'Titik ODP Belum Ditentukan';
  const jenisKerja = tugas.jenis_kerja || 'Penugasan Lapangan';
  const mapsUrl = formatMapsUrl(tugas.target_lat || tugas.latitude, tugas.target_lng || tugas.longitude, meta.address);

  return truncateTelegramMessage([
    `👷 <b>[TELKOM AKSES STO PAYAKUMBUH — TIKET DIKLAIM]</b>`,
    TELEGRAM_SEPARATOR,
    `📋 <b>Tiket:</b> #${esc(tugas.id || '-')} • <b>${esc(jenisKerja)}</b>`,
    `👷 <b>Teknisi:</b> <b>${esc(teknisiNama || 'Teknisi Lapangan')}</b>`,
    `🔌 <b>ODP Target:</b> <code>${esc(odpKode)}</code>`,
    `👤 <b>Pelanggan:</b> ${esc(meta.pelangganNama)}`,
    `📞 <b>Kontak:</b> ${formatPhoneLinks(meta.pelangganTelp)}`,
    `📍 <b>Alamat:</b> ${esc(meta.address)}${mapsUrl ? ` (<a href="${esc(mapsUrl)}">Buka Maps</a>)` : ''}`,
    `📊 <b>Status:</b> <code>PROGRESS (Diambil Teknisi)</code>`,
    TELEGRAM_SEPARATOR,
    `📌 <i>Langkah berikutnya: Ajukan material di portal jika membutuhkan perangkat/kabel gudang, atau langsung menuju lokasi.</i>`,
    `👉 <a href="${esc(targetUrl)}">Buka Portal Tiket</a>`
  ].join('\n'));
}

/**
 * FASE 2: Notifikasi Permohonan Material ke Grup Gudang & Pimpinan
 */
function templatePermohonanMaterial({ tugas, permohonan, permohonanIds = [], tugasIds = [], items = [], teknisiNama = 'Teknisi Lapangan', catatan = '', baseUrl = null }) {
  const defaultFrontend = (baseUrl || getAppFrontendUrl()).replace(/\/+$/, '');
  const meta = parseTaskLocationMeta(tugas?.lokasi, tugas?.pelanggan_nama, tugas?.pelanggan_telp, catatan || tugas?.keterangan);

  const maxItemsToShow = 20;
  const shownItems = items.slice(0, maxItemsToShow);
  const remainingCount = items.length - shownItems.length;

  let daftarItems = '• <i>Rincian material belum terlampir</i>';
  if (shownItems.length > 0) {
    daftarItems = shownItems
      .map(i => {
        const nama = i.nama_barang || i.item?.nama_barang || i.nama || `Material #${i.barang_id || '-'}`;
        const qty = i.jumlah ?? i.jumlah_minta ?? 0;
        const satuan = i.satuan || i.item?.satuan || 'pcs';
        return `• <b>${esc(nama)}</b>: ${esc(qty)} ${esc(satuan)}`;
      })
      .join('\n');
    if (remainingCount > 0) {
      daftarItems += `\n<i>... dan ${remainingCount} item material lainnya</i>`;
    }
  }

  const tiketLabel = tugasIds.length > 1
    ? `Batch ${tugasIds.length} Tiket (${tugasIds.slice(0, 15).map(id => `#${esc(id)}`).join(', ')}${tugasIds.length > 15 ? ', ...' : ''})`
    : `#${esc(tugas?.id || permohonan?.tugas_id || '-')}`;

  const reqLabel = permohonanIds.length > 1
    ? permohonanIds.slice(0, 10).map(id => `#${esc(id)}`).join(', ') + (permohonanIds.length > 10 ? ', ...' : '')
    : `#${esc(permohonan?.id || '-')}`;

  const tiketUrl = defaultFrontend;

  return truncateTelegramMessage([
    `📦 <b>[TELKOM AKSES STO PAYAKUMBUH — PERMOHONAN MATERIAL]</b>`,
    TELEGRAM_SEPARATOR,
    `🔖 <b>No. Permohonan:</b> ${reqLabel}`,
    `📋 <b>Tiket:</b> ${tiketLabel}`,
    `👷 <b>Pemohon:</b> <b>${esc(teknisiNama || 'Teknisi Lapangan')}</b>`,
    `👤 <b>Pelanggan:</b> ${esc(meta.pelangganNama)}`,
    `📍 <b>Alamat:</b> ${esc(meta.address)}`,
    TELEGRAM_SEPARATOR,
    `📝 <b>Rincian Material:</b>`,
    daftarItems,
    catatan ? `💬 <b>Catatan:</b> ${esc(catatan)}` : null,
    `📊 <b>Status:</b> <code>MENUNGGU PERSETUJUAN PIMPINAN</code>`,
    TELEGRAM_SEPARATOR,
    `👉 <a href="${esc(tiketUrl)}">Tinjau Permohonan di Portal</a>`
  ].filter(Boolean).join('\n'));
}

/**
 * FASE 3: Konfirmasi Rilis Barang & Binding SN ONT (Status: In-Transit)
 */
function templateRilisBarang({ tugas, permohonan = null, items = [], snOnt = '-', petugasGudang = 'Petugas Gudang STO' }) {
  const meta = parseTaskLocationMeta(tugas?.lokasi, tugas?.pelanggan_nama, tugas?.pelanggan_telp);
  const cleanSn = (snOnt && String(snOnt).trim()) ? String(snOnt).trim() : '-';
  const cleanPetugas = (petugasGudang && String(petugasGudang).trim()) ? String(petugasGudang).trim() : 'Petugas Gudang STO';

  const maxItemsToShow = 15;
  const shownItems = items.slice(0, maxItemsToShow);
  const remaining = items.length - shownItems.length;
  const itemLines = shownItems.length > 0
    ? shownItems.map(i => `• ${esc(i.nama_barang || `Item #${i.barang_id}`)}: <b>${esc(i.jumlah_minta)} ${esc(i.satuan || 'pcs')}</b>`).join('\n') +
      (remaining > 0 ? `\n<i>... dan ${remaining} item lainnya</i>` : '')
    : null;

  return truncateTelegramMessage([
    `✅ <b>[TELKOM AKSES STO PAYAKUMBUH — RILIS MATERIAL GUDANG]</b>`,
    TELEGRAM_SEPARATOR,
    `📋 <b>Tiket:</b> #${esc(tugas?.id || permohonan?.tugas_id || '-')}${permohonan?.id ? ` • <b>Permohonan:</b> #${esc(permohonan.id)}` : ''}`,
    `👤 <b>Pelanggan:</b> ${esc(meta.pelangganNama)}`,
    `🏢 <b>Petugas Gudang:</b> ${esc(cleanPetugas)}`,
    `🏷️ <b>SN ONT Dialokasikan:</b> <code>${esc(cleanSn)}</code>`,
    itemLines ? `📦 <b>Item Dirilis:</b>\n${itemLines}` : null,
    `📊 <b>Status Material:</b> <code>IN-TRANSIT (Dibawa Teknisi ke Lokasi)</code>`,
    TELEGRAM_SEPARATOR,
    `Stok gudang telah diperbarui di sistem. Teknisi dipersilakan menuju lokasi pelanggan &amp; melakukan Check-In.`
  ].filter(Boolean).join('\n'));
}

/**
 * FASE 4: Notifikasi Check-In Teknisi di Lokasi Pelanggan
 */
function templateCheckIn({ tugas, teknisiNama = 'Teknisi Lapangan', latitude = null, longitude = null, waktuWib, baseUrl = null }) {
  const now = waktuWib || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const meta = parseTaskLocationMeta(tugas?.lokasi, tugas?.pelanggan_nama, tugas?.pelanggan_telp);
  const mapsUrl = formatMapsUrl(latitude, longitude, '');
  const defaultFrontend = (baseUrl || getAppFrontendUrl()).replace(/\/+$/, '');
  const tiketUrl = defaultFrontend;

  const coordLine = mapsUrl
    ? `📌 <b>Koordinat GPS:</b> <code>${esc(latitude)}, ${esc(longitude)}</code>\n🗺️ <b>Peta Lokasi:</b> <a href="${esc(mapsUrl)}">Buka Titik di Google Maps</a>`
    : `📌 <b>Koordinat GPS:</b> <i>Tidak tersedia dari perangkat</i>`;

  return truncateTelegramMessage([
    `📍 <b>[TELKOM AKSES STO PAYAKUMBUH — CHECK-IN LOKASI]</b>`,
    TELEGRAM_SEPARATOR,
    `📋 <b>Tiket:</b> #${esc(tugas?.id || '-')} • <b>${esc(tugas?.jenis_kerja || 'Penugasan Lapangan')}</b>`,
    `👷 <b>Teknisi:</b> <b>${esc(teknisiNama || 'Teknisi Lapangan')}</b>`,
    `👤 <b>Pelanggan:</b> ${esc(meta.pelangganNama)}`,
    `🕒 <b>Waktu Tiba:</b> ${esc(now)}`,
    coordLine,
    `📊 <b>Status:</b> <code>IN-PROGRESS (Pengerjaan Dimulai)</code>`,
    TELEGRAM_SEPARATOR,
    `👉 <a href="${esc(tiketUrl)}">Pantau Detail Tiket</a>`
  ].join('\n'));
}

/**
 * FASE 5: Closing BASTP Digital & Pembaruan Okupansi WebGIS ODP
 */
function templateClosingBastp({
  tugas = {},
  odp = null,
  redamanDbm = null,
  snOnt = '-',
  bastpNo = null,
  portBaru = null,
  kapasitasPort = null,
  statusOdp = null,
  tandaTanganPelanggan = false,
  baseUrl = null
}) {
  const meta = parseTaskLocationMeta(tugas?.lokasi, tugas?.pelanggan_nama, tugas?.pelanggan_telp);
  const noSurat = bastpNo || `BASTP/TA-PYK/2026/${String(tugas?.id || '0').padStart(4, '0')}`;
  const cleanSn = (snOnt && String(snOnt).trim()) ? String(snOnt).trim() : '-';
  const defaultFrontend = (baseUrl || getAppFrontendUrl()).replace(/\/+$/, '');
  const tiketUrl = defaultFrontend;

  // Evaluasi QC redaman optik secara dinamis (-16 s/d -24 dBm)
  let redamanText = '<i>Belum diukur</i>';
  if (redamanDbm !== null && redamanDbm !== undefined && redamanDbm !== '' && !Number.isNaN(Number(redamanDbm))) {
    const val = Number(redamanDbm);
    const isPass = val <= -16 && val >= -24;
    redamanText = isPass
      ? `<b>${esc(val)} dBm</b> (Standar QC: <b>PASS ✓</b>)`
      : `<b>${esc(val)} dBm</b> (<b>PERLU EVALUASI / DILUAR STANDAR</b>)`;
  }

  const ontText = cleanSn !== '-'
    ? `<code>${esc(cleanSn)}</code> → <b>ACTIVE (Terpasang di Pelanggan)</b>`
    : `<code>-</code> (Tanpa pencatatan SN ONT)`;

  const ttdText = tandaTanganPelanggan ? 'Terverifikasi Digital' : 'Belum Ditandatangani';

  const resolvedOdpKode = odp?.kode_odp || tugas?.odp_kode || 'Titik ODP Belum Ditentukan';
  const resolvedPort = portBaru ?? odp?.port_terpakai ?? '-';
  const resolvedCap = kapasitasPort ?? odp?.kapasitas_port ?? '-';
  const resolvedStatusOdp = statusOdp || odp?.status || 'Belum Diperbarui';
  const statusIcon = resolvedStatusOdp === 'Penuh' ? '🔴' : resolvedStatusOdp === 'Hampir Penuh' ? '🟡' : '🟢';

  return truncateTelegramMessage([
    `🎉 <b>[TELKOM AKSES STO PAYAKUMBUH — CLOSING &amp; BASTP DIGITAL]</b>`,
    TELEGRAM_SEPARATOR,
    `📜 <b>No. BASTP:</b> <code>${esc(noSurat)}</code>`,
    `📋 <b>Tiket:</b> #${esc(tugas?.id || '-')} • <b>${esc(tugas?.jenis_kerja || 'Penugasan Lapangan')}</b>`,
    `👤 <b>Pelanggan:</b> ${esc(meta.pelangganNama)}`,
    `📶 <b>Redaman OPM:</b> ${redamanText}`,
    `🏷️ <b>Modem ONT:</b> ${ontText}`,
    `✍️ <b>Tanda Tangan Pelanggan:</b> ${esc(ttdText)}`,
    TELEGRAM_SEPARATOR,
    `🔌 <b>Pembaruan ODP:</b> <b>${esc(resolvedOdpKode)}</b> (${esc(resolvedPort)} / ${esc(resolvedCap)} Port)`,
    `${statusIcon} <b>Status Okupansi ODP:</b> <b>${esc(String(resolvedStatusOdp).toUpperCase())}</b>`,
    `👉 <a href="${esc(tiketUrl)}">Lihat &amp; Cetak BASTP Digital</a>`
  ].join('\n'));
}

module.exports = {
  BOT_TOKEN,
  TELEGRAM_SEPARATOR,
  esc,
  truncateTelegramMessage,
  parseTaskLocationMeta,
  formatPhoneLinks,
  formatMapsUrl,
  kirimKeGrup,
  sendTelegramMessage,
  getRecentUpdates,
  addChatRecipient,
  getAllRecipients,
  templateTiketBaru,
  buildInlineKeyboardTiket,
  templateKlaimTiket,
  templatePermohonanMaterial,
  templateRilisBarang,
  templateCheckIn,
  templateClosingBastp,
  handleTelegramCallbackQuery
};

