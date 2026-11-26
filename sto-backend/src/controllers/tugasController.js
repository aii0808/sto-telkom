const supabase = require('../config/supabaseClient');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const telegramService = require('../services/telegramService');
const odpController = require('./odpController');

// 1. Ambil semua tugas (dukung filter status)
exports.getAllTugas = async (req, res) => {
  const { status, teknisi_id } = req.query;

  let query = supabase
    .from('tugas')
    .select(`
      *,
      pimpinan:pimpinan_id ( id, nama_lengkap, email ),
      teknisi:teknisi_id ( id, nama_lengkap, email )
    `)
    .order('id', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (teknisi_id) {
    query = query.eq('teknisi_id', parseInt(teknisi_id, 10));
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse(res, 500, 'Gagal mengambil data tiket tugas', error.message);
  }

  return successResponse(res, 200, 'Daftar tiket tugas berhasil diambil', data, { tugas: data });
};

// 2. Pimpinan membuat tugas baru untuk teknisi (Sekali Klik Dual Broadcast: Supabase & Telegram)
exports.createTugas = async (req, res) => {
  const {
    pimpinan_id,
    teknisi_id,
    jenis_kerja,
    lokasi,
    pelanggan_nama,
    pelanggan_telp,
    keterangan,
    catatan,
    status,
    odp_id,
    odp_kode
  } = req.body;

  // validasi input dasar
  if (!pimpinan_id || !jenis_kerja || !lokasi) {
    return errorResponse(res, 400, 'Pimpinan ID, jenis pekerjaan, dan lokasi wajib diisi');
  }

  const parsedPimpinanId = parseInt(pimpinan_id, 10);
  const parsedTeknisiId = teknisi_id ? parseInt(teknisi_id, 10) : null;
  const parsedOdpId = odp_id ? parseInt(odp_id, 10) : null;

  // Format informasi tambahan pelanggan & catatan ke dalam kolom lokasi sesuai skema tabel tugas
  const extraInfo = [];
  if (pelanggan_nama) extraInfo.push(`Pelanggan: ${pelanggan_nama}`);
  if (pelanggan_telp) extraInfo.push(`Telp: ${pelanggan_telp}`);
  const note = keterangan || catatan;
  if (note) extraInfo.push(`Catatan: ${note}`);

  const fullLokasi = extraInfo.length > 0
    ? `${lokasi} (${extraInfo.join(' | ')})`
    : lokasi;

  const insertPayload = {
    pimpinan_id: parsedPimpinanId,
    teknisi_id: parsedTeknisiId,
    jenis_kerja,
    lokasi: fullLokasi,
    status: status || 'menunggu',
    broadcast_status: 'sent'
  };

  if (parsedOdpId && !isNaN(parsedOdpId)) {
    insertPayload.odp_id = parsedOdpId;
  }

  let { data, error } = await supabase
    .from('tugas')
    .insert([insertPayload])
    .select()
    .single();

  // Fallback jika schema lama memiliki constraint NOT NULL pada teknisi_id
  if (error && error.message && error.message.toLowerCase().includes('not-null')) {
    insertPayload.teknisi_id = parsedTeknisiId || 2;
    const retry = await supabase.from('tugas').insert([insertPayload]).select().single();
    data = retry.data;
    error = retry.error;
  }

  // Fallback jika kolom odp_id belum ada pada view tertentu
  if (error && error.message && error.message.toLowerCase().includes('odp_id')) {
    delete insertPayload.odp_id;
    const retry = await supabase.from('tugas').insert([insertPayload]).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    return errorResponse(res, 500, 'Gagal menyimpan data tugas ke Supabase', error?.message);
  }

  // FASE DUAL BROADCAST: Generate Magic Link Token di auth_tokens & Siarkan ke Telegram
  let magicUrl = '';
  let token = '';
  try {
    const crypto = require('crypto');
    token = crypto.randomBytes(24).toString('hex');
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const assignedUserId = parsedTeknisiId || null;

    if (assignedUserId) {
      await supabase.from('auth_tokens').insert([{
        token,
        user_id: assignedUserId,
        tugas_id: data.id,
        expired_at: expiredAt,
        is_used: false
      }]);
    }

    const baseUrl = (process.env.APP_FRONTEND_URL || 'https://sto-telkom.vercel.app').replace(/\/+$/, '');
    magicUrl = `${baseUrl}/tiket/${data.id}`;

    let odp = odp_kode || null;
    if (!odp && parsedOdpId && !isNaN(parsedOdpId)) {
      try {
        const { data: odpRow } = await supabase
          .from('odp')
          .select('kode_odp')
          .eq('id', parsedOdpId)
          .single();
        if (odpRow?.kode_odp) odp = odpRow.kode_odp;
      } catch { /* abaikan lookup jika odp_id tidak ditemukan */ }
    }
    odp = odp || 'Titik ODP Belum Ditentukan';

    // Ambil nama teknisi jika dipilih langsung oleh pimpinan
    let techName = null;
    if (parsedTeknisiId) {
      try {
        const { data: techUser } = await supabase
          .from('users')
          .select('nama_lengkap')
          .eq('id', parsedTeknisiId)
          .single();
        if (techUser) techName = techUser.nama_lengkap;
      } catch { /* ignore */ }
    }

    const pesanTiket = telegramService.templateTiketBaru({
      tugas: {
        ...data,
        lokasi,
        pelanggan_nama: pelanggan_nama || null,
        pelanggan_telp: pelanggan_telp || null,
        keterangan: note || null,
        odp_kode: odp
      },
      baseUrl,
      magicUrl,
      mode: parsedTeknisiId ? 'assigned' : 'open',
      teknisiNama: techName
    });

    const inlineKeyboard = !parsedTeknisiId
      ? telegramService.buildInlineKeyboardTiket({ tugas: data, magicUrl })
      : {
          inline_keyboard: [
            [
              { text: '🔍 BUKA DETAIL TIKET', url: magicUrl }
            ]
          ]
        };

    // FASE DUAL BROADCAST: Siarkan ke Telegram secara asinkron (non-blocking) agar response API super cepat (<200ms)
    telegramService.kirimKeGrup(pesanTiket, {
      reply_markup: inlineKeyboard
    }).then(async (tgResult) => {
      if (tgResult && tgResult.ok === false) {
        console.error('[TelegramBot Error]:', tgResult.description || tgResult.error);
      }
      if (tgResult && tgResult.result?.message_id) {
        try {
          await supabase.from('tugas').update({
            telegram_message_id: String(tgResult.result.message_id)
          }).eq('id', data.id);
        } catch (dbUpdErr) {
          console.error('[TelegramBot Error]: Gagal simpan telegram_message_id:', dbUpdErr.message);
        }
      }
    }).catch((tgErr) => {
      console.error('[TelegramBot Error]:', tgErr.message);
    });
  } catch (tgErr) {
    console.error('[TelegramBot Error]:', tgErr.message);
  }

  return successResponse(res, 201, 'Tugas berhasil diterbitkan & disiarkan ke Telegram!', {
    ...data,
    magic_url: magicUrl,
    magic_token: token
  }, { tugas: data });
};

// 3. Edit / Perbarui Tiket Penugasan (CRUD Update)
exports.updateTugas = async (req, res) => {
  const { id } = req.params;
  const { jenis_kerja, lokasi, status, teknisi_id, foto_bukti } = req.body;

  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return errorResponse(res, 400, 'ID tugas tidak valid');
  }

  // 1. Ambil status tiket saat ini di database
  const { data: existingTugas, error: errFind } = await supabase
    .from('tugas')
    .select('id, status, teknisi_id')
    .eq('id', parsedId)
    .single();

  if (errFind || !existingTugas) {
    return errorResponse(res, 404, 'Tiket tugas tidak ditemukan');
  }

  const isDoneStatus = (st) => {
    const s = String(st || '').toLowerCase().trim();
    return s === 'done' || s === 'closed' || s === 'selesai';
  };

  // Validasi Idempotency: Tiket yang sudah Done/Closed tidak dapat diubah statusnya menjadi progress atau open kembali
  if (isDoneStatus(existingTugas.status)) {
    if (status !== undefined && !isDoneStatus(status)) {
      return errorResponse(res, 400, 'Tiket yang sudah selesai (Done/Closed) tidak dapat diubah kembali ke status aktif');
    }
  }

  const updatePayload = {};
  if (jenis_kerja !== undefined) updatePayload.jenis_kerja = jenis_kerja;
  if (lokasi !== undefined) updatePayload.lokasi = lokasi;
  if (status !== undefined) updatePayload.status = status;
  if (teknisi_id !== undefined) updatePayload.teknisi_id = teknisi_id ? parseInt(teknisi_id, 10) : null;
  if (foto_bukti !== undefined) updatePayload.foto_bukti = foto_bukti;

  if (Object.keys(updatePayload).length === 0) {
    return errorResponse(res, 400, 'Tidak ada data tugas yang diperbarui');
  }

  const { data, error } = await supabase
    .from('tugas')
    .update(updatePayload)
    .eq('id', parsedId)
    .select()
    .single();

  if (error) {
    return errorResponse(res, 500, 'Gagal memperbarui tiket tugas', error.message);
  }

  return successResponse(res, 200, 'Tiket tugas berhasil diperbarui', data, { tugas: data });
};

// 4. Hapus / Batalkan Tiket Penugasan (CRUD Delete)
exports.deleteTugas = async (req, res) => {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId) || parsedId <= 0) {
    return errorResponse(res, 400, 'ID tugas tidak valid');
  }

  // Bersihkan ketergantungan relasi (permohonan & detail) agar penghapusan di Supabase tidak terkendala foreign key
  try {
    const { data: perms } = await supabase.from('permohonan').select('id').eq('tugas_id', parsedId);
    if (perms && perms.length > 0) {
      const permIds = perms.map(p => p.id);
      await supabase.from('detail_permohonan').delete().in('permohonan_id', permIds);
      await supabase.from('permohonan').delete().eq('tugas_id', parsedId);
    }
  } catch (cascadeErr) {
    console.info('[deleteTugas] Cascade notice:', cascadeErr.message);
  }

  const { data, error } = await supabase
    .from('tugas')
    .delete()
    .eq('id', parsedId)
    .select();

  if (error) {
    return errorResponse(res, 500, 'Gagal menghapus tiket tugas', error.message);
  }

  return successResponse(res, 200, 'Tiket tugas berhasil dihapus', data);
};

// 5. Teknisi mengklaim/mengambil tugas dari pool terbuka
exports.claimTugas = async (req, res) => {
  const { id } = req.params;
  const { teknisi_id } = req.body;

  const parsedId = parseInt(id, 10);
  if (!id || isNaN(parsedId) || parsedId <= 0) {
    return errorResponse(res, 400, 'ID tugas tidak valid');
  }

  const parsedTeknisiId = parseInt(teknisi_id, 10);
  if (!teknisi_id || isNaN(parsedTeknisiId) || parsedTeknisiId <= 0) {
    return errorResponse(res, 400, 'Teknisi ID wajib disertakan dan harus berupa angka valid');
  }

  const isDoneStatus = (st) => {
    const s = String(st || '').toLowerCase().trim();
    return s === 'done' || s === 'closed' || s === 'selesai';
  };

  // 1. Ambil data tiket tugas saat ini
  const { data: existingTugas, error: errFind } = await supabase
    .from('tugas')
    .select('*')
    .eq('id', parsedId)
    .single();

  if (errFind || !existingTugas) {
    return errorResponse(res, 404, 'Tugas tidak ditemukan');
  }

  // Validasi 1: Jangan izinkan klaim tiket yang sudah selesai dikerjakan
  if (isDoneStatus(existingTugas.status)) {
    return errorResponse(res, 400, 'Tugas sudah selesai dikerjakan (Done) dan tidak dapat diklaim kembali');
  }

  // Idempotency: Jika teknisi yang sama mengirim request klaim ulang untuk tiketnya sendiri
  if (existingTugas.teknisi_id && Number(existingTugas.teknisi_id) === parsedTeknisiId) {
    return successResponse(res, 200, 'Tiket sudah Anda klaim sebelumnya', existingTugas, { tugas: existingTugas });
  }

  // Validasi 2: Pastikan tiket berstatus 'menunggu' / 'open' dan belum ada teknisi yang mengambil
  const rawStatus = String(existingTugas.status || '').toLowerCase().trim();
  const isAvailableStatus = rawStatus === 'menunggu' || rawStatus === 'open';

  if (existingTugas.teknisi_id || !isAvailableStatus) {
    return errorResponse(res, 409, 'Tiket ini sudah diklaim oleh teknisi lain atau sedang dalam proses pengerjaan');
  }

  // 2. Cegah Race Condition via Atomic Condition:
  // Update HANYA jika teknisi_id IS NULL pada database
  const { data, error } = await supabase
    .from('tugas')
    .update({
      teknisi_id: parsedTeknisiId,
      status: 'Progress',
    })
    .eq('id', parsedId)
    .is('teknisi_id', null)
    .select()
    .single();

  if (error || !data) {
    return errorResponse(res, 409, 'Tiket gagal diklaim karena baru saja diambil oleh teknisi lain (Race condition dicegah)');
  }

  // Dual Broadcast update klaim ke Telegram Grup & instruksikan teknisi
  try {
    let techName = 'Teknisi Lapangan';
    const { data: uData } = await supabase
      .from('users')
      .select('nama_lengkap')
      .eq('id', parsedTeknisiId)
      .single();
    if (uData && uData.nama_lengkap) techName = uData.nama_lengkap;

    let odpKode = existingTugas.odp_kode || null;
    if (!odpKode && existingTugas.odp_id) {
      try {
        const { data: odpRow } = await supabase.from('odp').select('kode_odp').eq('id', existingTugas.odp_id).single();
        if (odpRow?.kode_odp) odpKode = odpRow.kode_odp;
      } catch { /* abaikan */ }
    }

    const baseUrl = (process.env.APP_FRONTEND_URL || 'https://sto-telkom.vercel.app').replace(/\/+$/, '');
    const magicLink = `${baseUrl}/tiket/${parsedId}`;
    const broadcastClaim = telegramService.templateKlaimTiket({
      tugas: {
        ...existingTugas,
        id: parsedId,
        odp_kode: odpKode || 'Titik ODP Belum Ditentukan'
      },
      teknisiNama: techName,
      magicLink,
      baseUrl
    });

    const tgResult = await telegramService.kirimKeGrup(broadcastClaim, {
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
    if (tgResult && tgResult.ok === false) {
      console.error('[TelegramBot Error]:', tgResult.description || tgResult.error);
    }
  } catch (tgClaimErr) {
    console.error('[TelegramBot Error]:', tgClaimErr.message);
  }

  return successResponse(res, 200, 'Tugas berhasil diambil oleh teknisi', data, { tugas: data });
};

// 6. Ambil daftar tugas yang masih terbuka (belum diambil teknisi)
exports.getOpenTugas = async (req, res) => {
  const { data, error } = await supabase
    .from('tugas')
    .select('*')
    .or('teknisi_id.is.null,status.eq.Open,status.eq.menunggu')
    .order('id', { ascending: false });

  if (error) {
    return errorResponse(res, 500, 'Gagal mengambil data tugas terbuka', error.message);
  }

  return successResponse(res, 200, 'Data tugas terbuka berhasil diambil', data, { tugas: data });
};

// 7. Teknisi melihat daftar tugas miliknya
exports.getTugasByTeknisi = async (req, res) => {
  const { id } = req.params;

  const parsedId = parseInt(id, 10);
  if (!id || isNaN(parsedId) || parsedId <= 0) {
    return errorResponse(res, 400, 'ID teknisi tidak valid');
  }

  const { data, error } = await supabase
    .from('tugas')
    .select('*')
    .eq('teknisi_id', parsedId)
    .order('id', { ascending: false });

  if (error) {
    return errorResponse(res, 500, 'Gagal mengambil data tugas', error.message);
  }

  return successResponse(res, 200, 'Data tugas berhasil diambil', data, { tugas: data });
};

// 8. Teknisi upload foto bukti & selesaikan tugas
exports.selesaikanTugas = async (req, res) => {
  const { id } = req.params;

  const parsedId = parseInt(id, 10);
  if (!id || isNaN(parsedId) || parsedId <= 0) {
    return errorResponse(res, 400, 'ID tugas tidak valid');
  }

  let fotoUrl = req.body.foto_bukti || null;

  if (req.file) {
    const rawExt = req.file.originalname ? req.file.originalname.split('.').pop() : 'jpg';
    const ext = (rawExt || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const fileName = `tugas-${parsedId}-${Date.now()}.${ext}`;

    const { error: errUpload } = await supabase.storage
      .from('bukti-foto')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (!errUpload) {
      const { data: publicUrlData } = supabase.storage
        .from('bukti-foto')
        .getPublicUrl(fileName);
      fotoUrl = publicUrlData ? publicUrlData.publicUrl : '';
    }
  }

  const updateFields = {
    status: 'Done',
  };
  if (fotoUrl) updateFields.foto_bukti = fotoUrl;

  const { data: tugasUpdated, error: errUpdate } = await supabase
    .from('tugas')
    .update(updateFields)
    .eq('id', parsedId)
    .select()
    .single();

  if (errUpdate) {
    return errorResponse(res, 500, 'Gagal update status tugas', errUpdate.message);
  }

  return successResponse(res, 200, 'Tugas berhasil diselesaikan', tugasUpdated, { tugas: tugasUpdated });
};

// 9. Pimpinan lihat semua tugas yang masih aktif
exports.getTugasAktif = async (req, res) => {
  const { data, error } = await supabase
    .from('tugas')
    .select(`
      id,
      jenis_kerja,
      lokasi,
      status,
      teknisi:teknisi_id ( id, nama_lengkap )
    `)
    .neq('status', 'Done')
    .order('id', { ascending: false });

  if (error) {
    return errorResponse(res, 500, 'Gagal mengambil data tugas aktif', error.message);
  }

  return successResponse(res, 200, 'Data tugas aktif berhasil diambil', data, { tugas: data });
};

// 10. FASE 4: Teknisi Check-In di Lokasi Pelanggan (Catat GPS Satu Kali & Notif Telegram)
exports.checkInTugas = async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude, teknisi_nama } = req.body;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId) || parsedId <= 0) {
    return errorResponse(res, 400, 'ID tugas tidak valid');
  }

  const waktuWib = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const parsedLat = (latitude !== undefined && latitude !== null && latitude !== '' && Number.isFinite(Number(latitude))) ? Number(latitude) : null;
  const parsedLng = (longitude !== undefined && longitude !== null && longitude !== '' && Number.isFinite(Number(longitude))) ? Number(longitude) : null;

  // Ambil detail tugas untuk data notifikasi & validasi status
  let tugasData = { id: parsedId };
  try {
    const { data: tData } = await supabase.from('tugas').select('*').eq('id', parsedId).single();
    if (tData) {
      tugasData = tData;
      const st = String(tData.status || '').toLowerCase().trim();
      if (st === 'done' || st === 'closed' || st === 'selesai') {
        return errorResponse(res, 400, 'Tiket sudah selesai dikerjakan (Done) dan tidak dapat melakukan check-in ulang');
      }
    }
  } catch (errLookup) {
    console.error('[TelegramBot Error]: Lookup tugas checkIn:', errLookup.message);
  }

  // Simpan status In-Progress ke Supabase
  try {
    await supabase.from('tugas').update({
      status: 'In-Progress'
    }).eq('id', parsedId);
  } catch {
    // Ignore fallback
  }

  let tgResult = { success: false };
  try {
    const msg = telegramService.templateCheckIn({
      tugas: tugasData,
      teknisiNama: teknisi_nama || 'Teknisi Lapangan',
      latitude: parsedLat,
      longitude: parsedLng,
      waktuWib
    });
    tgResult = await telegramService.sendTelegramMessage(msg);
    if (!tgResult.success && !tgResult.disabled) {
      console.error('[TelegramBot Error]: Check-in broadcast gagal:', tgResult.details || tgResult.error);
    }
  } catch (tgErr) {
    console.error('[TelegramBot Error]:', tgErr.message);
  }

  return successResponse(res, 200, 'Teknisi berhasil check-in di lokasi pelanggan', {
    tugas_id: parsedId,
    latitude: parsedLat,
    longitude: parsedLng,
    waktu: waktuWib,
    telegram: tgResult
  });
};

// 11. FASE 5: Closing Pekerjaan & Pembaruan ODP WebGIS (Transaksi Database Berantai)
exports.closeTugas = async (req, res) => {
  const { id } = req.params;
  const {
    redaman_dbm,
    foto_ont,
    tanda_tangan_pelanggan,
    sn_ont,
    odp_id,
    odp_kode,
    pelanggan_nama
  } = req.body;

  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return errorResponse(res, 400, 'ID tugas tidak valid');
  }

  const hasValidRedaman =
    redaman_dbm !== undefined &&
    redaman_dbm !== null &&
    redaman_dbm !== '' &&
    !Number.isNaN(parseFloat(redaman_dbm));
  const redaman = hasValidRedaman ? parseFloat(redaman_dbm) : null;
  const sn = (sn_ont && String(sn_ont).trim()) ? String(sn_ont).trim() : '-';
  const bastpNo = `BASTP/TA-PYK/2026/${String(parsedId).padStart(4, '0')}`;

  // Ambil metadata asli tugas dari Supabase
  let existingTugas = null;
  try {
    const { data: tData } = await supabase.from('tugas').select('*').eq('id', parsedId).single();
    if (tData) existingTugas = tData;
  } catch { /* ignore */ }

  // 1. Ubah status tugas menjadi Closed
  try {
    await supabase.from('tugas').update({
      status: 'Closed',
      foto_bukti: foto_ont || null
    }).eq('id', parsedId);
  } catch (err) {
    console.warn('[closeTugas] Supabase update status notice:', err.message);
  }

  // 2. Eksekusi Pembaruan ODP WebGIS jika target ODP tersedia
  const targetOdpId = odp_id || odp_kode || existingTugas?.odp_id || null;
  const updatedOdp = targetOdpId
    ? await odpController.incrementPortOdpInternal(targetOdpId)
    : null;

  // 3. Dispatch notifikasi ringkasan BASTP digital ke Grup Pimpinan di Telegram
  let tgResult = { success: false };
  try {
    const tgMsg = telegramService.templateClosingBastp({
      tugas: {
        ...(existingTugas || {}),
        id: parsedId,
        pelanggan_nama: pelanggan_nama || existingTugas?.pelanggan_nama || null,
        odp_kode: updatedOdp?.kode_odp || odp_kode || 'Titik ODP Belum Ditentukan'
      },
      odp: updatedOdp,
      redamanDbm: redaman,
      snOnt: sn,
      bastpNo,
      portBaru: updatedOdp?.port_terpakai ?? null,
      kapasitasPort: updatedOdp?.kapasitas_port ?? null,
      statusOdp: updatedOdp?.status ?? null,
      tandaTanganPelanggan: Boolean(tanda_tangan_pelanggan)
    });

    tgResult = await telegramService.sendTelegramMessage(tgMsg);
    if (!tgResult.success && !tgResult.disabled) {
      console.error('[TelegramBot Error]: Closing BASTP broadcast gagal:', tgResult.details || tgResult.error);
    }
  } catch (tgErr) {
    console.error('[TelegramBot Error]:', tgErr.message);
  }

  return successResponse(res, 200, 'Tiket berhasil di-close, status ONT Active, dan WebGIS ODP ter-update otomatis!', {
    tugas_id: parsedId,
    status: 'Closed',
    sn_ont: sn,
    sn_status: sn !== '-' ? 'Active' : null,
    redaman_dbm: redaman,
    tanda_tangan_pelanggan: Boolean(tanda_tangan_pelanggan),
    bastp_no: bastpNo,
    odp_updated: updatedOdp,
    telegram: tgResult
  });
};