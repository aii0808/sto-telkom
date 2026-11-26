const supabase = require('../config/supabaseClient');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const telegramService = require('../services/telegramService');

// 1. Ambil semua permohonan (dengan detail barang & relasi tugas)
exports.getAllPermohonan = async (req, res) => {
  const { data, error } = await supabase
    .from('permohonan')
    .select(`
      *,
      detail_permohonan (
        id,
        barang_id,
        jumlah_minta,
        barang:barang_id ( id, nama_barang, satuan, stok )
      ),
      tugas:tugas_id (
        id,
        jenis_kerja,
        lokasi,
        status,
        teknisi_id,
        teknisi:teknisi_id ( id, nama_lengkap )
      )
    `)
    .order('id', { ascending: false });

  if (error) {
    return errorResponse(res, 500, 'Gagal mengambil data permohonan material', error.message);
  }

  return successResponse(res, 200, 'Data permohonan material berhasil diambil', data, { permohonan: data });
};

// 2. Teknisi ajukan permohonan barang (mendukung batch multi-tiket & single ticket)
exports.createPermohonan = async (req, res) => {
  const { tugas_id, tugas_ids, barang } = req.body;

  // Kumpulkan seluruh target tugas ID dari payload (baik single tugas_id maupun array tugas_ids)
  const rawIds = Array.isArray(tugas_ids) && tugas_ids.length > 0 ? tugas_ids : (tugas_id ? [tugas_id] : []);
  const targetTugasIds = Array.from(new Set(rawIds.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n) && n > 0)));

  if (targetTugasIds.length === 0 || !barang || !Array.isArray(barang) || barang.length === 0) {
    return errorResponse(res, 400, 'tugas_id / tugas_ids dan barang wajib diisi');
  }

  // Status Guard: Periksa apakah ada targetTugasIds yang sudah memiliki permohonan aktif ('Pending' atau 'Approved')
  const { data: activeExisting, error: errCheckActive } = await supabase
    .from('permohonan')
    .select('id, tugas_id, status')
    .in('tugas_id', targetTugasIds)
    .in('status', ['Pending', 'Approved']);

  if (errCheckActive) {
    return errorResponse(res, 500, 'Gagal memeriksa status permohonan aktif', errCheckActive.message);
  }

  if (activeExisting && activeExisting.length > 0) {
    const blockedIds = Array.from(new Set(activeExisting.map(p => p.tugas_id))).join(', #');
    return errorResponse(res, 400, `Tiket #${blockedIds} sudah memiliki permohonan material yang sedang diproses`);
  }

  const now = new Date().toISOString();
  const permohonanRows = targetTugasIds.map((tid) => ({
    tugas_id: tid,
    status: 'Pending',
    waktu_request: now,
  }));

  // Batch insert ke tabel permohonan untuk semua tiket yang dipilih
  const { data: createdPermohonans, error: errPermohonan } = await supabase
    .from('permohonan')
    .insert(permohonanRows)
    .select();

  if (errPermohonan || !createdPermohonans || createdPermohonans.length === 0) {
    return errorResponse(res, 500, 'Gagal membuat permohonan material', errPermohonan?.message);
  }

  // Insert detail barang untuk setiap permohonan tiket yang dibuat
  const detailRows = [];
  createdPermohonans.forEach((p) => {
    barang.forEach((item) => {
      detailRows.push({
        permohonan_id: p.id,
        barang_id: parseInt(item.barang_id, 10),
        jumlah_minta: parseInt(item.jumlah_minta, 10),
      });
    });
  });

  const { data: detail, error: errDetail } = await supabase
    .from('detail_permohonan')
    .insert(detailRows)
    .select();

  if (errDetail) {
    return errorResponse(res, 500, 'Gagal menyimpan detail barang', errDetail.message);
  }

  // Update status seluruh tugas terkait menjadi Progress dan tetapkan teknisi_id jika dikirim
  const taskUpdatePayload = { status: 'Progress' };
  if (req.body.teknisi_id) {
    const techId = parseInt(req.body.teknisi_id, 10);
    if (!isNaN(techId) && techId > 0) {
      taskUpdatePayload.teknisi_id = techId;
    }
  }
  await supabase
    .from('tugas')
    .update(taskUpdatePayload)
    .in('id', targetTugasIds);

  // Dispatch Notifikasi Pengajuan Barang Baru ke Telegram Group
  try {
    let bItems = [];
    try {
      const barangIds = barang.map(b => parseInt(b.barang_id, 10)).filter(n => !isNaN(n));
      if (barangIds.length > 0) {
        const { data: fetchedItems } = await supabase.from('barang').select('id, nama_barang, satuan').in('id', barangIds);
        if (Array.isArray(fetchedItems)) bItems = fetchedItems;
      }
    } catch { /* gunakan fallback ID item jika query barang gagal */ }

    const enrichedItems = barang.map(b => {
      const match = bItems.find(x => x.id === parseInt(b.barang_id, 10));
      return {
        barang_id: b.barang_id,
        nama_barang: match ? match.nama_barang : (b.nama_barang || `Barang #${b.barang_id}`),
        jumlah_minta: b.jumlah_minta,
        satuan: match ? match.satuan : (b.satuan || 'pcs')
      };
    });

    let tugasData = { id: targetTugasIds[0] };
    try {
      const { data: tRow } = await supabase.from('tugas').select('id, jenis_kerja, lokasi').eq('id', targetTugasIds[0]).single();
      if (tRow) tugasData = tRow;
    } catch { /* gunakan ID tugas minimal */ }

    const pemohonNama = req.body.teknisi_nama || req.body.nama || 'Teknisi Lapangan';
    const tgMsg = telegramService.templatePermohonanMaterial({
      tugas: tugasData,
      permohonan: createdPermohonans[0],
      permohonanIds: createdPermohonans.map(p => p.id),
      tugasIds: targetTugasIds,
      items: enrichedItems,
      teknisiNama: pemohonNama,
      catatan: req.body.catatan || ''
    });

    const tgResult = await telegramService.kirimKeGrup(tgMsg);
    if (tgResult && tgResult.ok === false) {
      console.error('[TelegramBot Error]:', tgResult.description || tgResult.error);
    }
  } catch (tgErr) {
    console.error('[TelegramBot Error]:', tgErr.message);
  }

  return successResponse(res, 201, `Permohonan untuk ${targetTugasIds.length} tiket berhasil diajukan`, {
    permohonan: createdPermohonans[0],
    permohonanList: createdPermohonans,
    detail,
  });
};

// 3. Pimpinan lihat semua permohonan yang masih Pending
exports.getPermohonanPending = async (req, res) => {
  const { data, error } = await supabase
    .from('permohonan')
    .select(`
      *,
      detail_permohonan (
        id,
        barang_id,
        jumlah_minta,
        barang:barang_id ( id, nama_barang, satuan, stok )
      ),
      tugas:tugas_id (
        id,
        jenis_kerja,
        lokasi,
        teknisi_id,
        teknisi:teknisi_id ( id, nama_lengkap )
      )
    `)
    .eq('status', 'Pending')
    .order('id', { ascending: false });

  if (error) {
    return errorResponse(res, 500, 'Gagal mengambil data permohonan pending', error.message);
  }

  return successResponse(res, 200, 'Data permohonan pending berhasil diambil', data, { permohonan: data });
};

// 4. Pimpinan approve permohonan material
exports.approvePermohonan = async (req, res) => {
  const { id } = req.params;

  const parsedId = parseInt(id, 10);
  if (!id || isNaN(parsedId)) {
    return errorResponse(res, 400, 'ID permohonan tidak valid');
  }

  // Validasi: pastikan permohonan ada dan statusnya saat ini adalah 'Pending'
  const { data: existingPermohonan, error: errFindPerm } = await supabase
    .from('permohonan')
    .select('id, status')
    .eq('id', parsedId)
    .single();

  if (errFindPerm || !existingPermohonan) {
    return errorResponse(res, 404, 'Permohonan tidak ditemukan');
  }

  if (existingPermohonan.status !== 'Pending') {
    return errorResponse(res, 400, 'Permohonan sudah disetujui / diproses sebelumnya');
  }

  const { data: permohonanUpdated, error: errUpdatePermohonan } = await supabase
    .from('permohonan')
    .update({ status: 'Approved' })
    .eq('id', parsedId)
    .select()
    .single();

  if (errUpdatePermohonan) {
    return errorResponse(res, 500, 'Gagal update status permohonan', errUpdatePermohonan.message);
  }

  return successResponse(res, 200, 'Permohonan material disetujui pimpinan', permohonanUpdated, {
    permohonan: permohonanUpdated,
  });
};

// 5. Pimpinan tolak permohonan material
exports.rejectPermohonan = async (req, res) => {
  const { id } = req.params;
  const { catatan } = req.body;

  const parsedId = parseInt(id, 10);
  if (!id || isNaN(parsedId)) {
    return errorResponse(res, 400, 'ID permohonan tidak valid');
  }

  const { data: permohonanUpdated, error: errUpdatePermohonan } = await supabase
    .from('permohonan')
    .update({ status: 'Rejected' })
    .eq('id', parsedId)
    .select()
    .single();

  if (errUpdatePermohonan) {
    return errorResponse(res, 500, 'Gagal menolak permohonan', errUpdatePermohonan.message);
  }

  const message = catatan ? `Permohonan material ditolak: ${catatan}` : 'Permohonan material ditolak';
  return successResponse(res, 200, message, permohonanUpdated, {
    permohonan: permohonanUpdated,
    catatan: catatan || null
  });
};

// 6. Gudang rilis barang fisik & potong stok otomatis
exports.releasePermohonan = async (req, res) => {
  const { id } = req.params;

  const parsedId = parseInt(id, 10);
  if (!id || isNaN(parsedId)) {
    return errorResponse(res, 400, 'ID permohonan tidak valid');
  }

  // 1. Validasi status permohonan terlebih dahulu (Idempotency check: cegah double stock deduction)
  const { data: existingPermohonan, error: errFindPerm } = await supabase
    .from('permohonan')
    .select('id, status, tugas_id')
    .eq('id', parsedId)
    .single();

  if (errFindPerm || !existingPermohonan) {
    return errorResponse(res, 404, 'Permohonan tidak ditemukan');
  }

  if (existingPermohonan.status === 'Released') {
    return errorResponse(res, 400, 'Material untuk permohonan ini sudah pernah dirilis/diserahkan sebelumnya');
  }

  if (existingPermohonan.status === 'Rejected') {
    return errorResponse(res, 400, 'Permohonan material ini telah ditolak oleh Pimpinan dan tidak dapat dirilis');
  }

  // Ambil detail item permohonan
  const { data: detail, error: errDetail } = await supabase
    .from('detail_permohonan')
    .select('barang_id, jumlah_minta')
    .eq('permohonan_id', parsedId);

  if (errDetail) {
    return errorResponse(res, 500, 'Gagal mengambil detail permohonan', errDetail.message);
  }

  if (!detail || detail.length === 0) {
    return errorResponse(res, 404, 'Detail permohonan tidak ditemukan');
  }

  // 2. Cek ketersediaan stok fisik seluruh item sebelum melakukan pemotongan
  const releasedItemsMeta = [];
  for (const item of detail) {
    const qtyMinta = parseInt(item.jumlah_minta, 10);
    if (isNaN(qtyMinta) || qtyMinta <= 0) {
      return errorResponse(res, 400, `Jumlah permintaan tidak valid untuk barang ID ${item.barang_id}`);
    }

    const { data: barang, error: errBarang } = await supabase
      .from('barang')
      .select('stok, nama_barang, satuan')
      .eq('id', item.barang_id)
      .single();

    if (errBarang || !barang) {
      return errorResponse(res, 404, `Barang ID ${item.barang_id} tidak ditemukan di master inventaris`);
    }

    if (Number(barang.stok) < qtyMinta) {
      return errorResponse(
        res,
        400,
        `Stok gudang tidak mencukupi untuk ${barang.nama_barang} (Tersedia: ${barang.stok} ${barang.satuan}, Diminta: ${qtyMinta} ${barang.satuan})`
      );
    }

    releasedItemsMeta.push({
      barang_id: item.barang_id,
      nama_barang: barang.nama_barang,
      jumlah_minta: qtyMinta,
      satuan: barang.satuan
    });
  }

  // 3. Potong stok real di tabel barang secara berurutan
  for (const item of detail) {
    const qtyMinta = parseInt(item.jumlah_minta, 10);
    const { data: barang, error: errGetBarang } = await supabase
      .from('barang')
      .select('stok, nama_barang')
      .eq('id', item.barang_id)
      .single();

    if (errGetBarang || !barang || Number(barang.stok) < qtyMinta) {
      return errorResponse(res, 400, `Gagal memotong stok: stok fisik ${barang?.nama_barang || 'Item #' + item.barang_id} tidak mencukupi`);
    }

    const stokBaru = Math.max(0, Number(barang.stok) - qtyMinta);

    const { error: errUpdateStok } = await supabase
      .from('barang')
      .update({ stok: stokBaru })
      .eq('id', item.barang_id);

    if (errUpdateStok) {
      return errorResponse(res, 500, 'Gagal memotong stok barang di database', errUpdateStok.message);
    }
  }

  // Update status permohonan menjadi Released
  const { data: permohonanUpdated, error: errUpdatePermohonan } = await supabase
    .from('permohonan')
    .update({ status: 'Released' })
    .eq('id', parsedId)
    .select()
    .single();

  if (errUpdatePermohonan) {
    return errorResponse(res, 500, 'Gagal update status rilis permohonan', errUpdatePermohonan.message);
  }

  // FASE 3: Dispatch Notifikasi Rilis Barang & Binding SN ONT (Status: In-Transit) ke Telegram
  try {
    const snOnt = (req.body.sn_ont && String(req.body.sn_ont).trim()) ? String(req.body.sn_ont).trim() : '-';
    const petugasGudang = (req.body.petugas_gudang && String(req.body.petugas_gudang).trim())
      ? String(req.body.petugas_gudang).trim()
      : 'Petugas Gudang STO';

    let tugasData = { id: permohonanUpdated?.tugas_id || existingPermohonan.tugas_id };
    if (permohonanUpdated?.tugas_id) {
      try {
        const { data: tData } = await supabase.from('tugas').select('*').eq('id', permohonanUpdated.tugas_id).single();
        if (tData) tugasData = tData;
      } catch { /* abaikan */ }
    }

    const tgMsg = telegramService.templateRilisBarang({
      tugas: tugasData,
      permohonan: permohonanUpdated,
      items: releasedItemsMeta,
      snOnt,
      petugasGudang
    });
    const tgResult = await telegramService.sendTelegramMessage(tgMsg);
    if (!tgResult.success && !tgResult.disabled) {
      console.error('[TelegramBot Error]: Rilis barang broadcast gagal:', tgResult.details || tgResult.error);
    }
  } catch (tgErr) {
    console.error('[TelegramBot Error]:', tgErr.message);
  }

  return successResponse(res, 200, 'Barang berhasil dirilis & stok gudang otomatis terpotong', permohonanUpdated, {
    permohonan: permohonanUpdated,
  });
};