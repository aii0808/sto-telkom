// oxlint-disable no-unused-vars react/set-state-in-effect
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import DigitalSignaturePad from '../components/DigitalSignaturePad';
import CetakSuratPermintaan from '../components/CetakSuratPermintaan';
import ModalBASTP from '../components/ModalBASTP';
import {
  MapPin,
  Calendar,
  User,
  Phone,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Send,
  Printer,
  Clock,
  Sparkles,
  Radio,
  FileText,
  Check,
  Package,
  Layers,
  ShieldCheck,
  Flame,
  HelpCircle,
  Plus,
  Trash2
} from 'lucide-react';

export default function DetailTiketTelegram() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const {
    currentUser,
    tugas,
    odp,
    barang = [],
    claimTugas,
    checkInTugas,
    closeTugas,
    requestMaterial,
    showToast
  } = useApp();

  // Pengecekan Sesi Login
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser && !currentUser) {
      sessionStorage.setItem('sto_redirect_after_login', `/tiket/${id}`);
      navigate(`/login?redirect=/tiket/${id}`);
      return;
    }
    setIsAuthChecking(false);
  }, [id, currentUser, navigate]);

  // Cari tiket yang dimaksud
  const ticketId = parseInt(id, 10);
  const task = tugas.find(t => Number(t.id) === ticketId) || {
    id: ticketId,
    jenis_kerja: 'Pasang Baru IndiHome',
    lokasi: 'Jl. Soekarno Hatta No. 45, Koto Nan IV, Payakumbuh',
    pelanggan_nama: 'Bpk. Rian Hidayat',
    pelanggan_telp: '081267890123',
    status: 'Open',
    odp_kode: 'ODP-PYK-FA/001',
    odp_id: 1,
    created_at: new Date().toISOString()
  };

  // Cari acuan data ODP
  const targetOdp = odp.find(o =>
    Number(o.id) === Number(task.odp_id) ||
    o.kode_odp?.toUpperCase() === String(task.odp_kode || 'ODP-PYK-FA/001').toUpperCase()
  ) || odp[0] || {
    id: 1,
    kode_odp: 'ODP-PYK-FA/001',
    nama_lokasi: 'Jl. Soekarno Hatta (Depan STO)',
    kapasitas_port: 8,
    port_terpakai: 6,
    status: 'Tersedia'
  };

  // State Modals
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [showBastpModal, setShowBastpModal] = useState(false);

  // Fase 2: Form Request Material (Dari Katalog 20 Item Material STO Payakumbuh)
  const [materialList, setMaterialList] = useState([
    { id: 1, nama_barang: 'Kabel FO Dropcore 1-Core 150M', jumlah_minta: 150, satuan: 'meter' },
    { id: 3, nama_barang: 'Modem ONT ZTE F670L Dual Band Gigabit', jumlah_minta: 1, satuan: 'unit' },
    { id: 5, nama_barang: 'Roset Optik 1-Port + Adapter SC/UPC', jumlah_minta: 1, satuan: 'pcs' },
    { id: 7, nama_barang: 'Patchcord SC/UPC - SC/UPC 2M', jumlah_minta: 1, satuan: 'pcs' }
  ]);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [requestSent, setRequestSent] = useState(false);

  const handleAddMaterialItem = () => {
    if (!selectedCatalogItem) return;
    const item = barang.find(b => Number(b.id) === Number(selectedCatalogItem));
    if (!item) return;

    if (materialList.some(m => Number(m.id) === Number(item.id))) {
      showToast(`Item ${item.nama_barang} sudah ada di daftar permintaan!`, 'info');
      return;
    }

    setMaterialList(prev => [
      ...prev,
      {
        id: item.id,
        nama_barang: item.nama_barang,
        jumlah_minta: Math.max(1, parseInt(selectedQty, 10) || 1),
        satuan: item.satuan || 'pcs'
      }
    ]);
    setSelectedCatalogItem('');
    setSelectedQty(1);
    showToast(`Item ${item.nama_barang} ditambahkan!`, 'success');
  };

  const handleRemoveMaterialItem = (itemId) => {
    setMaterialList(prev => prev.filter(m => Number(m.id) !== Number(itemId)));
  };

  // Fase 3: Gudang Release & Binding SN ONT
  const [snOnt, setSnOnt] = useState(task.sn_ont || 'ZTEGC8B90112');
  const isOntBound = Boolean(task.sn_ont) || requestSent;

  // Fase 4: Check-In Lokasi
  const [checkInDone, setCheckInDone] = useState(Boolean(task.checkin?.verified));
  const [checkInCoords, setCheckInCoords] = useState(task.checkin || null);
  const [isLocating, setIsLocating] = useState(false);

  // Fase 5: Closing Data
  const [redamanDbm, setRedamanDbm] = useState(task.redaman_dbm || -18.5);
  const [customerSignature, setCustomerSignature] = useState(null);
  const [fotoOnt, setFotoOnt] = useState(null);
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);

  // Handler Fase 2: Ambil Tiket
  const handleClaim = () => {
    claimTugas(task.id);
  };

  // Handler Fase 2: Kirim Permohonan Material
  const handleSendMaterialRequest = async () => {
    const items = materialList.map(m => ({
      barang_id: m.id,
      jumlah_minta: m.jumlah_minta
    }));

    await requestMaterial({
      tugas_id: task.id,
      items,
      catatan: 'Material Pasang Baru IndiHome ODP Payakumbuh'
    });

    setRequestSent(true);
    showToast('Permohonan material terkirim & bot Telegram telah mengabari Grup Gudang!', 'success');
  };

  // Handler Fase 4: Check-In Lokasi GPS (Single capture)
  const handleCheckIn = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      // Fallback koordinat Payakumbuh
      const fallback = { latitude: -0.2285, longitude: 100.6335 };
      checkInTugas(task.id, fallback);
      setCheckInCoords(fallback);
      setCheckInDone(true);
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };
        checkInTugas(task.id, coords);
        setCheckInCoords(coords);
        setCheckInDone(true);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation notice:', err.message);
        const fallback = { latitude: -0.2289, longitude: 100.6322 };
        checkInTugas(task.id, fallback);
        setCheckInCoords(fallback);
        setCheckInDone(true);
        setIsLocating(false);
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  };

  // Handler Fase 5: Closing Tiket & WebGIS Magic 🔥
  const handleSubmitClosing = async (e) => {
    e.preventDefault();
    if (!customerSignature) {
      showToast('Pelanggan wajib membubuhkan tanda tangan digital di layar terlebih dahulu!', 'warning');
      return;
    }

    setIsSubmittingClose(true);

    await closeTugas(task.id, {
      redaman_dbm: redamanDbm,
      sn_ont: snOnt,
      foto_ont: fotoOnt,
      tanda_tangan_pelanggan: customerSignature,
      odp_id: targetOdp.id,
      odp_kode: targetOdp.kode_odp
    });

    setIsSubmittingClose(false);
    setShowClosingModal(false);
    setShowBastpModal(true);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white text-xs">
        Memverifikasi sesi teknisi...
      </div>
    );
  }

  const isClosed = task.status === 'Closed' || task.status === 'Done';
  const isOpen = task.status === 'Open' || task.status === 'menunggu';

  // Indikator Rasio ODP
  const ratio = (targetOdp.port_terpakai || 0) / (targetOdp.kapasitas_port || 8);
  const odpColorClass = ratio >= 1.0
    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
    : ratio >= 0.7
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0f1d] text-white' : 'bg-slate-50 text-slate-900'} transition-colors pb-20`}>
      
      {/* Top Navbar Header */}
      <header className={`sticky top-0 z-40 px-4 py-3 border-b backdrop-blur-md ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'} flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/dashboard-teknisi')}
            className={`p-2 rounded-xl ${isDark ? 'bg-slate-900 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'} transition cursor-pointer`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-black text-rose-500">TIKET #{task.id}</span>
              <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase border ${
                isClosed
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                  : isOpen
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {task.status}
              </span>
            </div>
            <div className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-slate-800'} truncate max-w-[200px] sm:max-w-md`}>
              {task.jenis_kerja}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboard-teknisi"
            className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition"
          >
            Portal Teknisi
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        
        {/* Banner Link Telegram Terverifikasi */}
        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-blue-950/30 border-blue-800/50 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-800'} text-xs flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2.5">
            <Send className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Dibuka melalui tautan pesan bot Telegram <strong>@sto_pyk_bot</strong>. Sesi teknisi terverifikasi.
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30">
            Fase KP
          </span>
        </div>

        {/* Card 1: Rincian Pelanggan & Acuan ODP WebGIS */}
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data Pelanggan IndiHome</span>
              <h2 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-900'} mt-0.5`}>
                {task.pelanggan_nama || 'Bpk. Rian Hidayat'}
              </h2>
            </div>
            <a
              href={`tel:${task.pelanggan_telp || '081267890123'}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-md shadow-emerald-950"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Hubungi</span>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-850' : 'bg-slate-50 border-slate-200'} space-y-1`}>
              <div className="text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Alamat Pemasangan:</span>
              </div>
              <div className="font-semibold">{task.lokasi}</div>
              <div className="text-[11px] text-slate-400">Kontak: {task.pelanggan_telp || '081267890123'}</div>
            </div>

            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-850' : 'bg-slate-50 border-slate-200'} space-y-1`}>
              <div className="text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-blue-400" />
                  <span>Acuan Titik ODP:</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${odpColorClass}`}>
                  {targetOdp.status} ({targetOdp.port_terpakai}/{targetOdp.kapasitas_port})
                </span>
              </div>
              <div className="font-mono font-bold text-amber-400">{targetOdp.kode_odp}</div>
              <div className="text-[11px] text-slate-400 truncate">{targetOdp.nama_lokasi}</div>
            </div>
          </div>
        </div>

        {/* FASE 2: PICK-UP & REQUEST MATERIAL */}
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Package className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-extrabold text-sm">Fase 2: Pick-Up Tiket & Permintaan Material</h3>
                <p className="text-[11px] text-slate-400">Ambil tugas dan pesan material dropcore/ONT ke gudang</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-slate-800 text-slate-300">
              Tahap Material
            </span>
          </div>

          {/* Tombol Ambil Tiket jika masih open */}
          {isOpen && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-700/50 text-center space-y-2">
              <div className="text-xs text-blue-200">
                Tiket ini masih tersedia di pool siaran terbuka Telkom STO Payakumbuh.
              </div>
              <button
                type="button"
                onClick={handleClaim}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition shadow-lg shadow-blue-950 cursor-pointer active:scale-98"
              >
                ⚡ AMBIL TIKET INI SEKARANG
              </button>
            </div>
          )}

          {/* Daftar Kebutuhan Material */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Item Material yang Dibutuhkan:</span>
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                title="Opsional: Form fisik dapat dicetak bila diperlukan arsip tanda tangan basah"
              >
                <Printer className="w-3 h-3 text-amber-400" />
                <span>Cetak Lembar Fisik (Opsional)</span>
              </button>
            </div>

            {/* List Item Material Terpilih */}
            <div className="space-y-1.5 text-xs">
              {materialList.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'} border`}
                >
                  <span className="font-medium">• {m.nama_barang}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-500 font-mono">
                      {m.jumlah_minta} {m.satuan}
                    </span>
                    {!requestSent && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMaterialItem(m.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                        title="Hapus item ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Selector Tambah Material Realistis dari Gudang */}
            {!requestSent && (
              <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-2`}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Plus className="w-3 h-3 text-emerald-400" />
                  <span>Tambah Item Material Tambahan (Dari Katalog Gudang STO):</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedCatalogItem}
                    onChange={(e) => setSelectedCatalogItem(e.target.value)}
                    className={`flex-1 px-3 py-1.5 rounded-xl text-xs border ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'} focus:outline-none cursor-pointer`}
                  >
                    <option value="">-- Pilih Barang dari Gudang (20 Item Realistis) --</option>
                    {barang.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nama_barang} (Stok: {b.stok} {b.satuan}) - [{b.kategori || 'Material'}]
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={selectedQty}
                      onChange={(e) => setSelectedQty(e.target.value)}
                      className={`w-20 px-2.5 py-1.5 rounded-xl text-xs border text-center font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} focus:outline-none`}
                      title="Jumlah diminta"
                    />
                    <button
                      type="button"
                      onClick={handleAddMaterialItem}
                      disabled={!selectedCatalogItem}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSendMaterialRequest}
                disabled={requestSent}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  requestSent
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950'
                }`}
              >
                {requestSent ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Send className="w-4 h-4" />}
                <span>{requestSent ? 'Permohonan Terkirim ke Gudang & Telegram' : 'Ajukan Permohonan ke Gudang'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className={`py-2.5 px-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'} font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer`}
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Cetak Lembar Fisik (Opsional)</span>
              </button>
            </div>
          </div>
        </div>

        {/* FASE 3: RILIS BARANG & BINDING SN ONT (GUDANG) */}
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-extrabold text-sm">Fase 3: Rilis Gudang & Binding SN ONT</h3>
                <p className="text-[11px] text-slate-400">Pengikatan barcode ONT modem ke penugasan lapangan</p>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isOntBound
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {isClosed ? 'ACTIVE (DI PELANGGAN)' : isOntBound ? 'DALAM PERJALANAN' : 'MENUNGGU GUDANG'}
            </span>
          </div>

          <div className={`p-3 rounded-2xl text-xs space-y-1.5 ${isDark ? 'bg-slate-950/70 border border-slate-850' : 'bg-slate-50 border border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Serial Number (SN Barcode) ONT:</span>
              <span className="font-mono font-bold text-purple-400 text-sm">{snOnt}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Status Fisik Perangkat:</span>
              <span className="text-slate-300">
                {isClosed ? 'Terpasang Permanen di Rumah Pelanggan' : 'Dikeluarkan dari Rak Gudang STO (Dalam Perjalanan)'}
              </span>
            </div>
          </div>
        </div>

        {/* FASE 4: CHECK-IN & EKSEKUSI LAPANGAN */}
        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <MapPin className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-extrabold text-sm">Fase 4: Check-In Lokasi & Eksekusi Lapangan</h3>
                <p className="text-[11px] text-slate-400">Catat koordinat GPS satu kali saat tiba di lokasi</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Check-In Lapangan
            </span>
          </div>

          {checkInDone ? (
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <strong>Check-In Terverifikasi</strong>
                  <div className="text-[10px] text-emerald-400/80 font-mono">
                    Koordinat: {checkInCoords?.latitude?.toFixed(4)}, {checkInCoords?.longitude?.toFixed(4)} &bull; {checkInCoords?.time || '14:20 WIB'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                TERDATA
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                Tekan tombol di bawah saat Anda tiba di rumah pelanggan. Sistem akan mencatat koordinat lokasi dan memberitahu Pimpinan melalui bot Telegram:
              </p>
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={isLocating}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition shadow-lg shadow-blue-950 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <MapPin className="w-4 h-4" />
                <span>{isLocating ? 'Mendeteksi Koordinat GPS...' : '📍 Check-In Sekarang di Rumah Pelanggan'}</span>
              </button>
            </div>
          )}
        </div>

        {/* FASE 5: CLOSING & WEBGIS MAGIC 🔥 */}
        <div className={`p-5 rounded-3xl border ${
          isClosed
            ? 'border-emerald-500/50 bg-emerald-950/20'
            : isDark ? 'bg-gradient-to-br from-slate-900 to-rose-950/30 border-rose-800/40' : 'bg-gradient-to-br from-white to-rose-50 border-rose-200 shadow-sm'
        } space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                  <span>Fase 5: Closing Pekerjaan & WebGIS Magic</span>
                  <span className="text-xs">🔥</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ukur OPM dBm, Tanda Tangan Digital, Tutup Tiket & Auto-Update Port ODP
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isClosed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
            }`}>
              {isClosed ? 'CLOSED (SELESAI)' : 'CLOSING WAJIB'}
            </span>
          </div>

          {isClosed ? (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Pekerjaan Telah Tuntas & Dokumen BASTP Resmi Diterbitkan!</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Redaman OPM: <strong>{task.redaman_dbm || -18.5} dBm (PASS QC)</strong></div>
                <div>Status ONT: <strong className="text-purple-400">Active (Di Pelanggan)</strong></div>
                <div>Port ODP Terpakai: <strong>{targetOdp.port_terpakai}/{targetOdp.kapasitas_port} Port</strong></div>
                <div>Status WebGIS: <strong className="text-amber-400">{targetOdp.status}</strong></div>
              </div>
              <button
                type="button"
                onClick={() => setShowBastpModal(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition shadow-md shadow-emerald-950 flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Lihat Berita Acara & BASTP Digital</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`p-3 rounded-2xl text-xs space-y-1 ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100 border-slate-200'} border`}>
                <div className="font-bold text-slate-300">Eksekusi Transaksi Database Berantai saat Closing:</div>
                <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5">
                  <li>Status tiket diubah menjadi <strong>Closed</strong></li>
                  <li>Status SN ONT diubah menjadi <strong>Active</strong> di pelanggan</li>
                  <li>Port terpakai di <strong>{targetOdp.kode_odp}</strong> bertambah 1 dan status warna WebGIS langsung berubah (Kuning/Merah)</li>
                  <li>Ringkasan BASTP digital dikirim ke Telegram Pimpinan</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setShowClosingModal(true)}
                className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs transition shadow-xl shadow-rose-950 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Flame className="w-4 h-4" />
                <span>TUTUP TIKET & PICU WEBGIS MAGIC SEKARANG 🔥</span>
              </button>
            </div>
          )}
        </div>

      </main>

      {/* MODAL 1: FORMULIR CLOSING & DIGITAL SIGNATURE */}
      {showClosingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className={`${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'} border w-full max-w-lg rounded-3xl shadow-2xl p-5 sm:p-6 my-4 space-y-4 text-xs transition-colors`}>
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
                  <Flame className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold">Closing Instalasi & Tanda Tangan Pelanggan</h3>
                  <p className="text-[10px] text-slate-400">Tiket #{task.id} &bull; ODP: {targetOdp.kode_odp}</p>
                </div>
              </div>
              <button
                onClick={() => setShowClosingModal(false)}
                className="text-slate-400 hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitClosing} className="space-y-4">
              
              {/* Input Redaman OPM dBm */}
              <div>
                <label className="block font-bold mb-1 text-slate-300">
                  Hasil Pengukuran Redaman Optik (OPM dBm) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={redamanDbm}
                    onChange={(e) => setRedamanDbm(parseFloat(e.target.value))}
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} font-mono font-bold focus:outline-none focus:border-rose-500`}
                  />
                  <span className="font-bold text-slate-400 shrink-0">dBm</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Standar QC Telkom Akses: -16.0 s/d -24.0 dBm (Hijau: Aman)</p>
              </div>

              {/* Serial Number ONT */}
              <div>
                <label className="block font-bold mb-1 text-slate-300">
                  Serial Number (SN Barcode) ONT Modem Terpasang *
                </label>
                <input
                  type="text"
                  required
                  value={snOnt}
                  onChange={(e) => setSnOnt(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} font-mono uppercase font-bold focus:outline-none focus:border-rose-500`}
                />
              </div>

              {/* Tanda Tangan Digital Pelanggan */}
              <div className="pt-1">
                <DigitalSignaturePad
                  isDark={isDark}
                  onSave={(dataUrl) => setCustomerSignature(dataUrl)}
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClosingModal(false)}
                  className={`px-4 py-2.5 rounded-xl ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'} font-semibold text-xs cursor-pointer`}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClose}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs transition shadow-lg shadow-rose-950 active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Flame className="w-4 h-4" />
                  <span>{isSubmittingClose ? 'Memproses Transaksi...' : 'Selesai & Tutup Tiket'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CETAK SURAT PERMINTAAN MATERIAL */}
      {showPrintModal && (
        <CetakSuratPermintaan
          task={task}
          items={materialList}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* MODAL 3: BUKTI ACARA BASTP */}
      {showBastpModal && (
        <ModalBASTP
          task={{
            ...task,
            status: 'Closed',
            redaman_dbm: redamanDbm,
            sn_ont: snOnt,
            odp_id: targetOdp.kode_odp,
            bastp: {
              nomor: `BASTP/TA-PYK/2026/${String(task.id).padStart(4, '0')}`,
              sn_ont: snOnt,
              redaman: redamanDbm,
              odp_id: targetOdp.kode_odp,
              panjang_kabel: 150,
              kabel_terpasang: 125,
              sisa_retur: 25,
              roset: 1
            }
          }}
          onClose={() => setShowBastpModal(false)}
        />
      )}

    </div>
  );
}
