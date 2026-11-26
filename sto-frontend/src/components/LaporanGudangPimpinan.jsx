import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import {
  Boxes,
  Package,
  AlertTriangle,
  Truck,
  Search,
  Check,
  Download,
  FileSpreadsheet,
  MapPin
} from 'lucide-react';
import { parseTaskDetails } from '../utils/taskFormatter';

export default function LaporanGudangPimpinan() {
  const { isDark } = useTheme();
  const {
    tugas = [],
    permohonan = [],
    barang = [],
    users = []
  } = useApp();

  // State untuk Laporan Logistik & Gudang Pimpinan
  const [searchGudang, setSearchGudang] = useState('');
  const [filterKategoriGudang, setFilterKategoriGudang] = useState('all');
  const [subTabGudang, setSubTabGudang] = useState('master'); // 'master' | 'mutasi'

  // Resolusi Kategori Standar Telkom Akses (Real Database Mapping)
  const resolveKategori = useCallback((b) => {
    if (b.kategori && b.kategori !== 'Umum' && b.kategori !== 'Material' && b.kategori !== 'Logistik Sentral') return b.kategori;
    const name = (b.nama_barang || '').toLowerCase();
    const cat = (b.kategori || '').toLowerCase();

    // 1. Perangkat Aktif ONT (Modem, ONT, STB, CPE, Router)
    if (
      name.includes('ont') || name.includes('modem') || name.includes('zte') ||
      name.includes('huawei') || name.includes('fiberhome') || name.includes('stb') ||
      cat.includes('aktif') || cat.includes('modem') || cat.includes('ont')
    ) {
      if (name.includes('adaptor') || name.includes('adapter') || name.includes('power')) {
        return 'Consumable & Aksesoris';
      }
      if (name.includes('lan') || name.includes('utp')) {
        return 'Kabel & Serat Optik';
      }
      return 'Perangkat Aktif (ONT)';
    }

    // 2. Perangkat Pasif (Roset, Splitter, Patchcord, Pigtail, ODP Box)
    if (
      name.includes('roset') || name.includes('splitter') || name.includes('patchcord') ||
      name.includes('patch cord') || name.includes('pigtail') || name.includes('odp') ||
      cat.includes('pasif')
    ) {
      return 'Perangkat Pasif';
    }

    // 3. Kabel & Serat Optik (Dropcore, Kabel FO, Pre-Conn, UTP)
    if (
      !name.includes('clamp') && !name.includes('klem') && !name.includes('hook') &&
      (name.includes('kabel') || name.includes('dropcore') || name.includes('drop core') ||
       name.includes('fo') || name.includes('fiber') || name.includes('serat') ||
       name.includes('utp') || name.includes('lan') || cat.includes('kabel') || cat.includes('serat'))
    ) {
      return 'Kabel & Serat Optik';
    }

    return 'Consumable & Aksesoris';
  }, []);

  const totalUnitFisikGudang = useMemo(() => {
    return barang.reduce((acc, b) => acc + (Number(b.stok) || 0), 0);
  }, [barang]);

  const lowStockCount = useMemo(() => {
    return barang.filter(b => Number(b.stok) <= 20).length;
  }, [barang]);

  const releasedMutations = useMemo(() => {
    return permohonan
      .filter(p => p.status === 'Released')
      .map(p => {
        const parentTask = tugas.find(t => Number(t.id) === Number(p.tugas_id) || (Array.isArray(p.tugas_ids) && p.tugas_ids.map(Number).includes(Number(t.id))));
        const tech = users.find(u => Number(u.id) === Number(parentTask?.teknisi_id || p.teknisi_id)) || { nama_lengkap: p.teknisi_nama || 'Teknisi STO' };
        return {
          ...p,
          parentTask: p.parentTask || parentTask,
          tech: p.tech || tech
        };
      });
  }, [permohonan, tugas, users]);

  const filteredPimpinanBarang = useMemo(() => {
    const q = searchGudang.toLowerCase().trim();
    return barang
      .map(b => ({
        ...b,
        kategori: resolveKategori(b),
        kode: b.kode || `SKU-TEL-${String(b.id).padStart(3, '0')}`
      }))
      .filter(b => {
        const matchSearch = !q ||
          (b.nama_barang || '').toLowerCase().includes(q) ||
          (b.kode || '').toLowerCase().includes(q);
        const matchCat = filterKategoriGudang === 'all' || b.kategori === filterKategoriGudang;
        return matchSearch && matchCat;
      });
  }, [barang, searchGudang, filterKategoriGudang, resolveKategori]);

  const handleExportCsv = useCallback(() => {
    const headers = ['Kode SKU', 'Nama Material', 'Kategori', 'Stok Fisik', 'Satuan', 'Status Gudang'];
    const rows = filteredPimpinanBarang.map(b => [
      `"${b.kode}"`,
      `"${b.nama_barang}"`,
      `"${b.kategori}"`,
      b.stok,
      `"${b.satuan}"`,
      `"${b.stok <= 20 ? 'Perlu Restock' : 'Aman'}"`
    ]);

    const mutasiTitle = ['\n\n=== RIWAYAT PENGELUARAN MATERIAL KE TEKNISI (LOGISTIK REALTIME) ===', '', '', '', '', ''];
    const mutasiHeaders = ['ID Permohonan', 'Tanggal Rilis', 'Teknisi Penerima', 'Tiket / Pelanggan', 'Material Diberikan', 'Status'];
    const mutasiRows = releasedMutations.map(m => {
      const cust = parseTaskDetails(m.parentTask);
      return [
        `"REQ-${m.id}"`,
        `"${m.waktu_rilis || m.tanggal || '-'}"`,
        `"${m.tech?.nama_lengkap || m.teknisi_nama || '-'}"`,
        `"${m.parentTask ? `#${m.parentTask.id} - ${cust.name} (${cust.address})` : '-'}"`,
        `"${m.items ? m.items.map(it => `${it.nama_barang || it.nama} (${it.jumlah} ${it.satuan || 'pcs'})`).join(', ') : '-'}"`,
        `"${m.status}"`
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';')),
      mutasiTitle.join(';'),
      mutasiHeaders.join(';'),
      ...mutasiRows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Logistik_Gudang_STO_Telkom_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredPimpinanBarang, releasedMutations]);

  // Handle global export event dari header DashboardPimpinan
  useEffect(() => {
    const handleGlobalExport = () => handleExportCsv();
    window.addEventListener('sto:export-gudang', handleGlobalExport);
    return () => window.removeEventListener('sto:export-gudang', handleGlobalExport);
  }, [handleExportCsv]);

  return (
    <div className={`p-3.5 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border w-full min-w-0 ${
      isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
    } space-y-5 animate-in fade-in duration-200`}>

      {/* 4 Kartu KPI Ringkasan Logistik */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 w-full">
        <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Stok Fisik</span>
            <Boxes className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {totalUnitFisikGudang.toLocaleString()}
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Varian SKU</span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {barang.length}
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Stok Kritis / Menipis</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className={`text-xl font-black ${lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {lowStockCount}
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Material Keluar</span>
            <Truck className="w-4 h-4 text-purple-400" aria-hidden="true" />
          </div>
          <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {releasedMutations.length}
          </div>
        </div>
      </div>

      {/* Sub-Tab Switcher: Master Stok vs Riwayat Mutasi Keluar (Adaptif Mobile 2-Kolom & Desktop, Tanpa Tombol Export Redundan) */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:items-center">
          <button
            type="button"
            onClick={() => setSubTabGudang('master')}
            className={`px-3 py-2 sm:px-4 rounded-xl text-xs font-bold transition cursor-pointer text-center whitespace-nowrap ${
              subTabGudang === 'master'
                ? 'bg-rose-600 text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-white bg-slate-950/50' : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            <span className="md:hidden">Stok Fisik ({barang.length})</span>
            <span className="hidden md:inline">Master Stok Fisik Gudang ({barang.length} Material)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTabGudang('mutasi')}
            className={`px-3 py-2 sm:px-4 rounded-xl text-xs font-bold transition cursor-pointer text-center whitespace-nowrap ${
              subTabGudang === 'mutasi'
                ? 'bg-rose-600 text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-white bg-slate-950/50' : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            <span className="md:hidden">Riwayat Keluar ({releasedMutations.length})</span>
            <span className="hidden md:inline">Riwayat Serah Terima ke Teknisi ({releasedMutations.length} Transaksi)</span>
          </button>
        </div>
      </div>

      {/* TAMPILAN SUB-TAB 1: MASTER STOK FISIK GUDANG */}
      {subTabGudang === 'master' && (
        <div className="space-y-4 animate-in fade-in w-full min-w-0">
          {/* Toolbar Filter & Pencarian */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama material / kode SKU (misal: Dropcore, ONT, Roset)..."
                value={searchGudang}
                onChange={(e) => setSearchGudang(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterKategoriGudang}
                onChange={(e) => setFilterKategoriGudang(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 cursor-pointer w-full sm:w-auto"
              >
                <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Semua Kategori</option>
                <option value="Kabel & Serat Optik" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Kabel & Serat Optik</option>
                <option value="Perangkat Aktif (ONT)" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Perangkat Aktif (ONT)</option>
                <option value="Perangkat Pasif" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Perangkat Pasif</option>
                <option value="Consumable & Aksesoris" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Consumable & Aksesoris</option>
              </select>
            </div>
          </div>

          {/* 1. Tampilan Mobile Card View (< md: block md:hidden) */}
          <div className="block md:hidden space-y-2.5">
            {filteredPimpinanBarang.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 italic">
                Tidak ada material yang cocok dengan filter ini.
              </div>
            ) : (
              filteredPimpinanBarang.map(item => {
                const isCritical = Number(item.stok) <= 20;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition space-y-2.5 ${
                      isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {/* Header Card: Kode SKU & Status Gudang */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/5">
                      <span className="font-mono text-xs font-bold text-rose-400">
                        {item.kode}
                      </span>
                      {isCritical ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap inline-flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Perlu Restock
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Aman
                        </span>
                      )}
                    </div>

                    {/* Body Card: Nama Material & Kategori */}
                    <div className="space-y-1">
                      <div className={`font-bold text-sm leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {item.nama_barang}
                      </div>
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {item.kategori}
                        </span>
                      </div>
                    </div>

                    {/* Footer Card: Jumlah Stok Fisik */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Jumlah Stok Fisik:</span>
                      <div className="text-right">
                        <span className={`font-mono font-black text-sm ${isCritical ? 'text-rose-400' : isDark ? 'text-white' : 'text-slate-900'}`}>
                          {Number(item.stok).toLocaleString()}
                        </span>{' '}
                        <span className="text-slate-400 text-[11px]">{item.satuan}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 2. Tampilan Desktop Table View (md:table) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <thead className={`${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'} uppercase text-[10px] tracking-wider border-b`}>
                <tr>
                  <th className="px-4 py-3 w-[140px] whitespace-nowrap">Kode SKU</th>
                  <th className="px-4 py-3 min-w-[200px]">Nama Material</th>
                  <th className="px-4 py-3 w-[180px] whitespace-nowrap">Kategori</th>
                  <th className="px-4 py-3 w-[120px] text-right whitespace-nowrap">Stok</th>
                  <th className="px-4 py-3 w-[140px] text-center whitespace-nowrap">Status Gudang</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                {filteredPimpinanBarang.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-500 italic">
                      Tidak ada material yang cocok dengan filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredPimpinanBarang.map(item => {
                    const isCritical = Number(item.stok) <= 20;
                    return (
                      <tr key={item.id} className={`${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} transition`}>
                        <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">{item.kode}</td>
                        <td className={`px-4 py-3 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.nama_barang}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {item.kategori}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`font-semibold ${isCritical ? 'text-rose-400 font-bold' : isDark ? 'text-white' : 'text-slate-900'}`}>
                            {Number(item.stok).toLocaleString()}
                          </span>{' '}
                          <span className="text-slate-400 text-xs">{item.satuan}</span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {isCritical ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Perlu Restock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Aman
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAMPILAN SUB-TAB 2: RIWAYAT SERAH TERIMA / MUTASI KELUAR */}
      {subTabGudang === 'mutasi' && (
        <div className="space-y-4 animate-in fade-in w-full min-w-0">
          {/* 1. Tampilan Mobile Card View (< md: block md:hidden) */}
          <div className="block md:hidden space-y-2.5">
            {releasedMutations.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800 text-center text-xs text-slate-500 italic">
                Belum ada mutasi material yang dirilis ke teknisi.
              </div>
            ) : (
              releasedMutations.map(req => {
                const cust = parseTaskDetails(req.parentTask);
                return (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-2xl border transition space-y-2.5 ${
                      isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {/* Header Card: Nomor Permohonan & Status Logistik */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/5">
                      <span className="font-mono font-bold text-xs text-rose-400">
                        #REQ-{String(req.id).padStart(4, '0')}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1 whitespace-nowrap">
                        <Check className="w-2.5 h-2.5" />
                        <span>Released</span>
                      </span>
                    </div>

                    {/* Body Card: Info Pelanggan & Alamat, serta Teknisi */}
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <div className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          <span>{cust.name}</span>
                          {cust.telp && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal ml-1">
                              • {cust.telp}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate pt-0.5" title={cust.address}>
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate">{cust.address}</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-white/5">
                        <span>Teknisi:</span>
                        <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>
                          {req.tech?.nama_lengkap || req.teknisi_nama || 'Teknisi STO'}
                        </strong>
                      </div>
                    </div>

                    {/* Footer Card: Material yang diserahkan dan waktu rilis */}
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {req.items && req.items.length > 0 ? (
                          req.items.map((it, idx) => (
                            <span key={idx} className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                              {it.nama_barang || it.nama}: <strong>{it.jumlah} {it.satuan || 'pcs'}</strong>
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Material Standar Lapangan</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono text-right">
                        {req.waktu_rilis || req.created_at || 'Hari ini'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 2. Tampilan Desktop Table View (md:table) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <thead className={`${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'} uppercase text-[10px] tracking-wider border-b`}>
                <tr>
                  <th className="px-4 py-3 w-[130px] whitespace-nowrap">No. Permohonan</th>
                  <th className="px-4 py-3 w-[140px] whitespace-nowrap">Waktu Rilis</th>
                  <th className="px-4 py-3 w-[160px]">Teknisi Lapangan</th>
                  <th className="px-4 py-3 min-w-[200px]">Acuan Tiket &amp; Lokasi</th>
                  <th className="px-4 py-3 min-w-[200px]">Material yang Diberikan</th>
                  <th className="px-4 py-3 w-[140px] text-center whitespace-nowrap">Status Logistik</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                {releasedMutations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500 italic">
                      Belum ada mutasi material yang dirilis ke teknisi.
                    </td>
                  </tr>
                ) : (
                  releasedMutations.map(req => {
                    const cust = parseTaskDetails(req.parentTask);
                    return (
                      <tr key={req.id} className={`${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} transition`}>
                        <td className="px-4 py-3 font-mono font-bold text-rose-400 whitespace-nowrap">
                          REQ-{String(req.id).padStart(4, '0')}
                        </td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {req.waktu_rilis || req.created_at || 'Hari ini'}
                        </td>
                        <td className="px-4 py-3">
                          <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {req.tech?.nama_lengkap || req.teknisi_nama || 'Teknisi STO'}
                          </div>
                          <div className="text-[10px] text-slate-400">Role: Teknisi Lapangan</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5 min-w-0">
                            <div className={`font-semibold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              <span>{cust.name}</span>
                              {cust.telp && (
                                <span className="text-[10px] text-slate-400 font-mono font-normal ml-1">
                                  • {cust.telp}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate" title={cust.address}>
                              <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                              <span className="truncate max-w-[200px]">{cust.address}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {req.items && req.items.length > 0 ? (
                              req.items.map((it, idx) => (
                                <span key={idx} className="inline-block mr-1.5 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                                  {it.nama_barang || it.nama}: <strong>{it.jumlah} {it.satuan || 'pcs'}</strong>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 italic">Material Standar Lapangan</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1 whitespace-nowrap">
                            <Check className="w-3 h-3" />
                            <span>Released / Diserahkan</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
