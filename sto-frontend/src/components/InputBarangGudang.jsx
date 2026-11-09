import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axiosInstance';
import {
  PlusCircle,
  PackageCheck,
  Barcode,
  Sparkles,
  Camera,
  Layers,
  Check
} from 'lucide-react';

export default function InputBarangGudang() {
  const { isDark } = useTheme();
  const { barang = [], addBarang, showToast } = useApp();

  // Preset material logistik standar Telkom Akses
  const defaultPresets = [
    { name: 'Modem ONT ZTE F670L Dual Band', unit: 'unit', kategori: 'Perangkat Aktif' },
    { name: 'Modem ONT Huawei HG8245H5', unit: 'unit', kategori: 'Perangkat Aktif' },
    { name: 'Kabel FO Dropcore 1-Core 150M', unit: 'roll', kategori: 'Kabel & Serat Optik' },
    { name: 'Kabel Sling Baja Penggantung FO', unit: 'roll', kategori: 'Kabel & Serat Optik' },
    { name: 'Roset Fiber Optic 1-Core', unit: 'pcs', kategori: 'Perangkat Pasif' },
    { name: 'Patch Cord SC-UPC 2M', unit: 'pcs', kategori: 'Perangkat Pasif' },
    { name: 'Splitter PLC 1:8 SC/UPC', unit: 'pcs', kategori: 'Perangkat Pasif' },
    { name: 'Protection Sleeve 60mm', unit: 'pcs', kategori: 'Aksesoris' }
  ];

  // Daftar gabungan material untuk dropdown gulir (dari database master barang + preset Telkom)
  const availableItems = useMemo(() => {
    const list = [];
    const seen = new Set();

    (barang || []).forEach(b => {
      if (b.nama_barang && !seen.has(b.nama_barang.toLowerCase().trim())) {
        seen.add(b.nama_barang.toLowerCase().trim());
        list.push({
          name: b.nama_barang,
          unit: b.satuan || 'pcs',
          kategori: b.kategori || 'Material'
        });
      }
    });

    defaultPresets.forEach(p => {
      if (!seen.has(p.name.toLowerCase().trim())) {
        seen.add(p.name.toLowerCase().trim());
        list.push(p);
      }
    });

    return list;
  }, [barang]);

  const [selectedItemName, setSelectedItemName] = useState(defaultPresets[0].name);
  const [isRegisterNew, setIsRegisterNew] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialKategori, setNewMaterialKategori] = useState('Aksesoris');

  const [form, setForm] = useState({
    nama_barang: defaultPresets[0].name,
    stok: 5,
    satuan: defaultPresets[0].unit
  });

  // State Nomor Seri untuk perangkat ONT/Modem (Opsional)
  const [inputSn, setInputSn] = useState('');
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [isScanningCamera, setIsScanningCamera] = useState(false);

  // Deteksi barang kategori ONT atau Modem
  const isOntItem = form.nama_barang.toLowerCase().includes('ont') ||
                    form.nama_barang.toLowerCase().includes('modem');

  // Handle perubahan pada dropdown gulir barang
  const handleDropdownChange = (e) => {
    const val = e.target.value;
    if (val === '__REGISTER_NEW__') {
      setIsRegisterNew(true);
      setSelectedItemName('__REGISTER_NEW__');
      setForm(prev => ({ ...prev, nama_barang: newMaterialName, satuan: 'pcs' }));
      setSerialNumbers([]);
    } else {
      setIsRegisterNew(false);
      setSelectedItemName(val);
      const matched = availableItems.find(item => item.name === val);
      setForm({
        nama_barang: val,
        stok: val.toLowerCase().includes('ont') || val.toLowerCase().includes('modem') ? (serialNumbers.length > 0 ? serialNumbers.length : 5) : 10,
        satuan: matched ? matched.unit : 'pcs'
      });
      if (!val.toLowerCase().includes('ont') && !val.toLowerCase().includes('modem')) {
        setSerialNumbers([]);
      }
    }
  };

  // Tambah SN manual / hasil scan barcode fisik
  const handleAddManualSn = () => {
    if (!inputSn.trim()) return;

    const items = inputSn
      .split(/[\n,\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    const uniqueNew = items.filter(s => !serialNumbers.includes(s));
    if (uniqueNew.length > 0) {
      const updated = [...serialNumbers, ...uniqueNew];
      setSerialNumbers(updated);
      setForm(prev => ({ ...prev, stok: updated.length }));
      setInputSn('');
      showToast(`${uniqueNew.length} Serial Number Barcode berhasil dicatat!`, 'success');
    } else {
      showToast('Nomor seri sudah terdaftar dalam daftar!', 'warning');
    }
  };

  // Generator SN Otomatis (Opsional) jika tidak ingin scan satu per satu
  const handleGenerateAutoSn = () => {
    const count = Math.max(1, Number(form.stok) || 1);
    const generated = [];
    const prefix = form.nama_barang.toLowerCase().includes('huawei') ? 'HWTC' : 'ZTEGC';
    for (let i = 1; i <= count; i++) {
      const randHex = Math.random().toString(16).substring(2, 8).toUpperCase();
      generated.push(`${prefix}${randHex}`);
    }
    setSerialNumbers(generated);
    setForm(prev => ({ ...prev, stok: generated.length }));
    showToast(`${generated.length} SN Modem ONT otomatis dibuat!`, 'success');
  };

  const handleSimulateScan = () => {
    const prefix = form.nama_barang.toLowerCase().includes('huawei') ? 'HWTC' : 'ZTEGC';
    const rand = Math.random().toString(16).substring(2, 8).toUpperCase();
    const newSn = `${prefix}${rand}`;
    setSerialNumbers(prev => [...prev, newSn]);
    setForm(prev => ({ ...prev, stok: prev.stok + 1 }));
    setIsScanningCamera(false);
    showToast(`Barcode terdeteksi: ${newSn}`, 'success');
  };

  const handleRemoveSn = (indexToRemove) => {
    const updated = serialNumbers.filter((_, idx) => idx !== indexToRemove);
    setSerialNumbers(updated);
    setForm(prev => ({ ...prev, stok: Math.max(1, updated.length) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalNama = isRegisterNew ? newMaterialName.trim() : form.nama_barang.trim();
    if (!finalNama) {
      showToast('Harap pilih atau ketik nama material!', 'error');
      return;
    }

    const stokCount = isOntItem && serialNumbers.length > 0 ? serialNumbers.length : parseInt(form.stok, 10);
    const newItem = {
      nama_barang: finalNama,
      stok: stokCount,
      satuan: form.satuan || 'pcs',
      kategori: isRegisterNew ? newMaterialKategori : 'Logistik Sentral'
    };

    // 1. Simpan ke database via addBarang AppContext
    await addBarang(newItem);

    // 2. Jika item ONT dan ada serial numbers, simpan ke database serial
    if (isOntItem && serialNumbers.length > 0) {
      try {
        await api.post('/barang/seri', {
          model: finalNama,
          serial_numbers: serialNumbers
        });
      } catch (err) {
        console.warn('[InputBarang] Backend seri notice:', err.message);
      }

      const existingSnStorage = JSON.parse(localStorage.getItem('sto_ont_serials') || '[]');
      const now = new Date().toLocaleString('id-ID');
      const newEntries = serialNumbers.map((sn, idx) => ({
        id: Date.now() + idx,
        sn,
        model: finalNama,
        status: 'Di Gudang',
        lokasi: 'Rak Logistik Sentral STO Payakumbuh',
        tugas_id: null,
        waktu: now
      }));
      localStorage.setItem('sto_ont_serials', JSON.stringify([...newEntries, ...existingSnStorage]));
    }

    showToast(`Material "${finalNama}" (+${stokCount} ${form.satuan}) berhasil disimpan!`, 'success');

    // Reset form ke pilihan default yang sudah tersimpan
    setSelectedItemName(finalNama);
    setIsRegisterNew(false);
    setNewMaterialName('');
    setForm({
      nama_barang: finalNama,
      stok: 5,
      satuan: form.satuan
    });
    setSerialNumbers([]);
    setInputSn('');
  };

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <div className={`p-5 sm:p-7 rounded-3xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} transition-colors`}>
        
        {/* Header Form */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
          <span className="p-2 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
            <PlusCircle className="w-5 h-5" />
          </span>
          <div>
            <h2 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
              <span>Input Pengadaan Barang Gudang</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                Logistik STO
              </span>
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
              Pilih dari daftar gulir barang gudang atau daftarkan nama material baru.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            
            {/* Dropdown Gulir Saran Nama Material */}
            <div className="sm:col-span-2 space-y-2">
              <label className={`block font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'} flex items-center justify-between`}>
                <span>Pilih Barang / Material (Daftar Gulir) *</span>
                <span className="text-[10px] font-mono text-emerald-400">Total: {availableItems.length} Material</span>
              </label>

              <select
                value={selectedItemName}
                onChange={handleDropdownChange}
                className={`w-full p-3 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} focus:outline-none focus:border-emerald-500 font-bold cursor-pointer text-xs`}
              >
                <optgroup label="📦 Katalog Material Gudang STO:">
                  {availableItems.map(item => (
                    <option key={item.name} value={item.name}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </optgroup>
                <option value="__REGISTER_NEW__">
                  ➕ Daftarkan / Registrasi Material Baru Lainnya...
                </option>
              </select>

              {/* Form Input Baru jika memilih registrasi material baru */}
              {isRegisterNew && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-in fade-in">
                  <div className="text-[11px] font-extrabold text-emerald-400 flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Registrasi Nama Material Baru (Otomatis Masuk ke Dropdown):</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ketik nama lengkap material baru..."
                    value={newMaterialName}
                    onChange={e => {
                      setNewMaterialName(e.target.value);
                      setForm(prev => ({ ...prev, nama_barang: e.target.value }));
                    }}
                    className={`w-full p-2.5 rounded-xl border text-xs font-semibold ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} focus:outline-none focus:border-emerald-500`}
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-400">Kategori:</label>
                    <select
                      value={newMaterialKategori}
                      onChange={e => setNewMaterialKategori(e.target.value)}
                      className={`p-1.5 rounded-lg border text-xs font-semibold ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                    >
                      <option value="Perangkat Aktif">Perangkat Aktif (Modem/ONT)</option>
                      <option value="Kabel & Serat Optik">Kabel & Serat Optik</option>
                      <option value="Perangkat Pasif">Perangkat Pasif (Roset/Splitter)</option>
                      <option value="Aksesoris">Aksesoris / Consumables</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Satuan Ukuran */}
            <div>
              <label className={`block font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Satuan Ukuran *
              </label>
              <select
                value={form.satuan}
                onChange={e => setForm({ ...form, satuan: e.target.value })}
                className={`w-full p-3 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} focus:outline-none focus:border-emerald-500 cursor-pointer font-bold text-xs`}
              >
                <option value="pcs">pcs (buah)</option>
                <option value="unit">unit (perangkat ONT/modem)</option>
                <option value="roll">roll (gulungan kabel / sling)</option>
                <option value="meter">meter</option>
                <option value="set">set</option>
                <option value="box">box</option>
              </select>
            </div>
          </div>

          {/* OPSI SCAN BARCODE SERIAL NUMBER (OPSIONAL KHUSUS MODEM/ONT) */}
          {isOntItem && (
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-purple-950/20 border-purple-500/30' : 'bg-purple-50/70 border-purple-200'} space-y-3 animate-in fade-in`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-purple-500/20">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <Barcode className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="font-extrabold text-xs text-purple-400 flex items-center gap-2">
                      <span>Serial Number (SN Barcode) Modem ONT</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-mono">Opsional</span>
                    </h4>
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Scan barcode dus modem, buat acak otomatis, atau masukkan jumlah stok langsung.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateAutoSn}
                    className="px-2.5 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>Buat SN Otomatis</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsScanningCamera(!isScanningCamera)}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Camera className="w-3 h-3 text-slate-400" />
                    <span>{isScanningCamera ? 'Tutup Kamera' : 'Scan Kamera'}</span>
                  </button>
                </div>
              </div>

              {/* Viewfinder Kamera Simulator */}
              {isScanningCamera && (
                <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/50 text-center space-y-3">
                  <div className="relative w-48 h-32 mx-auto rounded-lg border-2 border-dashed border-purple-400 flex items-center justify-center overflow-hidden bg-slate-900">
                    <div className="absolute inset-x-0 h-0.5 bg-rose-500 animate-pulse"></div>
                    <span className="text-[10px] text-slate-400">Arahkan Barcode ke Kamera</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateScan}
                    className="py-1.5 px-4 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition cursor-pointer"
                  >
                    [ Simulasi Deteksi Barcode Fisik ]
                  </button>
                </div>
              )}

              {/* Input Manual Box */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik SN manual (Contoh: ZTEGC8B12345) atau pisahkan spasi..."
                  value={inputSn}
                  onChange={e => setInputSn(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddManualSn(); } }}
                  className={`flex-1 p-2.5 rounded-xl border font-mono text-xs uppercase ${isDark ? 'bg-slate-950 border-purple-500/40 text-white' : 'bg-white border-purple-300 text-slate-900'}`}
                />
                <button
                  type="button"
                  onClick={handleAddManualSn}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer shrink-0"
                >
                  Tambah SN
                </button>
              </div>

              {/* List of SN registered */}
              {serialNumbers.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-purple-400">{serialNumbers.length} Serial Number Terdata:</span>
                    <button
                      type="button"
                      onClick={() => { setSerialNumbers([]); setForm(prev => ({ ...prev, stok: 1 })); }}
                      className="text-rose-400 hover:underline cursor-pointer font-bold text-[10px]"
                    >
                      Hapus Semua
                    </button>
                  </div>

                  <div className={`p-2.5 rounded-xl border max-h-32 overflow-y-auto flex flex-wrap gap-1.5 ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'}`}>
                    {serialNumbers.map((sn, idx) => (
                      <span
                        key={sn + idx}
                        className="px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-bold flex items-center gap-1"
                      >
                        <Barcode className="w-3 h-3 text-purple-400" />
                        <span>{sn}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSn(idx)}
                          className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer font-black"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Jumlah Stok & Tombol Simpan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
            <div>
              <label className={`block font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Jumlah Stok Masuk Fisik *
              </label>
              <input
                type="number"
                min="1"
                required
                value={serialNumbers.length > 0 ? serialNumbers.length : form.stok}
                onChange={e => setForm({ ...form, stok: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className={`w-full p-3 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} focus:outline-none focus:border-emerald-500 font-bold text-xs`}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {isOntItem && serialNumbers.length > 0
                  ? `Kuantitas disesuaikan dengan ${serialNumbers.length} Serial Number.`
                  : 'Jumlah fisik material yang masuk ke gudang.'}
              </p>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-950 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Simpan</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
