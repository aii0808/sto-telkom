import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axiosInstance';
import {
  PlusCircle,
  PackageCheck,
  History,
  Barcode,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Radio,
  Boxes,
  Camera,
  Sparkles
} from 'lucide-react';

export default function InputBarangGudang() {
  const { isDark } = useTheme();
  const { addBarang, showToast } = useApp();

  const [form, setForm] = useState({
    nama_barang: 'Modem ONT ZTE F670L Dual Band',
    stok: 5,
    satuan: 'unit'
  });

  // State Nomor Seri untuk perangkat ONT/Modem (Opsional)
  const [inputSn, setInputSn] = useState('');
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [isScanningCamera, setIsScanningCamera] = useState(false);

  // Recent in-flow history in session
  const [historyLog, setHistoryLog] = useState([
    {
      id: 1,
      nama_barang: 'Kabel FO Dropcore 1-Core 150M',
      jumlah: 105,
      satuan: 'roll',
      waktu: '2026-10-29 08:30',
      serial_count: 0
    },
    {
      id: 2,
      nama_barang: 'Modem ONT ZTE F670L Dual Band',
      jumlah: 11,
      satuan: 'unit',
      waktu: '2026-10-29 09:15',
      serial_count: 11
    }
  ]);

  // Deteksi barang kategori ONT atau Modem
  const isOntItem = form.nama_barang.toLowerCase().includes('ont') ||
                    form.nama_barang.toLowerCase().includes('modem');

  // Preset material logistik STO untuk kemudahan staf gudang
  const materialPresets = [
    { name: 'Modem ONT ZTE F670L Dual Band', unit: 'unit' },
    { name: 'Modem ONT Huawei HG8245H5', unit: 'unit' },
    { name: 'Kabel FO Dropcore 1-Core 150M', unit: 'roll' },
    { name: 'Kabel Sling Baja Penggantung FO', unit: 'roll' },
    { name: 'Roset Fiber Optic 1-Core', unit: 'pcs' },
    { name: 'Patch Cord SC-UPC 2M', unit: 'pcs' },
    { name: 'Splitter PLC 1:8 SC/UPC', unit: 'pcs' },
    { name: 'Protection Sleeve 60mm', unit: 'pcs' }
  ];

  const handleSelectPreset = (preset) => {
    setForm({
      nama_barang: preset.name,
      stok: preset.name.toLowerCase().includes('ont') || preset.name.toLowerCase().includes('modem') ? (serialNumbers.length > 0 ? serialNumbers.length : 5) : 10,
      satuan: preset.unit
    });
    if (!preset.name.toLowerCase().includes('ont') && !preset.name.toLowerCase().includes('modem')) {
      setSerialNumbers([]);
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
    if (!form.nama_barang.trim()) {
      showToast('Harap isi nama material!', 'error');
      return;
    }

    const stokCount = serialNumbers.length > 0
      ? serialNumbers.length
      : Math.max(1, Number(form.stok) || 1);

    const newItem = {
      nama_barang: form.nama_barang.trim(),
      stok: stokCount,
      satuan: form.satuan
    };

    // 1. Simpan ke master barang di database
    await addBarang(newItem);

    // 2. Jika item ONT dan ada serial numbers, simpan ke database
    if (isOntItem && serialNumbers.length > 0) {
      try {
        await api.post('/barang/seri', {
          model: form.nama_barang,
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
        model: form.nama_barang,
        status: 'Di Gudang',
        lokasi: 'Rak Logistik Sentral STO Payakumbuh',
        tugas_id: null,
        waktu: now
      }));
      localStorage.setItem('sto_ont_serials', JSON.stringify([...newEntries, ...existingSnStorage]));
    }

    // Add to session history log
    setHistoryLog([
      {
        id: Date.now(),
        nama_barang: form.nama_barang,
        jumlah: stokCount,
        satuan: form.satuan,
        waktu: new Date().toLocaleString('id-ID'),
        serial_count: serialNumbers.length
      },
      ...historyLog
    ]);

    showToast(
      `Material "${form.nama_barang}" (+${stokCount} ${form.satuan}) berhasil masuk ke gudang!`,
      'success'
    );

    // Reset form
    setForm({
      nama_barang: '',
      stok: 1,
      satuan: 'pcs'
    });
    setSerialNumbers([]);
    setInputSn('');
  };

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <div className={`p-6 sm:p-8 rounded-3xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} transition-colors`}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
          <span className="p-2.5 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
            <PlusCircle className="w-5 h-5" />
          </span>
          <div>
            <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
              <span>Input Pengadaan Barang Masuk Gudang</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                Logistik STO
              </span>
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
              Registrasi penambahan material fisik ke gudang STO Telkom Akses Payakumbuh.
            </p>
          </div>
        </div>



        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={`block font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Pilih Nama Barang / Material *
              </label>
              <select
                value={materialPresets.some(p => p.name === form.nama_barang) ? form.nama_barang : 'CUSTOM'}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setForm({ ...form, nama_barang: '' });
                  } else {
                    const preset = materialPresets.find(p => p.name === val);
                    setForm({
                      ...form,
                      nama_barang: val,
                      satuan: preset ? preset.unit : form.satuan
                    });
                    if (!val.toLowerCase().includes('ont') && !val.toLowerCase().includes('modem')) {
                      setSerialNumbers([]);
                    }
                  }
                }}
                className={`w-full p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer`}
              >
                {materialPresets.map(preset => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name} ({preset.unit})
                  </option>
                ))}
                <option value="CUSTOM">➕ Lainnya (Ketik Manual Sendiri)</option>
              </select>

              {!materialPresets.some(p => p.name === form.nama_barang) && (
                <input
                  type="text"
                  required
                  placeholder="Ketik nama material baru..."
                  value={form.nama_barang}
                  onChange={e => setForm({ ...form, nama_barang: e.target.value })}
                  className={`mt-2 w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} focus:outline-none focus:border-emerald-500 font-semibold`}
                />
              )}
            </div>

            <div>
              <label className={`block font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Satuan Ukuran *
              </label>
              <select
                value={form.satuan}
                onChange={e => setForm({ ...form, satuan: e.target.value })}
                className={`w-full p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} focus:outline-none focus:border-emerald-500 cursor-pointer font-bold`}
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
            <div className={`p-4 sm:p-5 rounded-2xl border ${isDark ? 'bg-purple-950/20 border-purple-500/30' : 'bg-purple-50/70 border-purple-200'} space-y-3.5 animate-in fade-in duration-200`}>
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
                      Anda dapat melakukan scan barcode, ketik manual, atau langsung memasukkan jumlah stok di bawah tanpa scan.
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
                    className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow"
                  >
                    <Camera className="w-3 h-3" />
                    <span>{isScanningCamera ? 'Tutup Kamera' : 'Scan Kamera'}</span>
                  </button>
                </div>
              </div>

              {/* Kamera Scanner UI (Opsional) */}
              {isScanningCamera && (
                <div className="p-4 rounded-2xl bg-black/80 border border-purple-500/50 text-center space-y-3">
                  <div className="w-48 h-28 mx-auto border-2 border-dashed border-purple-400 rounded-xl flex items-center justify-center text-purple-300 flex-col gap-1 text-[11px]">
                    <Camera className="w-6 h-6 animate-pulse text-purple-400" />
                    <span>Arahkan kamera ke barcode dus ONT</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateScan}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                  >
                    ✓ Tangkap & Scan Barcode
                  </button>
                </div>
              )}

              {/* Input Scan Barcode SN Manual */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Scan barcode fisik atau ketik SN (misal: ZTEGC8B90112)"
                  value={inputSn}
                  onChange={(e) => setInputSn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddManualSn();
                    }
                  }}
                  className={`flex-1 p-2.5 rounded-xl border font-mono uppercase font-bold text-xs ${isDark ? 'bg-slate-950 border-purple-700/60 text-white placeholder-slate-500' : 'bg-white border-purple-300 text-slate-900 placeholder-slate-400'} focus:outline-none focus:border-purple-500`}
                />
                <button
                  type="button"
                  onClick={handleAddManualSn}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Barcode className="w-3.5 h-3.5" />
                  <span>+ Tambah SN</span>
                </button>
              </div>

              {/* Daftar Tag SN Terdaftar */}
              {serialNumbers.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>SN Tercatat ({serialNumbers.length} unit):</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSerialNumbers([]);
                        setForm(prev => ({ ...prev, stok: 1 }));
                      }}
                      className="text-rose-400 hover:underline cursor-pointer font-bold"
                    >
                      Hapus Semua SN
                    </button>
                  </div>

                  <div className={`p-3 rounded-xl border max-h-36 overflow-y-auto flex flex-wrap gap-1.5 ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'}`}>
                    {serialNumbers.map((sn, idx) => (
                      <span
                        key={sn + idx}
                        className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[11px] font-bold flex items-center gap-1.5"
                      >
                        <Barcode className="w-3 h-3 text-purple-400" />
                        <span>{sn}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSn(idx)}
                          className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer font-black text-xs"
                          title="Hapus SN ini"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className={`block font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Jumlah Stok Masuk Fisik *
              </label>
              <input
                type="number"
                min="1"
                required
                value={serialNumbers.length > 0 ? serialNumbers.length : form.stok}
                onChange={e => setForm({ ...form, stok: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className={`w-full p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} focus:outline-none focus:border-emerald-500 font-bold`}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {isOntItem && serialNumbers.length > 0
                  ? `Kuantitas otomatis disesuaikan dengan jumlah ${serialNumbers.length} Serial Number tercatat.`
                  : 'Jumlah fisik material yang masuk dan siap diletakkan di rak gudang STO.'}
              </p>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-950 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Simpan</span>
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* Riwayat Input Sesi Ini */}
      <div className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Riwayat Input Pengadaan Material Sesi Ini
            </h3>
          </div>
          <span className="text-[10px] text-slate-500">Tersimpan di Supabase Cloud</span>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <thead className={`${isDark ? 'bg-slate-950/60 text-slate-400' : 'bg-slate-50 text-slate-600'} text-[10px] uppercase font-bold`}>
              <tr>
                <th className="px-4 py-2.5 rounded-l-xl">Waktu Transaksi</th>
                <th className="px-4 py-2.5">Nama Material</th>
                <th className="px-4 py-2.5 text-right">Jumlah Masuk</th>
                <th className="px-4 py-2.5 text-center">Nomor Seri (SN)</th>
                <th className="px-4 py-2.5 rounded-r-xl text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {historyLog.map(item => (
                <tr key={item.id} className={`${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'} transition`}>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{item.waktu}</td>
                  <td className="px-4 py-3 font-semibold">{item.nama_barang}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-500">
                    +{item.jumlah} {item.satuan}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.serial_count > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-mono font-bold">
                        {item.serial_count} SN Barcode
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                      Tersimpan di Rak
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
