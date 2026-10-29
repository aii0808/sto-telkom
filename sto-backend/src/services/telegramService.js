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

// Helper Escape HTML untuk sanitasi teks Telegram
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Fungsi pengiriman langsung ke Telegram Group (Sesuai SOP Alur Telegram)
async function kirimKeGrup(teks, options = {}) {
  const token = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || BOT_TOKEN;
  const groupId = process.env.TELEGRAM_GROUP_ID || process.env.TELEGRAM_CHAT_ID || '-1003981401195';

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: groupId,
          text: teks,
          parse_mode: 'HTML',
          ...options
        }),
      }
    );
    const data = await res.json();
    if (!data.ok) console.error('Telegram error:', data);
    return data;
  } catch (err) {
    console.error('Telegram error:', err.message);
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
    await kirimKeGrup(`ℹ️ <b>Detail Tiket #${tugasId}:</b> <a href="${baseUrl}/tiket/${tugasId}">${baseUrl}/tiket/${tugasId}</a>`);
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

    // 5. Kirim pengumuman update dispatch ke Grup Telegram & instruksikan teknisi ke Gudang
    const baseUrl = (process.env.APP_FRONTEND_URL || 'https://sto-telkom.vercel.app').replace(/\/+$/, '');
    const magicLink = `${baseUrl}/magic-login?token=${token}`;

    const odpKode = taskData?.odp?.kode_odp || taskData?.odp_kode || 'ODP-PYK-FA/001';
    const lokasiText = taskData?.lokasi || 'Payakumbuh';
    const jenisText = taskData?.jenis_kerja || 'Perbaikan Lapangan';

    const groupBroadcastText = `
📢 <b>[TELKOM AKSES — DISPATCH NOC STO PAYAKUMBUH]</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>UPDATE DISPATCH: TIKET TELAH DIKLAIM TEKNISI</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 <b>No. Tiket:</b> #${tugasId}
👷 <b>Teknisi Lapangan:</b> <b>${esc(assignedUserName)}</b>
🔌 <b>Titik ODP:</b> <code>${esc(odpKode)}</code>
📍 <b>Lokasi / Sektor:</b> ${esc(lokasiText)}
💼 <b>Pekerjaan:</b> ${esc(jenisText)}
📊 <b>Status Dispatch:</b> <code>IN-PROGRESS (Sedang Dikerjakan)</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 <b>SOP TAHAP 2 — LOGISTIK MATERIAL GUDANG:</b>
Kepada rekan teknisi <b>${esc(assignedUserName)}</b>, silakan segera menuju ke <b>Gudang STO Telkom Payakumbuh</b> untuk serah terima & pengambilan material kerja (Kabel Dropcore, Modem ONT, Roset Optik, & Aksesoris).

👉 <i>Buka tautan di bawah untuk auto-login ke portal teknisi & ajukan material ke gudang:</i>
<a href="${magicLink}">${magicLink}</a>
    `.trim();

    await kirimKeGrup(groupBroadcastText, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📦 AMBIL MATERIAL DI GUDANG',
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
          `✅ <b>KLAIM TIKET TELKOM BERHASIL</b>\n\nTiket #${tugasId} telah terikat ke akun Anda (${assignedUserName}).\nSilakan segera menuju <b>Gudang STO Telkom Payakumbuh</b> untuk serah terima material.\n\n👉 <b>Akses Tiket:</b> <a href="${magicLink}">${magicLink}</a>`,
          senderChatId
        );
      } catch (_) { /* fallback jika user belum start chat privat */ }
    }
  } catch (err) {
    console.error('[handleTelegramCallbackQuery] Error:', err.message);
  }
}

/**
 * Worker polling berkala Telegram untuk menerima aksi klik tombol inline teknisi
 */
async function pollTelegramUpdates() {
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
  } catch (err) {
    // Abaikan error polling sementara
  } finally {
    isPollingActive = false;
  }
}

// Jalankan polling setiap 4 detik untuk merespons tombol inline teknisi
const pollInterval = setInterval(pollTelegramUpdates, 4000);
if (pollInterval && typeof pollInterval.unref === 'function') {
  pollInterval.unref();
}
pollTelegramUpdates().catch(() => {});

/**
 * Mengirim pesan teks terformat HTML ke satu atau banyak target chat Telegram
 */
async function sendTelegramMessage(text, target = null, options = {}) {
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

  for (const chatId of targets) {
    try {
      const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
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
        console.warn(`[Telegram Error] Chat ${chatId}:`, resJson.description);
        results.push({ chatId, success: false, error: resJson.description });
      }
    } catch (err) {
      console.error(`[Telegram Exception] Chat ${chatId}:`, err.message);
      results.push({ chatId, success: false, error: err.message });
    }
  }

  const anySuccess = results.some(r => r.success);
  return {
    success: anySuccess,
    deliveredCount: results.filter(r => r.success).length,
    totalAttempted: targets.length,
    details: results,
    draftMessage: text
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
 * FASE 1: Broadcast Tiket Baru Pimpinan ke Teknisi (Telkom Akses NOC Professional)
 */
function templateTiketBaru(param1, param2, param3) {
  let tugas, baseUrl, magicUrl;
  const defaultFrontend = getAppFrontendUrl();

  if (param1 && param1.tugas) {
    tugas = param1.tugas;
    baseUrl = (param1.baseUrl || defaultFrontend).replace(/\/+$/, '');
    magicUrl = param1.magicUrl;
  } else {
    tugas = param1 || {};
    baseUrl = defaultFrontend;
    magicUrl = typeof param2 === 'string' ? param2 : param3;
    if (param2 && typeof param2 === 'object' && param2.kode_odp) {
      tugas.odp_kode = param2.kode_odp;
    }
  }

  const odpKode = tugas.odp_kode || (tugas.odp ? tugas.odp.kode_odp : 'ODP-PYK-01/04');
  const lokasi = tugas.lokasi || 'Jl. Soekarno-Hatta, Payakumbuh';
  const jenisKerja = tugas.jenis_kerja || 'Kabel Dropcore Putus';
  const targetUrl = (magicUrl || `${baseUrl}/tiket/${tugas.id || ''}`).replace(/\/+$/, '');

  return `
🚨 <b>[TELKOM AKSES — NOC DISPATCH STO PAYAKUMBUH]</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>WORK ORDER / TIKET GANGGUAN BARU</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 <b>No. Tiket:</b> #${tugas.id || 'NEW'}
🔌 <b>Titik ODP Jaringan:</b> <code>${esc(odpKode)}</code>
📍 <b>Lokasi / Sektor:</b> ${esc(lokasi)}
💼 <b>Klasifikasi Pekerjaan:</b> ${esc(jenisKerja)}
${tugas.pelanggan_nama ? `👤 <b>Pelanggan:</b> ${esc(tugas.pelanggan_nama)}\n` : ''}${tugas.pelanggan_telp ? `📞 <b>Kontak:</b> ${esc(tugas.pelanggan_telp)}\n` : ''}${tugas.keterangan ? `📝 <b>Instruksi NOC:</b> ${esc(tugas.keterangan)}\n` : ''}⏱️ <b>Target SLA Pengerjaan:</b> &lt; 3 Jam (Prioritas Utama)
📊 <b>Status Dispatch:</b> 📢 <code>OPEN POOL (Menunggu Klaim Teknisi)</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ <i>Teknisi siaga STO Payakumbuh, silakan klaim tiket melalui tombol di bawah:</i>
👉 <a href="${targetUrl}">Buka Detail Tiket di Portal</a>
`.trim();
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

  const webUrl = (magicUrl || `${defaultFrontend}/tiket/${tugas?.id || ''}`).replace(/\/+$/, '');

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
 * FASE 2: Notifikasi Permohonan Material ke Grup Gudang
 */
function templatePermohonanMaterial({ tugas, permohonan, items = [], teknisiNama = 'Teknisi Lapangan', baseUrl = null }) {
  const defaultFrontend = (baseUrl || getAppFrontendUrl()).replace(/\/+$/, '');
  const daftarItems = items.length > 0
    ? items.map(i => `• <b>${esc(i.nama_barang || i.item?.nama_barang || i.nama)}</b>: ${i.jumlah || i.jumlah_minta} ${esc(i.satuan || i.item?.satuan || 'pcs')}`).join('\n')
    : '• 150 meter Kabel FO Dropcore 1-Core\n• 1 unit Modem ONT ZTE F670L\n• 1 set Roset Optik & Pigtail';

  const tiketUrl = `${defaultFrontend}/tiket/${tugas?.id || permohonan?.tugas_id}`;

  return `
📦 <b>[TELKOM AKSES — LOGISTIK GUDANG STO PAYAKUMBUH]</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔖 <b>PERMOHONAN MATERIAL KERJA LAPANGAN</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔖 <b>No. Permohonan:</b> #${permohonan?.id || 'REQ-01'}
📋 <b>Terkait Tiket:</b> #${tugas?.id || permohonan?.tugas_id}
👷 <b>Teknisi Pemohon:</b> <b>${esc(teknisiNama)}</b>
👤 <b>Pelanggan:</b> ${esc(tugas?.pelanggan_nama || 'Pelanggan IndiHome')}
📍 <b>Lokasi Pemasangan:</b> ${esc(tugas?.lokasi || 'Payakumbuh')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 <b>Daftar Kebutuhan Material:</b>
${daftarItems}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Petugas Gudang silakan periksa fisik barang, lakukan verifikasi Serial Number (SN) ONT, dan setujui serah terima pada portal gudang:
👉 <a href="${tiketUrl}">${tiketUrl}</a>
`.trim();
}

/**
 * FASE 3: Konfirmasi Rilis Barang & Binding SN ONT (Status: In-Transit)
 */
function templateRilisBarang({ tugas, snOnt = 'ZTEGC8B90112', petugasGudang = 'Siti Rahmawati' }) {
  return `
✅ <b>[TELKOM AKSES — SERAH TERIMA GUDANG STO PAYAKUMBUH]</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 <b>MATERIAL RESMI DIRILIS KEPADA TEKNISI</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 <b>No. Tiket:</b> #${tugas.id}
👤 <b>Pelanggan:</b> ${esc(tugas.pelanggan_nama || 'Pelanggan IndiHome')}
🏢 <b>Petugas Gudang:</b> ${esc(petugasGudang)}
🏷️ <b>SN ONT Terikat:</b> <code>${esc(snOnt)}</code>
📦 <b>Status Material:</b> <pre>IN-TRANSIT (Dibawa Teknisi Menuju Lokasi)</pre>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stok gudang telah terpotong otomatis di database Supabase Cloud.
Teknisi dipersilakan menuju ke lokasi instalasi pelanggan & lakukan Check-In.
`.trim();
}

/**
 * FASE 4: Notifikasi Check-In Teknisi di Lokasi Pelanggan
 */
function templateCheckIn({ tugas, teknisiNama = 'Ahmad Fadli', latitude, longitude, waktuWib }) {
  const now = waktuWib || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return `
📍 <b>[TELKOM AKSES — DISPATCH LAPANGAN STO PAYAKUMBUH]</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>TEKNISI TIBA DI LOKASI PELANGGAN (CHECK-IN)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 <b>No. Tiket:</b> #${tugas.id}
👷 <b>Teknisi Lapangan:</b> <b>${esc(teknisiNama)}</b>
👤 <b>Pelanggan:</b> ${esc(tugas.pelanggan_nama || 'Pelanggan IndiHome')}
🕒 <b>Waktu Tiba:</b> ${now}
📌 <b>Titik Koordinat:</b> <code>${latitude}, ${longitude}</code>
🗺️ <b>Peta Lokasi:</b> <a href="${mapsUrl}">Google Maps Lokasi</a>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: Teknisi telah tiba di lokasi. Memulai penarikan dropcore dari ODP, splicing optik, dan pengukuran redaman OPM.
`.trim();
}

/**
 * FASE 5: Closing BASTP Digital & WebGIS Magic Auto-Update
 */
function templateClosingBastp({ tugas, odp, redamanDbm = -18.5, snOnt = 'ZTEGC8B90112', bastpNo, portBaru, kapasitasPort, statusOdp }) {
  const noSurat = bastpNo || `BASTP/TA-PYK/2026/${String(tugas.id).padStart(4, '0')}`;
  const statusIcon = statusOdp === 'Penuh' ? '🔴' : statusOdp === 'Hampir Penuh' ? '🟡' : '🟢';

  return `
🎉 <b>[TELKOM AKSES — CLOSING DISPATCH STO PAYAKUMBUH]</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ <b>PEKERJAAN SELESAI & TIKET DITUTUP (CLOSED)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 <b>No. BASTP:</b> <code>${noSurat}</code>
📋 <b>No. Tiket:</b> #${tugas.id} (${esc(tugas.jenis_kerja || 'Pasang Baru IndiHome')})
👤 <b>Pelanggan:</b> ${esc(tugas.pelanggan_nama || 'Pelanggan IndiHome')}
📶 <b>Kualitas Redaman OPM:</b> <b>${redamanDbm} dBm</b> (QC Telkom PASS ✓)
🏷️ <b>Status Modem ONT:</b> <code>${esc(snOnt)}</code> &rarr; <b>ACTIVE (Terpasang di Rumah Pelanggan)</b>
✍️ <b>Tanda Tangan Pelanggan:</b> Terverifikasi Digital di Layar HP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>SINKRONISASI ASSET WEBGIS REAL-TIME:</b>
🔌 <b>Titik ODP:</b> <b>${esc(odp?.kode_odp || tugas.odp_kode || 'ODP-PYK-FA/001')}</b>
📊 <b>Port Terpakai:</b> ${portBaru} / ${kapasitasPort} Port
${statusIcon} <b>Status Indikator WebGIS:</b> <b>${String(statusOdp).toUpperCase()}</b>

<i>Laporan audit rekonsiliasi material dan BASTP digital telah tersimpan di sistem.</i>
`.trim();
}

module.exports = {
  BOT_TOKEN,
  esc,
  kirimKeGrup,
  sendTelegramMessage,
  getRecentUpdates,
  addChatRecipient,
  getAllRecipients,
  templateTiketBaru,
  buildInlineKeyboardTiket,
  templatePermohonanMaterial,
  templateRilisBarang,
  templateCheckIn,
  templateClosingBastp,
  handleTelegramCallbackQuery
};

