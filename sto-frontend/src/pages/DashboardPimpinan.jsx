import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ModernSidebar from '../components/ModernSidebar';
import FormTugas from '../components/FormTugas';
import ApprovalMaterial from '../components/ApprovalMaterial';
import LaporanAudit from '../components/LaporanAudit';
import WebGISTracking from '../components/WebGISTracking';
import KelolaTugas from '../components/KelolaTugas';
import KelolaPegawai from '../components/KelolaPegawai';
import ModalBASTP from '../components/ModalBASTP';
import TabelAsetJaringan from '../components/TabelAsetJaringan';
import AnalyticsChartsPimpinan from '../components/AnalyticsChartsPimpinan';
import ModalDetailRiwayatTeknisi from '../components/ModalDetailRiwayatTeknisi';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Package,
  MapPin,
  ArrowRight,
  FileText,
  User,
  Users,
  Wrench,
  Phone,
  Search,
  Download,
  Boxes,
  Send,
  Database,
  Check
} from 'lucide-react';

// Helper badge konfigurasi jenis penugasan teknisi
const getTaskTypeConfig = (jenisKerja) => {
  const jk = (jenisKerja || '').toLowerCase();
  if (jk.includes('pasang') || jk.includes('psb')) {
    return {
      label: 'Pasang Baru (PSB)',
      badgeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      badgeText: 'Pasang Baru'
    };
  }
  if (jk.includes('kabel') || jk.includes('putus') || jk.includes('dropcore')) {
    return {
      label: 'Kabel Putus',
      badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      badgeText: 'Kabel Putus'
    };
  }
  if (jk.includes('gangguan') || jk.includes('los')) {
    return {
      label: 'Gangguan (LOS)',
      badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      badgeText: 'Gangguan'
    };
  }
  return {
    label: 'Penugasan Lapangan',
    badgeBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    badgeText: 'Perbaikan'
  };
};

function DashboardPimpinan() {
  const [activeMenu, setActiveMenu] = useState(() => {
    try {
      const saved = localStorage.getItem('sto_active_tab_pimpinan');
      const valid = ['dashboard', 'tracking', 'tabel-odp', 'kelola-tugas', 'approval', 'laporan-kerja', 'laporan-gudang', 'kelola-pegawai'];
      return saved && valid.includes(saved) ? saved : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const handleSetActiveMenu = (tab) => {
    setActiveMenu(tab);
    try {
      localStorage.setItem('sto_active_tab_pimpinan', tab);
    } catch {}
  };

  // Reset tab ke overview dashboard jika logo diklik
  useEffect(() => {
    const handleReset = (e) => {
      if (!e.detail?.role || e.detail.role === 'pimpinan') {
        setActiveMenu('dashboard');
      }
    };
    window.addEventListener('sto:reset-dashboard-tab', handleReset);
    return () => window.removeEventListener('sto:reset-dashboard-tab', handleReset);
  }, []);

  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [bastpModalTask, setBastpModalTask] = useState(null);
  const [selectedTrackingTaskId, setSelectedTrackingTaskId] = useState(null);
  const [selectedTechnician, setSelectedTechnician] = useState(null);

  // State untuk Laporan Logistik & Gudang Pimpinan (100% Real Supabase Database)
  const [searchGudang, setSearchGudang] = useState('');
  const [filterKategoriGudang, setFilterKategoriGudang] = useState('all');
  const [subTabGudang, setSubTabGudang] = useState('master'); // 'master' | 'mutasi'

  const navigate = useNavigate();
  const { isDark } = useTheme();
  const {
    tugas = [],
    permohonan = [],
    barang = [],
    users = [],
    sidebarCollapsed
  } = useApp();

  // Resolusi Kategori Standar Telkom Akses (Real Database Mapping)
  const resolveKategori = (b) => {
    if (b.kategori && b.kategori !== 'Umum' && b.kategori !== 'Material') return b.kategori;
    const name = (b.nama_barang || '').toLowerCase();
    if (name.includes('kabel') || name.includes('dropcore') || name.includes('fo') || name.includes('fiber') || name.includes('serat')) {
      return 'Kabel & Serat Optik';
    }
    if (name.includes('ont') || name.includes('modem') || name.includes('zte') || name.includes('huawei') || name.includes('fiberhome')) {
      return 'Perangkat Aktif (ONT)';
    }
    if (name.includes('roset') || name.includes('patchcord') || name.includes('splitter') || name.includes('adapter') || name.includes('odp')) {
      return 'Perangkat Pasif';
    }
    return 'Consumable & Aksesoris';
  };

  const totalUnitFisikGudang = barang.reduce((acc, b) => acc + (Number(b.stok) || 0), 0);
  const releasedMutations = permohonan.filter(p => p.status === 'Released');

  const filteredPimpinanBarang = barang.map(b => ({
    ...b,
    kategori: resolveKategori(b),
    kode: b.kode || `SKU-TEL-${String(b.id).padStart(3, '0')}`
  })).filter(b => {
    const matchSearch = (b.nama_barang || '').toLowerCase().includes(searchGudang.toLowerCase()) ||
                        (b.kode || '').toLowerCase().includes(searchGudang.toLowerCase());
    const matchCat = filterKategoriGudang === 'all' || b.kategori === filterKategoriGudang;
    return matchSearch && matchCat;
  });

  const handleExportPimpinanGudang = () => {
    const headers = ['Kode SKU', 'Nama Material', 'Kategori', 'Stok Fisik', 'Satuan', 'Status Gudang'];
    const rows = filteredPimpinanBarang.map(b => [
      `"${b.kode}"`,
      `"${b.nama_barang}"`,
      `"${b.kategori}"`,
      b.stok,
      `"${b.satuan}"`,
      `"${b.stok <= 20 ? 'Perlu Restock' : 'Aman'}"`
    ]);

    const mutasiTitle = ['\n\n=== RIWAYAT PENGELUARAN MATERIAL KE TEKNISI (SUPABASE REALTIME) ===', '', '', '', '', ''];
    const mutasiHeaders = ['ID Permohonan', 'Tanggal Rilis', 'Teknisi Penerima', 'Tiket / Pelanggan', 'Material Diberikan', 'Status'];
    const mutasiRows = releasedMutations.map(m => [
      `"REQ-${m.id}"`,
      `"${m.waktu_rilis || m.tanggal || '-'}"`,
      `"${m.tech?.nama_lengkap || m.teknisi_nama || '-'}"`,
      `"${m.parentTask ? `#${m.parentTask.id} - ${m.parentTask.pelanggan_nama}` : '-'}"`,
      `"${m.items ? m.items.map(it => `${it.nama_barang || it.nama} (${it.jumlah} ${it.satuan || 'pcs'})`).join(', ') : '-'}"`,
      `"${m.status}"`
    ]);

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
  };

  // Proteksi sesi pimpinan
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user || user.role !== 'pimpinan') {
        navigate('/');
      }
    } catch {
      navigate('/');
    }
  }, [navigate]);

  // Daftar teknisi lapangan
  const fieldTechnicians = users.filter(u => u.role === 'teknisi');

  // KPI Calculations
  const totalTasks = tugas.length;
  const progressTasks = tugas.filter(t => t.status === 'Progress').length;
  const doneTasks = tugas.filter(t => t.status === 'Done').length;
  const pendingRequests = permohonan.filter(p => p.status === 'Pending').length;
  const totalBarangCount = barang.length;
  const lowStockCount = barang.filter(b => b.stok <= 20).length;
  const activeTechCount = fieldTechnicians.filter(tech =>
    tugas.some(t => Number(t.teknisi_id) === Number(tech.id) && t.status !== 'Done')
  ).length;

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row ${
      isDark ? 'bg-[#0a0f1d] text-white' : 'bg-slate-50 text-slate-900'
    } transition-colors duration-300`}>
      
      {/* Left Sidebar Layout */}
      <ModernSidebar activeTab={activeMenu} onTabChange={handleSetActiveMenu} />

      {/* Main Content Area beside Sidebar */}
      <main className={`flex-1 min-w-0 flex flex-col ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'} transition-all duration-300`}>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          
          {/* Header Banner */}
          <div className={`p-5 sm:p-6 rounded-3xl border ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          } flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600/20 text-rose-400 border border-rose-500/30">
                  COMMAND CENTER PIMPINAN
                </span>
                <span className="text-xs text-slate-400 font-mono">STO Telkom Akses Payakumbuh (Koto Nan IV)</span>
              </div>
              <h1 className={`text-xl sm:text-2xl font-black mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {activeMenu === 'dashboard' && 'Dashboard Ringkasan Operasional STO'}
                {activeMenu === 'tracking' && 'WebGIS Pemetaan Titik ODP & Aset Fiber Optic'}
                {activeMenu === 'tabel-odp' && 'Tabel Inventarisasi Aset Jaringan (ODP, Tiang FO & ODC)'}
                {activeMenu === 'kelola-tugas' && 'Manajemen & CRUD Tiket Penugasan Lapangan'}
                {activeMenu === 'approval' && 'Persetujuan (Approval) Material Teknisi'}
                {activeMenu === 'laporan-kerja' && 'Laporan Audit & Berita Acara Pekerjaan Lapangan'}
                {activeMenu === 'laporan-gudang' && 'Laporan & Pengawasan Stok Material Gudang'}
                {activeMenu === 'kelola-pegawai' && 'Kelola Akun & Hak Akses Pegawai STO'}
              </h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
                Sistem Koordinasi Penugasan Teknisi, Verifikasi Logistik Gudang, dan Berita Acara Digital.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateTaskModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Buat Tiket Baru</span>
              </button>
            </div>
          </div>

          {/* TAB 1: DASHBOARD LENGKAP */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* KPI Stat Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className={`p-4 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Tiket</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black mt-2">{totalTasks}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Semua wilayah STO</div>
                </div>

                <div className={`p-4 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">Dalam Progress</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-blue-500 mt-2">{progressTasks}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Teknisi aktif di lapangan</div>
                </div>

                <div className={`p-4 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Selesai (Done)</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-500 mt-2">{doneTasks}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Tervalidasi foto & BASTP</div>
                </div>

                <div className={`p-4 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Approval Pending</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-amber-500 mt-2">{pendingRequests}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Menunggu otorisasi pimpinan</div>
                </div>
              </div>

              {/* Visual Analitik 3 Grafik */}
              <AnalyticsChartsPimpinan tugas={tugas} barang={barang} permohonan={permohonan} />

              {/* Quick Action & Field Summary Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Status & Aktivitas Tim Teknisi Lapangan */}
                <div className={`lg:col-span-2 p-5 sm:p-6 rounded-3xl border ${
                  isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Status Penugasan Tim Teknisi Lapangan ({activeTechCount} / {fieldTechnicians.length} Bertugas)
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSetActiveMenu('tracking')}
                        className="px-2.5 py-1 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        <span>Buka Peta WebGIS</span>
                      </button>
                      <button
                        onClick={() => handleSetActiveMenu('kelola-tugas')}
                        className="text-xs text-rose-500 hover:text-rose-400 font-bold flex items-center gap-1"
                      >
                        <span>Kelola Tiket</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'} mt-3`}>
                    {fieldTechnicians.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500 italic">
                        Belum ada data teknisi terdaftar di sistem.
                      </div>
                    ) : (
                      fieldTechnicians.map(tech => {
                        const currentTask = tugas.find(t =>
                          Number(t.teknisi_id) === Number(tech.id) && t.status !== 'Done'
                        );
                        const taskCfg = getTaskTypeConfig(currentTask?.jenis_kerja || 'Siaga');

                        return (
                          <div key={tech.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-500 border border-blue-500/30 flex items-center justify-center font-bold shrink-0 mt-0.5">
                                {tech.nama_lengkap ? tech.nama_lengkap.charAt(0) : 'T'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {tech.nama_lengkap}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                    currentTask ? taskCfg.badgeBg : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  }`}>
                                    {currentTask ? taskCfg.badgeText : '🟢 Siaga di Posko'}
                                  </span>
                                </div>

                                {currentTask ? (
                                  <div className="mt-1 space-y-0.5">
                                    <div className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                      Sedang Menangani: Tiket <strong>#{currentTask.id}</strong> - {currentTask.pelanggan_nama}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate max-w-sm">
                                      Lokasi: {currentTask.lokasi}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-400 italic mt-0.5 flex items-center gap-1.5">
                                    <span>Siap menerima penugasan baru di area Payakumbuh</span>
                                    {tech.phone && <span className="text-[10px] text-slate-500 font-mono">({tech.phone})</span>}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => setSelectedTechnician(tech)}
                                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                                title="Lihat profil dan riwayat pekerjaan teknisi ini"
                              >
                                <User className="w-3.5 h-3.5" />
                                <span>Detail & Riwayat</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Warehouse Inventory Glance */}
                <div className={`p-6 rounded-3xl border transition-all ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-800 shadow-xl'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-500" />
                      <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Logistik Gudang
                      </h2>
                    </div>
                    <button
                      onClick={() => handleSetActiveMenu('laporan-gudang')}
                      className="text-xs text-amber-500 hover:text-amber-400 font-bold flex items-center gap-1"
                    >
                      <span>Detail</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3 mt-4 text-xs">
                    <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'} border flex items-center justify-between`}>
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Total Jenis Barang</span>
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalBarangCount} SKU</span>
                    </div>

                    <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'} border flex items-center justify-between`}>
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Stok Kritis (≤ 20)</span>
                      <span className="font-bold text-rose-500 dark:text-rose-400">{lowStockCount} Item</span>
                    </div>

                    <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'} border flex items-center justify-between`}>
                      <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Permohonan Pending</span>
                      <span className="font-bold text-amber-500 dark:text-amber-400">{pendingRequests} Permintaan</span>
                    </div>

                    <button
                      onClick={() => handleSetActiveMenu('approval')}
                      className="w-full mt-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer"
                    >
                      Tinjau Approval Material Sekarang
                    </button>
                  </div>
                </div>

              </div>

              {/* Task Table Summary */}
              <div className={`p-6 rounded-3xl border ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                  <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Daftar Tiket Tugas Lapangan Terkini
                  </h2>
                  <button
                    onClick={() => handleSetActiveMenu('laporan-kerja')}
                    className="text-xs text-rose-500 hover:text-rose-400 font-bold"
                  >
                    Lihat Semua Laporan
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <thead className={`${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'} uppercase text-[10px] tracking-wider border-b`}>
                      <tr>
                        <th className="px-3 py-2.5">ID Tiket</th>
                        <th className="px-3 py-2.5">Jenis Pekerjaan</th>
                        <th className="px-3 py-2.5">Pelanggan & Lokasi</th>
                        <th className="px-3 py-2.5">Teknisi</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                      {tugas.slice(0, 5).map(t => {
                        const tech = users.find(u => Number(u.id) === Number(t.teknisi_id));
                        return (
                          <tr key={t.id} className={`${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                            <td className="px-3 py-2.5 font-bold font-mono">#{t.id}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                (t.jenis_kerja?.includes('Pasang') || t.jenis_kerja === 'Pasang Baru') ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' :
                                (t.jenis_kerja?.includes('Gangguan') || t.jenis_kerja?.includes('Putus')) ? 'bg-rose-600/20 text-rose-400 border-rose-500/30' :
                                t.jenis_kerja?.includes('Modem') ? 'bg-amber-600/20 text-amber-400 border-amber-500/30' :
                                'bg-purple-600/20 text-purple-400 border-purple-500/30'
                              }`}>
                                {t.jenis_kerja}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.pelanggan_nama}</div>
                              <div className="text-[10px] text-slate-400">{t.lokasi}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              {tech ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedTechnician(tech)}
                                  className="font-semibold text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer transition text-left"
                                  title="Lihat profil & riwayat kerja teknisi ini"
                                >
                                  <User className="w-3 h-3 shrink-0" />
                                  <span>{tech.nama_lengkap}</span>
                                </button>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                  📢 Pool Terbuka
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {t.status === 'Done' ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    Done
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setBastpModalTask(t)}
                                    className="px-2 py-0.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                    title="Lihat BASTP & Material Terpasang"
                                  >
                                    <FileText className="w-2.5 h-2.5" />
                                    <span>BASTP</span>
                                  </button>
                                </div>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.status === 'Progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {t.status || 'Open'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

                    {/* TAB 2: PUSAT KENDALI WEBGIS ODP */}
          {activeMenu === 'tracking' && (
            <div className="animate-in fade-in duration-200">
              <WebGISTracking initialSelectedTaskId={selectedTrackingTaskId} />
            </div>
          )}

          {/* TAB 2.5: TABEL INVENTARISASI ASET JARINGAN (ODP, TIANG FO, ODC) */}
          {activeMenu === 'tabel-odp' && (
            <div className="animate-in fade-in duration-200">
              <TabelAsetJaringan onNavigateToWebGis={() => handleSetActiveMenu('tracking')} />
            </div>
          )}

          {/* TAB 3: MANAJEMEN PENUGASAN LAPANGAN (CRUD TIKET) */}
          {activeMenu === 'kelola-tugas' && (
            <div className="animate-in fade-in duration-200">
              <KelolaTugas
                onOpenCreateModal={() => setShowCreateTaskModal(true)}
                onOpenBastp={setBastpModalTask}
              />
            </div>
          )}

          {/* TAB 4: PERMOHONAN DARI TEKNISI (APPROVAL MATERIAL) */}
          {activeMenu === 'approval' && (
            <div className="animate-in fade-in duration-200">
              <ApprovalMaterial />
            </div>
          )}

          {/* TAB 5: LAPORAN KERJA LAPANGAN */}
          {activeMenu === 'laporan-kerja' && (
            <div className="animate-in fade-in duration-200">
              <LaporanAudit />
            </div>
          )}

          {/* TAB 6: LAPORAN BARANG DARI GUDANG (100% REAL SUPABASE DATABASE) */}
          {activeMenu === 'laporan-gudang' && (
            <div className={`p-6 sm:p-8 rounded-3xl border ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            } space-y-6 animate-in fade-in duration-200`}>
              
              {/* Header Laporan dengan Status Koneksi Supabase */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      100% Database Supabase Real-Time
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">Port 6543 (PgBouncer Pooler)</span>
                  </div>
                  <h2 className={`text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Laporan Monitoring Inventaris & Logistik Gudang
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Data ketersediaan fisik material fiber optik dan rekonsiliasi pengeluaran barang ke teknisi lapangan.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportPimpinanGudang}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV Laporan</span>
                  </button>
                </div>
              </div>

              {/* 4 Kartu KPI Ringkasan Logistik */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Total Volume Fisik</span>
                    <Boxes className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {totalUnitFisikGudang.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium">Unit Material di Rak STO</span>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Katalog Master SKU</span>
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {barang.length}
                  </div>
                  <span className="text-[10px] text-blue-400 font-medium">Jenis Material Terdaftar</span>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Stok Kritis / Menipis</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className={`text-xl font-black ${lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {lowStockCount}
                  </div>
                  <span className="text-[10px] text-rose-400 font-medium">Material Perlu Restock (&le; 20)</span>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Material Keluar</span>
                    <Send className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {releasedMutations.length}
                  </div>
                  <span className="text-[10px] text-purple-400 font-medium">Transaksi Rilis ke Teknisi</span>
                </div>
              </div>

              {/* Sub-Tab Switcher: Master Stok vs Riwayat Mutasi Keluar */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => setSubTabGudang('master')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    subTabGudang === 'master'
                      ? 'bg-rose-600 text-white shadow-md'
                      : isDark ? 'text-slate-400 hover:text-white bg-slate-950/50' : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                  }`}
                >
                  Master Stok Fisik Gudang ({barang.length} Material)
                </button>
                <button
                  type="button"
                  onClick={() => setSubTabGudang('mutasi')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    subTabGudang === 'mutasi'
                      ? 'bg-rose-600 text-white shadow-md'
                      : isDark ? 'text-slate-400 hover:text-white bg-slate-950/50' : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                  }`}
                >
                  Riwayat Serah Terima ke Teknisi ({releasedMutations.length} Transaksi)
                </button>
              </div>

              {/* TAMPILAN SUB-TAB 1: MASTER STOK FISIK GUDANG */}
              {subTabGudang === 'master' && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Toolbar Filter & Pencarian */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari nama material / kode SKU (misal: Dropcore, ONT, Roset)..."
                        value={searchGudang}
                        onChange={(e) => setSearchGudang(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={filterKategoriGudang}
                        onChange={(e) => setFilterKategoriGudang(e.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="all">Semua Kategori</option>
                        <option value="Kabel & Serat Optik">Kabel & Serat Optik</option>
                        <option value="Perangkat Aktif (ONT)">Perangkat Aktif (ONT)</option>
                        <option value="Perangkat Pasif">Perangkat Pasif</option>
                        <option value="Consumable & Aksesoris">Consumable & Aksesoris</option>
                      </select>
                    </div>
                  </div>

                  {/* Tabel Master Stok Database */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <thead className={`${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'} uppercase text-[10px] tracking-wider border-b`}>
                        <tr>
                          <th className="px-4 py-3">Kode SKU</th>
                          <th className="px-4 py-3">Nama Material</th>
                          <th className="px-4 py-3">Kategori</th>
                          <th className="px-4 py-3 text-right">Stok Fisik</th>
                          <th className="px-4 py-3">Satuan</th>
                          <th className="px-4 py-3 text-center">Status Gudang</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                        {filteredPimpinanBarang.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-slate-500 italic">
                              Tidak ada material yang cocok dengan filter ini.
                            </td>
                          </tr>
                        ) : (
                          filteredPimpinanBarang.map(item => {
                            const isCritical = Number(item.stok) <= 20;
                            return (
                              <tr key={item.id} className={`${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} transition`}>
                                <td className="px-4 py-3 font-mono text-slate-400">{item.kode}</td>
                                <td className={`px-4 py-3 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.nama_barang}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                    {item.kategori}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-sm">
                                  <span className={isCritical ? 'text-rose-400' : 'text-emerald-400'}>
                                    {Number(item.stok).toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-400">{item.satuan}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    isCritical
                                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  }`}>
                                    {isCritical ? 'Perlu Restock' : 'Aman'}
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

              {/* TAMPILAN SUB-TAB 2: RIWAYAT SERAH TERIMA / MUTASI KELUAR */}
              {subTabGudang === 'mutasi' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <thead className={`${isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'} uppercase text-[10px] tracking-wider border-b`}>
                        <tr>
                          <th className="px-4 py-3">No. Permohonan</th>
                          <th className="px-4 py-3">Waktu Rilis</th>
                          <th className="px-4 py-3">Teknisi Lapangan</th>
                          <th className="px-4 py-3">Acuan Tiket &amp; Lokasi</th>
                          <th className="px-4 py-3">Material yang Diberikan</th>
                          <th className="px-4 py-3 text-center">Status Logistik</th>
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
                          releasedMutations.map(req => (
                            <tr key={req.id} className={`${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} transition`}>
                              <td className="px-4 py-3 font-mono font-bold text-rose-400">
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
                                <div className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {req.parentTask?.pelanggan_nama ? `Pelanggan: ${req.parentTask.pelanggan_nama}` : `Tiket #${req.tugas_id}`}
                                </div>
                                <div className="text-[10px] text-slate-400 max-w-[200px] truncate">
                                  {req.parentTask?.lokasi || 'Koto Nan IV, Payakumbuh'}
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
                              <td className="px-4 py-3 text-center">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Released / Diserahkan</span>
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 7: KELOLA AKUN & PEGAWAI */}
          {activeMenu === 'kelola-pegawai' && (
            <div className="animate-in fade-in duration-200">
              <KelolaPegawai />
            </div>
          )}

        </div>
      </main>

      {/* Modal: Buat Tiket Tugas Baru (SOP 1) */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 ${
            isDark ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-900'
          } shadow-2xl relative`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-rose-500" />
                Buat & Siarkan Tiket Kerja
              </h3>
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <FormTugas onCreated={() => setShowCreateTaskModal(false)} />
          </div>
        </div>
      )}

      {/* Modal BASTP & Rekonsiliasi Material Digital */}
      {bastpModalTask && (
        <ModalBASTP
          task={bastpModalTask}
          onClose={() => setBastpModalTask(null)}
        />
      )}

      {/* Modal Detail & Riwayat Kerja Teknisi */}
      {selectedTechnician && (
        <ModalDetailRiwayatTeknisi
          teknisi={selectedTechnician}
          onClose={() => setSelectedTechnician(null)}
          onOpenBastp={setBastpModalTask}
          onNavigateToTracking={(taskId) => {
            setSelectedTrackingTaskId(taskId);
            handleSetActiveMenu('tracking');
          }}
        />
      )}

    </div>
  );
}

export default DashboardPimpinan;
