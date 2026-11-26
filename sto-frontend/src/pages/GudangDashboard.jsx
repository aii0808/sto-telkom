import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Edit2,
  Trash2,
  Search,
  TrendingDown,
  PackageCheck,
  Boxes,
  ClipboardCheck,
  FileText,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Barcode,
  PlusCircle,
  PieChart,
  BarChart3,
  Download,
  FileSpreadsheet,
  Truck,
  Check,
  MapPin
} from 'lucide-react';
import ModernSidebar from '../components/ModernSidebar';
import InputBarangGudang from '../components/InputBarangGudang';
import CetakSuratJalan from '../components/CetakSuratJalan';
import ModalBASTP from '../components/ModalBASTP';
import TabelPelangganAset from '../components/TabelPelangganAset';
import TabelPermohonanGudang from '../components/gudang/TabelPermohonanGudang';
import TabelKatalogBarang from '../components/gudang/TabelKatalogBarang';
import TabelRiwayatMutasi from '../components/gudang/TabelRiwayatMutasi';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { parseTaskDetails } from '../utils/taskFormatter';

// Helper pemformat kode terminasi ODP standar Telkom
const formatOdpAudit = (rawOdp, odpList = []) => {
  if (!rawOdp || rawOdp === '-') return '-';
  const str = String(rawOdp).trim();
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    const matched = odpList.find(o => Number(o.id) === num);
    if (matched && matched.kode_odp) {
      const portNum = String(matched.port_terpakai || num % 8 || 1).padStart(2, '0');
      return `${matched.kode_odp} (Port ${portNum})`;
    }
    const paddedId = String(num).padStart(3, '0');
    const portNum = String(num % 8 || 1).padStart(2, '0');
    return `ODP-PYK-FA/${paddedId} (Port ${portNum})`;
  }
  if (/^ODP-[A-Z0-9\/-]+$/i.test(str)) {
    return `${str} (Port 01)`;
  }
  return str;
};

export default function GudangDashboard() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const {
    barang,
    permohonan,
    detailPermohonan,
    tugas,
    users,
    pelanggan,
    odp: odpList = [],
    releaseMaterial,
    updateBarang,
    tambahStokBarang,
    deleteBarang,
    ontSerials = [],
    showToast,
    sidebarCollapsed
  } = useApp();

  const user = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || { id: 4, nama_lengkap: 'Siti Rahmawati', role: 'gudang' };
    } catch {
      return { id: 4, nama_lengkap: 'Siti Rahmawati', role: 'gudang' };
    }
  }, []);

  const [activeMenu, setActiveMenu] = useState(() => {
    try {
      // Gunakan sessionStorage agar saat pertama login/buka aplikasi selalu tampil Dashboard Gudang Utama
      const saved = sessionStorage.getItem('sto_active_tab_gudang');
      if (saved === 'daftar-barang') return 'dashboard-gudang';
      const valid = [
        'dashboard-gudang',
        'tabel-material',
        'input-barang',
        'output-barang',
        'audit-ont',
        'penarikan-aset',
        'cetak-surat-jalan'
      ];
      return saved && valid.includes(saved) ? saved : 'dashboard-gudang';
    } catch {
      return 'dashboard-gudang';
    }
  });

  const handleSetActiveMenu = (tab) => {
    setActiveMenu(tab);
    try {
      sessionStorage.setItem('sto_active_tab_gudang', tab);
      window.history.pushState({ role: 'gudang', tab }, '', window.location.pathname);
    } catch {}
  };

  // Mencegah tombol Back browser kembali ke halaman Login tanpa logout eksplisit
  useEffect(() => {
    window.history.pushState({ role: 'gudang', tab: activeMenu }, '', window.location.pathname);

    const handlePopState = (e) => {
      // Jika pengguna menekan tombol Back saat berada di sub-menu gudang, arahkan kembali ke Dashboard Utama
      if (activeMenu !== 'dashboard-gudang') {
        setActiveMenu('dashboard-gudang');
        try {
          sessionStorage.setItem('sto_active_tab_gudang', 'dashboard-gudang');
        } catch {}
        window.history.pushState({ role: 'gudang', tab: 'dashboard-gudang' }, '', window.location.pathname);
      } else {
        // Jika sudah di dashboard utama, cegah browser back ke form login
        window.history.pushState({ role: 'gudang', tab: 'dashboard-gudang' }, '', window.location.pathname);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeMenu]);

  // Reset tab ke dashboard gudang jika logo diklik
  useEffect(() => {
    const handleReset = (e) => {
      if (!e.detail?.role || e.detail.role === 'gudang') {
        setActiveMenu('dashboard-gudang');
        try {
          sessionStorage.setItem('sto_active_tab_gudang', 'dashboard-gudang');
        } catch {}
      }
    };
    window.addEventListener('sto:reset-dashboard-tab', handleReset);
    return () => window.removeEventListener('sto:reset-dashboard-tab', handleReset);
  }, []);
  const [ontSearchQuery, setOntSearchQuery] = useState('');
  const [ontStatusFilter, setOntStatusFilter] = useState('all');

  // Modals & Subtabs
  const [bastpModalTask, setBastpModalTask] = useState(null);
  const [selectedSuratJalanReqId, setSelectedSuratJalanReqId] = useState(null);

  const handleNavigateToSuratJalan = (req) => {
    if (req?.id) {
      setSelectedSuratJalanReqId(req.id);
    }
    handleSetActiveMenu('cetak-surat-jalan');
  };

  useEffect(() => {
    if (!user || user?.role !== 'gudang') {
      navigate('/');
    }
  }, [navigate, user]);

  // Permohonan material masuk dari teknisi yang siap diserahkan oleh petugas gudang
  const approvedRequests = permohonan.filter(p => p.status !== 'Released' && p.status !== 'Rejected' && p.status !== 'Batal').map(p => {
    const parentTask = tugas.find(t => Number(t.id) === Number(p.tugas_id) || (Array.isArray(p.tugas_ids) && p.tugas_ids.map(Number).includes(Number(t.id))));
    const tech = users.find(u => Number(u.id) === Number(parentTask?.teknisi_id || p.teknisi_id)) || { nama_lengkap: p.teknisi_nama || 'Teknisi Lapangan' };
    const details = detailPermohonan.filter(d => Number(d.permohonan_id) === Number(p.id)).map(d => {
      const item = barang.find(b => Number(b.id) === Number(d.barang_id));
      return {
        ...d,
        item,
        isStockEnough: item ? Number(item.stok) >= Number(d.jumlah_minta) : false
      };
    });

    const canRelease = details.length > 0 ? details.every(d => d.isStockEnough) : true;

    return {
      ...p,
      parentTask,
      tech,
      details,
      canRelease
    };
  });

  // Released history
  const releasedRequests = permohonan.filter(p => p.status === 'Released').map(p => {
    const parentTask = tugas.find(t => Number(t.id) === Number(p.tugas_id) || (Array.isArray(p.tugas_ids) && p.tugas_ids.map(Number).includes(Number(t.id))));
    const tech = users.find(u => Number(u.id) === Number(parentTask?.teknisi_id || p.teknisi_id)) || { nama_lengkap: p.teknisi_nama || 'Teknisi Lapangan' };
    const details = detailPermohonan.filter(d => Number(d.permohonan_id) === Number(p.id)).map(d => {
      const item = barang.find(b => Number(b.id) === Number(d.barang_id));
      return { ...d, item };
    });

    return { ...p, parentTask, tech, details };
  });

  // KPI calculations
  const totalItemCount = barang.length;
  const lowStockItems = barang.filter(b => b.stok <= 20).length;
  const pendingReleaseCount = approvedRequests.length;
  const totalReleasedCount = releasedRequests.length;

  // Resolusi kategori otomatis berdasarkan nama barang standar Telkom
  const resolveKategori = (b) => {
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
  };

  // Hitung distribusi kategori riil 100% dari data database Supabase
  const categoryStats = React.useMemo(() => {
    let kabelQty = 0;
    let ontQty = 0;
    let pasifQty = 0;
    let consumableQty = 0;

    barang.forEach(b => {
      const cat = resolveKategori(b);
      const qty = Number(b.stok) || 0;
      if (cat === 'Kabel & Serat Optik') kabelQty += qty;
      else if (cat === 'Perangkat Aktif (ONT)') ontQty += qty;
      else if (cat === 'Perangkat Pasif') pasifQty += qty;
      else consumableQty += qty;
    });

    const totalQty = kabelQty + ontQty + pasifQty + consumableQty;
    const circumference = 2 * Math.PI * 38; // 238.76

    const calcSegment = (qty) => {
      if (totalQty === 0) return { len: 0, pct: 0 };
      const ratio = qty / totalQty;
      return {
        len: Math.round(ratio * circumference * 10) / 10,
        pct: Math.round(ratio * 1000) / 10
      };
    };

    const sKabel = calcSegment(kabelQty);
    const sOnt = calcSegment(ontQty);
    const sPasif = calcSegment(pasifQty);
    const sConsumable = calcSegment(consumableQty);

    return {
      kabel: { qty: kabelQty, len: sKabel.len, pct: sKabel.pct, offset: 0 },
      ont: { qty: ontQty, len: sOnt.len, pct: sOnt.pct, offset: -sKabel.len },
      pasif: { qty: pasifQty, len: sPasif.len, pct: sPasif.pct, offset: -(sKabel.len + sOnt.len) },
      consumable: { qty: consumableQty, len: sConsumable.len, pct: sConsumable.pct, offset: -(sKabel.len + sOnt.len + sPasif.len) },
      totalQty,
      circumference
    };
  }, [barang]);

  // Data Audit Lifecycle ONT (Di Gudang -> Dibawa Teknisi -> Terpasang / Active)
  const ontInventoryList = React.useMemo(() => {
    const list = [];

    // 1. ONT yang terpasang di tiket selesai (Status: Terpasang di Pelanggan)
    tugas.forEach(t => {
      if (t.sn_ont || t.bastp?.sn_ont || t.status === 'Done') {
        const cust = parseTaskDetails(t);
        const cleanTelp = cust.telp || (t.pelanggan_telp && !t.pelanggan_telp.includes('xxxx') ? t.pelanggan_telp : '0812-7711-2233');

        list.push({
          id: `ONT-INST-${t.id}`,
          sn: t.sn_ont || t.bastp?.sn_ont || `ZTEGC8B901${String(t.id).padStart(2, '0')}`,
          model: 'Modem ONT ZTE F670L Dual Band',
          status: t.status === 'Done' ? 'Terpasang' : 'Dibawa Teknisi',
          pelanggan_nama: cust.name || 'Pelanggan STO',
          pelanggan_telp: cleanTelp,
          lokasi: cust.address || 'Payakumbuh',
          odp_id: t.odp_id || t.odp_kode || 'ODP-PYK-FA/001',
          odpFormatted: formatOdpAudit(t.odp_id || t.odp_kode, odpList),
          redaman_dbm: t.redaman_dbm ? `${t.redaman_dbm} dBm` : '-18.50 dBm',
          bastp_no: t.bastp_no || `BASTP/TA-PYK/2026/${String(t.id).padStart(4, '0')}`,
          teknisi: users.find(u => Number(u.id) === Number(t.teknisi_id))?.nama_lengkap || 'Teknisi Lapangan',
          waktu: t.closed_at || t.waktu_selesai || 'Aktif Terpasang'
        });
      }
    });

    // 2. ONT yang sedang di perjalanan bersama teknisi (Dibawa Teknisi)
    releasedRequests.forEach(rel => {
      const isDone = rel.parentTask?.status === 'Done';
      if (!isDone) {
        const alreadyIn = list.some(o => o.sn === (rel.parentTask?.sn_ont || `ZTEGC8B901${String(rel.parentTask?.id || 1).padStart(2, '0')}`));
        if (!alreadyIn) {
          const cust = parseTaskDetails(rel.parentTask);
          const cleanTelp = cust.telp || (rel.parentTask?.pelanggan_telp && !rel.parentTask.pelanggan_telp.includes('xxxx') ? rel.parentTask.pelanggan_telp : '0813-8822-4455');

          list.push({
            id: `ONT-TRANS-${rel.id}`,
            sn: rel.parentTask?.sn_ont || `ZTEGC8B901${String(rel.parentTask?.id || 1).padStart(2, '0')}`,
            model: 'Modem ONT ZTE F670L Dual Band',
            status: 'Dibawa Teknisi',
            pelanggan_nama: cust.name || 'Pelanggan STO',
            pelanggan_telp: cleanTelp,
            lokasi: cust.address || 'Koto Nan IV',
            odp_id: rel.parentTask?.odp_kode || rel.parentTask?.odp_id || 'ODP-PYK-FA/001',
            odpFormatted: formatOdpAudit(rel.parentTask?.odp_kode || rel.parentTask?.odp_id, odpList),
            redaman_dbm: 'Belum Diukur (Dibawa Teknisi)',
            bastp_no: 'Menunggu Closing',
            teknisi: rel.tech?.nama_lengkap || 'Teknisi STO',
            waktu: rel.waktu_rilis || 'Dibawa Teknisi'
          });
        }
      }
    });

    // 3. ONT yang masih ready stock di rak gudang (Status: Di Gudang)
    // HANYA jika barang ONT/Modem ada di master barang gudang dan memiliki stok > 0
    const activeOntItems = barang.filter(b => {
      const name = (b.nama_barang || '').toLowerCase();
      return (name.includes('ont') || name.includes('modem')) && Number(b.stok) > 0;
    });

    activeOntItems.forEach((ontItem, itemIdx) => {
      const stockGudangCount = Number(ontItem.stok);
      const limit = Math.min(stockGudangCount, 4);
      for (let i = 1; i <= limit; i++) {
        const itemSn = `ZTEGC8B902${String(i + (itemIdx * 4)).padStart(2, '0')}`;
        if (!list.some(existing => existing.sn === itemSn)) {
          list.push({
            id: `ONT-WH-${ontItem.id}-${i}`,
            sn: itemSn,
            model: ontItem.nama_barang || 'Modem ONT ZTE F670L Dual Band',
            status: 'Di Gudang',
            pelanggan_nama: '-',
            pelanggan_telp: '-',
            lokasi: 'Rak Logistik Sentral STO',
            odp_id: '-',
            odpFormatted: '-',
            redaman_dbm: '-',
            bastp_no: '-',
            teknisi: 'Petugas Gudang (Siti Rahmawati)',
            waktu: 'Ready di Rak'
          });
        }
      }
    });

    // 4. Nomor seri yang baru didaftarkan melalui InputBarangGudang / state realtime ontSerials
    try {
      const serialSource = (Array.isArray(ontSerials) && ontSerials.length > 0)
        ? ontSerials
        : JSON.parse(localStorage.getItem('sto_ont_serials') || '[]');

      serialSource.forEach(s => {
        // Validasi: pastikan model barang masih aktif ada di gudang dengan stok > 0.
        // Jika di gudang barang dihapus, serial otomatis HILANG seketika dari tabel audit!
        const matchingBarang = barang.find(b => {
          const bName = String(b.nama_barang || '').toLowerCase().trim();
          const sModel = String(s.model || '').toLowerCase().trim();
          return bName === sModel || sModel.includes(bName) || bName.includes(sModel);
        });
        if (!matchingBarang || Number(matchingBarang.stok) <= 0) return;

        if (!list.some(item => item.sn === s.sn)) {
          list.push({
            id: `ONT-SOP-${s.id || s.sn}`,
            sn: s.sn,
            model: s.model || matchingBarang.nama_barang || 'Modem ONT ZTE F670L Dual Band',
            status: (s.status === 'Di Perjalanan' || s.status === 'Dibawa Teknisi') ? 'Dibawa Teknisi' : (s.status || 'Di Gudang'),
            pelanggan_nama: s.pelanggan || '-',
            pelanggan_telp: '-',
            lokasi: s.lokasi || 'Rak Logistik Sentral STO',
            odp_id: s.odp_id || '-',
            odpFormatted: formatOdpAudit(s.odp_id, odpList),
            redaman_dbm: '-',
            bastp_no: s.bastp_no || '-',
            teknisi: s.teknisi || 'Petugas Gudang (Siti Rahmawati)',
            waktu: s.waktu || 'Ready di Rak'
          });
        }
      });
    } catch { /* ignore */ }

    return list;
  }, [tugas, releasedRequests, users, barang, ontSerials, pelanggan, odpList]);

  // Filtered ONT List untuk pencarian & status tab
  const filteredOntList = React.useMemo(() => {
    return ontInventoryList.filter(item => {
      const q = ontSearchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        item.sn?.toLowerCase().includes(q) ||
        item.pelanggan_nama?.toLowerCase().includes(q) ||
        item.lokasi?.toLowerCase().includes(q) ||
        item.teknisi?.toLowerCase().includes(q) ||
        item.model?.toLowerCase().includes(q);

      const matchStatus = ontStatusFilter === 'all' ||
        item.status === ontStatusFilter ||
        (ontStatusFilter === 'Dibawa Teknisi' && (item.status === 'Dibawa Teknisi' || item.status === 'Di Perjalanan'));
      return matchSearch && matchStatus;
    });
  }, [ontInventoryList, ontSearchQuery, ontStatusFilter]);

  const handleViewBastpItem = (item) => {
    const taskId = Number(item.id?.replace('ONT-INST-', '').replace('ONT-TRANS-', '').replace('ONT-WH-', '').replace('ONT-SOP-', ''));
    const tsk = tugas.find(t => Number(t.id) === taskId) || {
      id: taskId || 1,
      pelanggan_nama: item.pelanggan_nama,
      pelanggan_telp: item.pelanggan_telp,
      lokasi: item.lokasi,
      odp_kode: item.odp_id,
      sn_ont: item.sn,
      redaman_dbm: item.redaman_dbm,
      status: 'Done'
    };
    setBastpModalTask(tsk);
  };

  const stockHealthStats = React.useMemo(() => {
    let aman = 0;
    let menipis = 0;
    let kritis = 0;
    barang.forEach(b => {
      if (b.stok <= 10) kritis++;
      else if (b.stok <= 20) menipis++;
      else aman++;
    });
    return { aman, menipis, kritis };
  }, [barang]);

  // Export Laporan Audit ke Excel (.csv)
  const handleExportExcel = () => {
    const headers = ['ID Material', 'Kode SKU', 'Nama Material', 'Kategori', 'Stok Fisik', 'Satuan', 'Status Stok'];
    const rows = barang.map(b => [
      `"${b.id}"`,
      `"${b.kode || `MAT-0${b.id}`}"`,
      `"${(b.nama_barang || '').replace(/"/g, '""')}"`,
      `"${(b.kategori || 'Umum').replace(/"/g, '""')}"`,
      b.stok,
      `"${b.satuan || 'pcs'}"`,
      `"${b.stok <= 10 ? 'KRITIS' : b.stok <= 20 ? 'MENIPIS' : 'AMAN'}"`
    ]);

    const ontSectionTitle = ['\n\n=== AUDIT LIFECYCLE ONT & DATA PELANGGAN TERPASANG (STANDAR STO TELKOM) ===', '', '', '', '', '', ''];
    const ontHeaders = ['ID ONT', 'Serial Number (SN)', 'Model Perangkat', 'Status ONT', 'Nama Pelanggan', 'Alamat Pemasangan', 'Acuan ODP', 'Redaman OPM', 'No BASTP', 'Teknisi Penginstal'];
    const ontRows = ontInventoryList.map(o => [
      `"${o.id}"`,
      `"${o.sn}"`,
      `"${o.model}"`,
      `"${o.status}"`,
      `"${o.pelanggan_nama}"`,
      `"${(o.lokasi || '').replace(/"/g, '""')}"`,
      `"${o.odp_id}"`,
      `"${o.redaman_dbm}"`,
      `"${o.bastp_no}"`,
      `"${o.teknisi}"`
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';')),
      ontSectionTitle.join(';'),
      ontHeaders.join(';'),
      ...ontRows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Audit_Gudang_STO_Payakumbuh_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Laporan Audit Gudang & Trasir ONT berhasil diexport ke file Excel (CSV)!', 'success');
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${
      isDark ? 'bg-[#0a0f1d] text-white' : 'bg-slate-50 text-slate-900'
    } transition-colors duration-300`}>
      
      {/* Left Sidebar Layout */}
      <ModernSidebar activeTab={activeMenu} onTabChange={handleSetActiveMenu} />

      {/* Main Content Area */}
      <main className={`flex-1 min-w-0 flex flex-col overflow-y-auto ${sidebarCollapsed ? 'md:pl-20' : 'md:pl-72'} transition-all duration-300`}>
        <div className="p-2.5 sm:p-4 space-y-3.5 flex-1 max-w-7xl w-full mx-auto">
          
          {/* Header Bar Ramping & Elegan (Enterprise Standard) */}
          <div className={`p-3 sm:p-3.5 rounded-2xl border ${
            isDark ? 'bg-slate-950/70 backdrop-blur-xl border-rose-950/30 shadow-[0_8px_30px_rgba(0,0,0,0.35)]' : 'bg-white border-slate-200 shadow-sm'
          } flex items-center justify-between gap-3 transition-colors`}>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
              <h1 className={`text-base sm:text-lg font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {activeMenu === 'dashboard-gudang' && 'Dashboard Logistik & Material'}
                {activeMenu === 'tabel-material' && 'Katalog Master Material FTTH'}
                {activeMenu === 'output-barang' && 'Persetujuan Pengeluaran Material'}
                {activeMenu === 'input-barang' && 'Input Pengadaan Barang Masuk'}
                {activeMenu === 'audit-ont' && 'Audit & Pelacakan Serial Number ONT'}
                {activeMenu === 'penarikan-aset' && 'Recovery & Penarikan Aset Dismantle'}
                {activeMenu === 'cetak-surat-jalan' && 'Cetak Surat Jalan & BASTP'}
              </h1>
            </div>
          </div>

          {/* Alert Notifikasi Permohonan Masuk dari Teknisi (Hanya tampil di ringkasan dashboard) */}
          {approvedRequests.length > 0 && activeMenu === 'dashboard-gudang' && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <PackageCheck className="w-5 h-5 animate-pulse" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-400">
                    Permohonan Material Teknisi ({approvedRequests.length} Menunggu Otorisasi)
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Teknisi <strong>{approvedRequests[0]?.tech?.nama_lengkap || 'Teknisi'}</strong> mengajukan kebutuhan barang untuk Tiket #{approvedRequests[0]?.tugas_id}.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSetActiveMenu('output-barang')}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shrink-0 cursor-pointer transition shadow active:scale-95 flex items-center justify-center gap-1.5 self-stretch sm:self-auto"
              >
                <span>Proses Pengeluaran Material</span>
                <Truck className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* TAB: DASHBOARD & GRAFIK REALTIME GUDANG (VISUAL CHARTS ONLY) */}
          {activeMenu === 'dashboard-gudang' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* KPI Cards Realtime */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div
                  onClick={() => handleSetActiveMenu('output-barang')}
                  className={`${isDark ? 'bg-slate-900/80 border-slate-800 hover:border-amber-500/50' : 'bg-white border-slate-200 hover:border-amber-500/50 shadow-sm'} border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition`}
                >
                  <div>
                    <div className="text-[11px] text-amber-500 font-semibold uppercase">SIAP DISERAHKAN</div>
                    <div className="text-2xl font-extrabold text-amber-500 mt-1">{pendingReleaseCount}</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-500 border border-amber-500/30 flex items-center justify-center">
                    <PackageCheck className="w-5 h-5" aria-hidden="true" />
                  </div>
                </div>

                <div
                  onClick={() => handleSetActiveMenu('tabel-material')}
                  className={`${isDark ? 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-500/50 shadow-sm'} border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition`}
                >
                  <div>
                    <div className="text-[11px] text-emerald-500 font-semibold uppercase">TOTAL VARIAN SKU</div>
                    <div className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'} mt-1`}>{totalItemCount}</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center">
                    <Boxes className="w-5 h-5" />
                  </div>
                </div>

                <div
                  onClick={() => handleSetActiveMenu('tabel-material')}
                  className={`${isDark ? 'bg-slate-900/80 border-slate-800 hover:border-rose-500/50' : 'bg-white border-slate-200 hover:border-rose-500/50 shadow-sm'} border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition`}
                >
                  <div>
                    <div className="text-[11px] text-burgundy-500 font-semibold uppercase">STOK KRITIS / MENIPIS</div>
                    <div className="text-2xl font-extrabold text-burgundy-500 mt-1">{lowStockItems}</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-burgundy-600/20 text-burgundy-500 border border-burgundy-500/30 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                </div>

                <div
                  onClick={() => handleSetActiveMenu('audit-ont')}
                  className={`${isDark ? 'bg-slate-900/80 border-slate-800 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-500/50 shadow-sm'} border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition`}
                >
                  <div>
                    <div className="text-[11px] text-blue-500 font-semibold uppercase">TOTAL TRANSAKSI BASTP</div>
                    <div className="text-2xl font-extrabold text-blue-500 mt-1">{totalReleasedCount}</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-500 border border-blue-500/30 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* ANALYTICS CHARTS SECTION (DONUT & BAR CHART STOK GUDANG) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* 1. DONUT / PIE CHART: DISTRIBUSI KATEGORI MATERIAL GUDANG */}
                <div className={`${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-5 space-y-4`}>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                        <PieChart className="w-4 h-4" />
                      </div>
                      <h3 className={`text-xs sm:text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'} truncate`}>
                        Komposisi Kategori Material
                      </h3>
                    </div>
                    <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 whitespace-nowrap ml-2">
                      Total: {categoryStats.totalQty.toLocaleString()} Unit
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                    {/* SVG Donut Chart Dinamis */}
                    <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        {/* Background Ring */}
                        <circle cx="50" cy="50" r="38" fill="none" stroke={isDark ? '#1e293b' : '#f1f5f9'} strokeWidth="14" />
                        
                        {categoryStats.totalQty > 0 ? (
                          <>
                            {/* Segment 1: Kabel & Serat (Emerald) */}
                            {categoryStats.kabel.len > 0 && (
                              <circle
                                cx="50" cy="50" r="38" fill="none" stroke="#059669" strokeWidth="14"
                                strokeDasharray={`${categoryStats.kabel.len} ${categoryStats.circumference - categoryStats.kabel.len}`}
                                strokeDashoffset={categoryStats.kabel.offset}
                                strokeLinecap="round"
                              />
                            )}
                            {/* Segment 2: Perangkat Aktif ONT (Sky) */}
                            {categoryStats.ont.len > 0 && (
                              <circle
                                cx="50" cy="50" r="38" fill="none" stroke="#0284c7" strokeWidth="14"
                                strokeDasharray={`${categoryStats.ont.len} ${categoryStats.circumference - categoryStats.ont.len}`}
                                strokeDashoffset={categoryStats.ont.offset}
                                strokeLinecap="round"
                              />
                            )}
                            {/* Segment 3: Perangkat Pasif (Amber) */}
                            {categoryStats.pasif.len > 0 && (
                              <circle
                                cx="50" cy="50" r="38" fill="none" stroke="#d97706" strokeWidth="14"
                                strokeDasharray={`${categoryStats.pasif.len} ${categoryStats.circumference - categoryStats.pasif.len}`}
                                strokeDashoffset={categoryStats.pasif.offset}
                                strokeLinecap="round"
                              />
                            )}
                            {/* Segment 4: Aksesoris & Consumables (Purple) */}
                            {categoryStats.consumable.len > 0 && (
                              <circle
                                cx="50" cy="50" r="38" fill="none" stroke="#a855f7" strokeWidth="14"
                                strokeDasharray={`${categoryStats.consumable.len} ${categoryStats.circumference - categoryStats.consumable.len}`}
                                strokeDashoffset={categoryStats.consumable.offset}
                                strokeLinecap="round"
                              />
                            )}
                          </>
                        ) : null}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-black text-emerald-400">
                          {categoryStats.totalQty.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Unit Fisik</span>
                      </div>
                    </div>

                    {/* Legend Chips Real Data Database */}
                    <div className="flex-1 w-full space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <span className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Kabel &amp; Dropcore</span>
                        </span>
                        <strong className="font-mono text-emerald-400 text-xs">
                          {categoryStats.kabel.qty.toLocaleString()} unit ({categoryStats.kabel.pct}%)
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                          <span className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Perangkat Aktif (ONT)</span>
                        </span>
                        <strong className="font-mono text-sky-400 text-xs">
                          {categoryStats.ont.qty.toLocaleString()} unit ({categoryStats.ont.pct}%)
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                          <span className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Perangkat Pasif (Roset/Splitter)</span>
                        </span>
                        <strong className="font-mono text-amber-400 text-xs">
                          {categoryStats.pasif.qty.toLocaleString()} unit ({categoryStats.pasif.pct}%)
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                          <span className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Aksesoris &amp; Consumables</span>
                        </span>
                        <strong className="font-mono text-purple-400 text-xs">
                          {categoryStats.consumable.qty.toLocaleString()} unit ({categoryStats.consumable.pct}%)
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. BAR CHART: KESEHATAN & AMBANG BATAS STOK GUDANG */}
                <div className={`${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-5 space-y-4`}>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Monitoring Buffer Stock &amp; Ketersediaan
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-[10px] flex items-center gap-1 border border-slate-700 transition cursor-pointer"
                      title="Download format audit Excel CSV"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export CSV</span>
                    </button>
                  </div>

                  <div className="space-y-3.5 py-1 text-xs">
                    {/* Bar 1: Stok Aman */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-emerald-400">Stok Aman (&gt; 20 unit)</span>
                        <span className="font-mono font-bold text-slate-300">{stockHealthStats.aman} Jenis Material</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((stockHealthStats.aman / Math.max(1, barang.length)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Bar 2: Stok Menipis */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-amber-400">Stok Menipis (11 - 20 unit)</span>
                        <span className="font-mono font-bold text-slate-300">{stockHealthStats.menipis} Jenis Material</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((stockHealthStats.menipis / Math.max(1, barang.length)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Bar 3: Stok Kritis */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-rose-400">Stok Kritis (&le; 10 unit)</span>
                        <span className="font-mono font-bold text-rose-400">{stockHealthStats.kritis} Jenis Material</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((stockHealthStats.kritis / Math.max(1, barang.length)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* QUICK ACTION NAVIGATION CARDS (HUB LOGISTIK GUDANG STO) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div
                  onClick={() => handleSetActiveMenu('tabel-material')}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900' : 'bg-white border-slate-200 hover:border-emerald-500/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {barang.length} Item
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">Tabel Master Material</h4>
                  </div>
                </div>

                <div
                  onClick={() => handleSetActiveMenu('output-barang')}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? 'bg-slate-900/60 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900' : 'bg-white border-slate-200 hover:border-amber-500/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                      <PackageCheck className="w-4 h-4" aria-hidden="true" />
                    </div>
                    {pendingReleaseCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                        {pendingReleaseCount} Menunggu
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">Persetujuan Barang Keluar</h4>
                  </div>
                </div>

                <div
                  onClick={() => handleSetActiveMenu('audit-ont')}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? 'bg-slate-900/60 border-slate-800 hover:border-purple-500/50 hover:bg-slate-900' : 'bg-white border-slate-200 hover:border-purple-500/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                      <Barcode className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Tracking SN
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">Audit Serial Number ONT</h4>
                  </div>
                </div>

                <div
                  onClick={() => handleSetActiveMenu('penarikan-aset')}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? 'bg-slate-900/60 border-slate-800 hover:border-rose-500/50 hover:bg-slate-900' : 'bg-white border-slate-200 hover:border-rose-500/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Dismantle
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">Dismantle &amp; Recovery Aset</h4>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: INPUT BARANG (PENGADAAN) */}
          {activeMenu === 'input-barang' && (
            <div className="animate-in fade-in duration-200">
              <InputBarangGudang />
            </div>
          )}

          {/* TAB 2: OUTPUT BARANG (RILIS & SERAH TERIMA SOP 4) */}
          {activeMenu === 'output-barang' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <TabelPermohonanGudang
                onNavigateToSuratJalan={handleNavigateToSuratJalan}
              />
              <TabelRiwayatMutasi
                onViewBastp={setBastpModalTask}
              />
            </div>
          )}

          {/* TAB: TABEL MASTER MATERIAL (STOK & INVENTARIS GUDANG) */}
          {activeMenu === 'tabel-material' && (
            <div className="animate-in fade-in duration-200">
              <TabelKatalogBarang
                onNavigateToInputBarang={() => handleSetActiveMenu('input-barang')}
              />
            </div>
          )}

          {/* TAB: AUDIT & PELACAKAN ASET ONT (MENU KHUSUS AUDIT PERANGKAT TERPASANG) */}
          {activeMenu === 'audit-ont' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className={`${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl overflow-hidden shadow-xl space-y-4 p-4 sm:p-6`}>
                {/* Header Metrik & Export CSV (Sejajar Kompak Tanpa Judul Ganda) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                      Di Gudang: {ontInventoryList.filter(o => o.status === 'Di Gudang').length}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 whitespace-nowrap">
                      Dibawa Teknisi: {ontInventoryList.filter(o => o.status === 'Dibawa Teknisi' || o.status === 'Di Perjalanan').length}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                      Terpasang: {ontInventoryList.filter(o => o.status === 'Terpasang').length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV Audit</span>
                  </button>
                </div>

                {/* Toolbar Pencarian & Filter Pelacakan SN ONT */}
                <div className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="relative flex-1 w-full">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Lacak No. Seri ONT (misal: ZTEGC8B... / HWTC...) / Pelanggan / Alamat"
                      value={ontSearchQuery}
                      onChange={(e) => setOntSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500 font-mono rounded-xl text-xs"
                    />
                  </div>

                  <select
                    value={ontStatusFilter}
                    onChange={(e) => setOntStatusFilter(e.target.value)}
                    className="w-full md:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Semua Status</option>
                    <option value="Di Gudang" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Di Gudang (Rak)</option>
                    <option value="Dibawa Teknisi" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Dibawa Teknisi</option>
                    <option value="Terpasang" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Terpasang di Pelanggan</option>
                  </select>
                </div>

                {/* Mobile Card View (< md) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {filteredOntList.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 italic text-xs">
                      Tidak ada Serial Number ONT yang cocok dengan pencarian / filter ini.
                    </div>
                  ) : (
                    filteredOntList.map(item => {
                      const isInstalled = item.status === 'Terpasang';
                      const isTransit = item.status === 'Dibawa Teknisi' || item.status === 'Di Perjalanan';

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border ${
                            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                          } space-y-3 transition`}
                        >
                          {/* Header Kartu: Barcode + SN di kiri, Badge Status di kanan */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Barcode className="w-4 h-4 text-purple-400 shrink-0" />
                              <span className="font-mono font-bold text-xs text-rose-400 dark:text-rose-400 truncate">
                                {item.sn}
                              </span>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 inline-flex items-center gap-1 ${
                              isInstalled
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : isTransit
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {isInstalled && <Check className="w-3 h-3" />}
                              {isTransit && <Truck className="w-3 h-3" />}
                              <span>{isTransit ? 'Dibawa Teknisi' : item.status}</span>
                            </span>
                          </div>

                          {/* Body Kartu: Model, Alokasi / Pelanggan, ODP & OPM */}
                          <div className="space-y-2 text-xs">
                            <div className="text-[11px] font-medium text-slate-400">
                              {item.model}
                            </div>

                            {/* Alokasi Pelanggan & Alamat / Rak Gudang */}
                            <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'} space-y-1`}>
                              {isInstalled ? (
                                <>
                                  <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {item.pelanggan_nama} {item.pelanggan_telp && item.pelanggan_telp !== '-' ? `• ${item.pelanggan_telp}` : ''}
                                  </div>
                                  <div className="flex items-start gap-1 text-[11px] text-slate-400">
                                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                    <span>{item.lokasi}</span>
                                  </div>
                                </>
                              ) : isTransit ? (
                                <>
                                  <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    Dibawa: {item.teknisi}
                                  </div>
                                  <div className="flex items-start gap-1 text-[11px] text-slate-400">
                                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                    <span>Tujuan: {item.pelanggan_nama} ({item.lokasi})</span>
                                  </div>
                                </>
                              ) : (
                                <div className="text-slate-400 text-xs italic">
                                  Rak Logistik Sentral STO
                                </div>
                              )}
                            </div>

                            {/* Parameter: Titik ODP & Redaman OPM */}
                            {(isInstalled || isTransit) && (
                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/50">
                                <div>
                                  <span className="text-slate-400">Titik ODP: </span>
                                  <span className="font-mono text-amber-400 font-semibold">{item.odpFormatted}</span>
                                </div>
                                {item.redaman_dbm && item.redaman_dbm !== '-' && (
                                  <div>
                                    <span className="text-slate-400">OPM: </span>
                                    <span className="font-mono text-emerald-400 font-bold">{item.redaman_dbm}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Footer Kartu: BASTP / Teknisi & Tombol Lihat BASTP */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                            <div className="min-w-0">
                              <span className="font-mono text-[10px] text-slate-400 block truncate">
                                {item.bastp_no}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                Teknisi: {item.teknisi}
                              </span>
                            </div>
                            {isInstalled && (
                              <button
                                type="button"
                                onClick={() => handleViewBastpItem(item)}
                                className="px-2.5 py-1 rounded-lg bg-burgundy-600/20 hover:bg-burgundy-600/30 text-burgundy-400 border border-burgundy-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Lihat BASTP</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <thead className={`${isDark ? 'bg-slate-950/80 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'} uppercase text-[10px] tracking-wider border-b`}>
                      <tr>
                        <th className="px-3.5 py-3 whitespace-nowrap">Serial Number (SN Barcode)</th>
                        <th className="px-3.5 py-3 whitespace-nowrap">Model ONT</th>
                        <th className="px-3.5 py-3 text-center whitespace-nowrap">Status Aset</th>
                        <th className="px-3.5 py-3 min-w-[220px]">Alokasi / Pelanggan</th>
                        <th className="px-3.5 py-3 whitespace-nowrap">Titik ODP</th>
                        <th className="px-3.5 py-3 text-center whitespace-nowrap">Redaman OPM</th>
                        <th className="px-3.5 py-3 whitespace-nowrap">BASTP &amp; Teknisi</th>
                        <th className="px-3.5 py-3 text-center whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                      {filteredOntList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-slate-500 italic">
                            Tidak ada Serial Number ONT yang cocok dengan pencarian / filter ini.
                          </td>
                        </tr>
                      ) : (
                        filteredOntList.map(item => {
                          const isInstalled = item.status === 'Terpasang';
                          const isTransit = item.status === 'Dibawa Teknisi' || item.status === 'Di Perjalanan';

                          return (
                            <tr key={item.id} className={`${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} transition`}>
                              <td className="px-3.5 py-3 whitespace-nowrap">
                                <div className="font-mono font-bold text-xs text-rose-400 dark:text-rose-400 flex items-center gap-1.5">
                                  <Barcode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                  <span>{item.sn}</span>
                                </div>
                              </td>
                              <td className="px-3.5 py-3 font-medium text-[11px] text-slate-300 whitespace-nowrap">
                                {item.model}
                              </td>
                              <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                                  isInstalled
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : isTransit
                                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {isInstalled && <Check className="w-3 h-3" />}
                                  {isTransit && <Truck className="w-3 h-3" />}
                                  <span>{isTransit ? 'Dibawa Teknisi' : item.status}</span>
                                </span>
                              </td>
                              <td className="px-3.5 py-3">
                                {isInstalled ? (
                                  <div className="space-y-0.5">
                                    <div className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                      {item.pelanggan_nama} {item.pelanggan_telp && item.pelanggan_telp !== '-' ? `• ${item.pelanggan_telp}` : ''}
                                    </div>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                                      <span className="truncate max-w-[260px]">{item.lokasi}</span>
                                    </div>
                                  </div>
                                ) : isTransit ? (
                                  <div className="space-y-0.5">
                                    <div className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                      Dibawa: {item.teknisi}
                                    </div>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                                      <span className="truncate max-w-[260px]">Tujuan: {item.pelanggan_nama} ({item.lokasi})</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">
                                    Rak Logistik Sentral STO
                                  </span>
                                )}
                              </td>
                              <td className="px-3.5 py-3 font-mono text-[11px] text-amber-400 whitespace-nowrap">
                                {item.odpFormatted}
                              </td>
                              <td className="px-3.5 py-3 text-center font-mono text-[11px] whitespace-nowrap">
                                {item.redaman_dbm === '-' ? (
                                  <span className="text-slate-600">-</span>
                                ) : (
                                  <span className="text-emerald-400 font-bold">{item.redaman_dbm}</span>
                                )}
                              </td>
                              <td className="px-3.5 py-3 whitespace-nowrap">
                                <div className="font-mono text-[10px] text-slate-300">{item.bastp_no}</div>
                                <div className="text-[10px] text-slate-400">Oleh: {item.teknisi}</div>
                              </td>
                              <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                {isInstalled && (
                                  <button
                                    type="button"
                                    onClick={() => handleViewBastpItem(item)}
                                    className="px-2 py-1 rounded-lg bg-burgundy-600/20 hover:bg-burgundy-600/30 text-burgundy-400 border border-burgundy-500/30 text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                                    title="Buka Berita Acara Serah Terima Pekerjaan"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Lihat BASTP</span>
                                  </button>
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
            </div>
          )}

          {/* TAB: PENARIKAN ASET PELANGGAN MENUNGGAK (DEPT COLLECTOR) */}
          {activeMenu === 'penarikan-aset' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <TabelPelangganAset />
            </div>
          )}

          {/* TAB: CETAK SURAT JALAN & BASTP */}
          {activeMenu === 'cetak-surat-jalan' && (
            <div className="animate-in fade-in duration-200">
              <CetakSuratJalan initialRequestId={selectedSuratJalanReqId} />
            </div>
          )}

        </div>
      </main>

      {/* Modal BASTP & Rekonsiliasi Material Digital */}
      {bastpModalTask && (
        <ModalBASTP
          task={bastpModalTask}
          onClose={() => setBastpModalTask(null)}
        />
      )}

    </div>
  );
}
