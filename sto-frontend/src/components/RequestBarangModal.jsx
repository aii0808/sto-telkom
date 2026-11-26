import { useState, useEffect } from 'react';
import { Package, Plus, Trash2, X, CheckSquare, Square, ShieldAlert, Layers } from 'lucide-react';
import api from '../api/axiosInstance';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

function RequestBarangModal({ tugasId, onClose, onSuccess }) {
  const { isDark } = useTheme();
  const {
    barang: localBarang,
    tugas = [],
    currentUser,
    saldoTeknisi,
    requestMaterial,
    showToast
  } = useApp();

  const [barangList, setBarangList] = useState(localBarang || []);
  const [selectedBarang, setSelectedBarang] = useState('');
  const [jumlah, setJumlah] = useState('1');
  const [keranjang, setKeranjang] = useState([]);
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ambil tiket aktif yang dimiliki oleh teknisi yang sedang login
  const isDoneStatus = (status) => {
    const st = String(status || '').toLowerCase().trim();
    return st === 'done' || st === 'selesai' || st === 'closed';
  };

  const currentTechId = Number(currentUser?.id || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}')?.id : null) || 2);
  const myActiveTasks = tugas.filter(
    (t) => Number(t.teknisi_id) === currentTechId && !isDoneStatus(t.status)
  );

  // State multi-ticket / batch selection
  const initialTaskIds = tugasId
    ? [Number(tugasId)]
    : myActiveTasks.length > 0
    ? [myActiveTasks[0].id]
    : [];
  const [selectedTaskIds, setSelectedTaskIds] = useState(initialTaskIds);

  useEffect(() => {
    // Fallback to localBarang
    if (localBarang && localBarang.length > 0) {
      setBarangList(localBarang);
    }

    // Try API
    api.get('/barang')
      .then((res) => {
        if (res.data?.barang && res.data.barang.length > 0) {
          setBarangList(res.data.barang);
        }
      })
      .catch(() => {});
  }, [localBarang]);

  const toggleTaskSelection = (id) => {
    const numId = Number(id);
    setSelectedTaskIds((prev) => {
      if (prev.includes(numId)) {
        if (prev.length === 1) {
          showToast('Minimal 1 tiket tugas harus dipilih untuk permohonan material', 'error');
          return prev;
        }
        return prev.filter((x) => x !== numId);
      } else {
        return [...prev, numId];
      }
    });
  };

  const handleTambah = () => {
    if (!selectedBarang) {
      setError('Silakan pilih material terlebih dahulu dari inventaris gudang');
      return;
    }

    const parsedJumlah = parseInt(jumlah, 10);
    if (isNaN(parsedJumlah) || parsedJumlah <= 0) {
      setError('Kuantitas (Qty) material harus berupa angka minimal 1');
      return;
    }

    const item = barangList.find((b) => Number(b.id) === Number(selectedBarang));
    if (!item) {
      setError('Material yang dipilih tidak ditemukan');
      return;
    }

    if ((Number(item.stok) || 0) <= 0) {
      setError(`Stok ${item.nama_barang} habis (0 ${item.satuan})! Tidak dapat diajukan.`);
      return;
    }

    // Periksa apakah sudah ada di keranjang: jika sudah ada, tambahkan qty (cegah duplikasi baris)
    const existingIndex = keranjang.findIndex((k) => Number(k.barang_id) === Number(item.id));
    if (existingIndex >= 0) {
      setKeranjang((prev) =>
        prev.map((k, idx) =>
          idx === existingIndex
            ? { ...k, jumlah_minta: k.jumlah_minta + parsedJumlah }
            : k
        )
      );
    } else {
      setKeranjang((prev) => [
        ...prev,
        {
          barang_id: item.id,
          nama_barang: item.nama_barang,
          satuan: item.satuan,
          jumlah_minta: parsedJumlah
        },
      ]);
    }

    // Reset dropdown kembali ke placeholder "Pilih Material..." dan kembalikan Qty ke 1 secara konsisten
    setSelectedBarang('');
    setJumlah('1');
    setError('');
  };

  const handleHapusItem = (idx) => {
    setKeranjang(keranjang.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (selectedTaskIds.length === 0) {
      setError('Pilih minimal 1 pekerjaan/pelanggan untuk permohonan ini');
      return;
    }

    if (keranjang.length === 0) {
      setError('Tambahkan minimal 1 jenis barang ke daftar permohonan');
      return;
    }

    setSubmitting(true);
    setError('');

    const primaryTugasId = selectedTaskIds[0];
    const isBatch = selectedTaskIds.length > 1;

    // SOP 2: Update AppContext state & Sync Database (Multi-Ticket / Batch Collective Support)
    const defaultNote = isBatch
      ? `Permohonan kolektif batch ${selectedTaskIds.length} pelanggan. Gudang mengalokasikan SN ONT spesifik.`
      : 'Kebutuhan material instalasi lapangan';

    await requestMaterial(primaryTugasId, keranjang, catatan || defaultNote, selectedTaskIds);

    setSubmitting(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className={`rounded-3xl p-5 sm:p-6 w-full max-w-xl border shadow-2xl transition-all max-h-[92vh] overflow-y-auto ${
        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                <span>Ajukan Kebutuhan Material ke Gudang</span>
                {selectedTaskIds.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">
                    Batch {selectedTaskIds.length} Pelanggan
                  </span>
                )}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela"
            title="Tutup"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs mb-3 font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. SELEKSI MULTI-PELANGGAN / BATCH ORDER */}
        {myActiveTasks.length > 0 && (
          <div className={`p-3.5 rounded-2xl border mb-4 space-y-2.5 ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Pilih Pelanggan / Pekerjaan Sekaligus (Batch):</span>
              </span>
              <span className="text-[10px] text-blue-400 font-semibold font-mono">
                {selectedTaskIds.length} dari {myActiveTasks.length} Tiket
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {myActiveTasks.map((t) => {
                const isSelected = selectedTaskIds.includes(Number(t.id));
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTaskSelection(t.id)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/50 text-white font-semibold'
                        : isDark
                        ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="font-bold font-mono text-blue-400">#{t.id}</span>
                        <span className="mx-1.5 font-bold text-slate-200">{t.pelanggan_nama}</span>
                        <span className="text-[10px] text-slate-400 truncate">({t.jenis_kerja} - {t.lokasi})</span>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0 ml-2">
                      Pilih
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. SALDO SISA MATERIAL TEKNISI (MOBILE STOCK DI KENDARAAN) */}
        {saldoTeknisi && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 mb-4 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                <Package className="w-3.5 h-3.5" />
                <span>Saldo Sisa Material di Mobil Teknisi (Mobile Stock):</span>
              </span>
              <span className="text-[10px] text-amber-300/80 font-mono">Tercatat di Sistem</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-1.5 rounded-lg bg-black/25 text-center">
                <div className="text-slate-400 text-[9px]">Sisa Dropcore</div>
                <div className="font-bold text-emerald-400">{saldoTeknisi.kabel_m || 0} Meter</div>
              </div>
              <div className="p-1.5 rounded-lg bg-black/25 text-center">
                <div className="text-slate-400 text-[9px]">Roset Optik</div>
                <div className="font-bold text-sky-400">{saldoTeknisi.roset || 0} Pcs</div>
              </div>
              <div className="p-1.5 rounded-lg bg-black/25 text-center">
                <div className="text-slate-400 text-[9px]">Fast Connector</div>
                <div className="font-bold text-amber-400">{saldoTeknisi.fast_connector || 0} Pcs</div>
              </div>
              <div className="p-1.5 rounded-lg bg-black/25 text-center">
                <div className="text-slate-400 text-[9px]">Klem Segitiga</div>
                <div className="font-bold text-purple-400">{saldoTeknisi.klem_segitiga || 0} Pcs</div>
              </div>
            </div>
          </div>
        )}

        {/* 3. INPUT PEMILIHAN BARANG & QTY */}
        <div className="space-y-3 text-xs mb-4">
          <label className="block text-[11px] font-bold text-slate-300">
            Pilih Material Baru dari Inventaris Gudang:
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedBarang}
              onChange={(e) => setSelectedBarang(e.target.value)}
              className={`w-full sm:flex-1 p-2.5 rounded-xl border outline-none cursor-pointer text-xs font-semibold truncate transition ${
                isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-red-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-red-500'
              }`}
            >
              <option value="" disabled className="bg-[#1e293b] text-slate-400">
                -- Pilih Material dari Inventaris Gudang --
              </option>
              {barangList.map((b) => {
                const isOutOfStock = (Number(b.stok) || 0) <= 0;
                return (
                  <option
                    key={b.id}
                    value={b.id}
                    disabled={isOutOfStock}
                    className={`bg-[#1e293b] py-1.5 font-medium ${isOutOfStock ? 'text-slate-500 italic' : 'text-slate-100'}`}
                  >
                    {b.nama_barang} {isOutOfStock ? '(Stok Habis)' : `(Stok: ${b.stok} ${b.satuan})`}
                  </option>
                );
              })}
            </select>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl border border-slate-700 bg-slate-950/60 shrink-0">
                <span className="text-[11px] text-slate-400 pl-1.5 font-bold">Qty:</span>
                <input
                  type="number"
                  min="1"
                  value={jumlah}
                  onChange={(e) => setJumlah(e.target.value)}
                  className={`w-16 p-1.5 rounded-lg border text-center font-bold outline-none text-xs ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleTambah}
                className="flex-1 sm:flex-initial py-2.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow shrink-0 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          {/* Cart Table */}
          {keranjang.length > 0 ? (
            <div className={`p-3 rounded-2xl border space-y-2 ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-[10px] font-extrabold uppercase text-slate-400 flex items-center justify-between">
                <span>Daftar Material Diminta:</span>
                <span className="font-mono text-emerald-400">{keranjang.length} Item</span>
              </div>
              {keranjang.map((k, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-200 dark:border-slate-800 last:border-none">
                  <span className="font-medium">
                    • {k.nama_barang} (<strong>{k.jumlah_minta} {k.satuan}</strong>)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleHapusItem(idx)}
                    aria-label="Hapus item"
                    title="Hapus item"
                    className="text-rose-500 hover:text-rose-400 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic text-center py-2">
              Belum ada barang di daftar. Pilih barang di atas dan tekan tombol Tambah.
            </p>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Catatan Tambahan Teknisi:</label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Kebutuhan pemasangan 2 pelanggan sekaligus di Kelurahan Tiakar..."
              className={`w-full p-2.5 rounded-xl border outline-none text-xs ${
                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-600 text-white text-xs font-extrabold shadow-lg shadow-rose-900/30 transition cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {submitting ? 'Mengirim...' : `Kirim Permohonan (${selectedTaskIds.length} Tiket)`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RequestBarangModal;
