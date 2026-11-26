import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Plus,
  Network,
  MapPin,
  ArrowRight,
  FileText,
  User,
  Users,
  Download,
  Printer,
  UserPlus,
  ClipboardList,
  ShieldCheck,
  Boxes
} from 'lucide-react';
import ModernSidebar from '../components/ModernSidebar';
import FormTugas from '../components/FormTugas';
import ApprovalMaterial from '../components/ApprovalMaterial';
import LaporanAudit from '../components/LaporanAudit';
import WebGISTracking from '../components/WebGISTracking';
import KelolaTugas from '../components/KelolaTugas';
import KelolaPegawai from '../components/KelolaPegawai';
import ModalBASTP from '../components/ModalBASTP';
import TabelAsetJaringan from '../components/TabelAsetJaringan';
import TabelPelangganAset from '../components/TabelPelangganAset';
import AnalyticsChartsPimpinan from '../components/AnalyticsChartsPimpinan';
import ModalDetailRiwayatTeknisi from '../components/ModalDetailRiwayatTeknisi';
import LaporanGudangPimpinan from '../components/LaporanGudangPimpinan';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { parseTaskDetails } from '../utils/taskFormatter';

// ============================================================================
// 1. DATA PARSING & SANITIZATION HELPER (TELECOM OPERATIONAL STANDARD)
// ============================================================================
export const parseTelecomTaskDetails = parseTaskDetails;

// Helper pemotong alamat aman tanpa tanda kurung / koma menggantung sebelum "..."
const truncateAddress = (addr, max = 40) => {
  if (!addr) return 'Payakumbuh';
  if (addr.length <= max) return addr;
  let sliced = addr.slice(0, max).trim();
  while (sliced.endsWith('(') || sliced.endsWith(')') || sliced.endsWith('[') || sliced.endsWith(']') || sliced.endsWith(',') || sliced.endsWith('-') || sliced.endsWith('|') || sliced.endsWith('.')) {
    sliced = sliced.slice(0, -1).trim();
  }
  return `${sliced}...`;
};

// Helper badge konfigurasi jenis penugasan teknisi
const getTaskTypeConfig = (jenisKerja) => {
  const jk = (jenisKerja || '').toLowerCase();
  if (jk.includes('pasang') || jk.includes('psb')) {
    return {
      label: 'Pasang Baru',
      badgeBg: 'bg-blue-950/60 text-blue-400 border border-blue-500/30 whitespace-nowrap',
      badgeText: 'Pasang Baru'
    };
  }
  if (jk.includes('kabel') || jk.includes('putus') || jk.includes('dropcore') || jk.includes('gangguan') || jk.includes('repair') || jk.includes('los')) {
    return {
      label: 'Gangguan',
      badgeBg: 'bg-rose-950/60 text-rose-400 border border-rose-500/30 whitespace-nowrap',
      badgeText: 'Gangguan'
    };
  }
  if (jk.includes('maintenance') || jk.includes('odp') || jk.includes('feeder')) {
    return {
      label: 'Maintenance',
      badgeBg: 'bg-purple-950/60 text-purple-400 border border-purple-500/30 whitespace-nowrap',
      badgeText: 'Maintenance'
    };
  }
  return {
    label: 'Relokasi',
    badgeBg: 'bg-amber-950/60 text-amber-400 border border-amber-500/30 whitespace-nowrap',
    badgeText: 'Relokasi'
  };
};

// Helper pembeda nama teknisi agar tidak ada badge kembar membingungkan di daftar Siaga di Posko
const getTechDisplayName = (tech, allTechs = []) => {
  if (!tech) return 'Teknisi';
  const fullName = (tech.nama_lengkap || tech.nama || '').trim();
  const username = tech.username || (tech.email ? tech.email.split('@')[0] : null);

  if (!fullName) return username ? `@${username}` : `Teknisi #${tech.id}`;

  const parts = fullName.split(/\s+/);
  const firstName = parts[0];

  // Cari apakah ada teknisi lain yang memiliki nama depan yang sama
  const duplicateTechs = allTechs.filter(t => {
    if (Number(t.id) === Number(tech.id)) return false;
    const otherFull = (t.nama_lengkap || t.nama || '').trim();
    const otherFirst = otherFull.split(/\s+/)[0];
    return otherFirst.toLowerCase() === firstName.toLowerCase();
  });

  if (duplicateTechs.length > 0) {
    // 1. Jika nama lengkap berbeda dan memiliki lebih dari 1 kata, gunakan nama lengkap
    if (parts.length > 1) {
      const isFullNameUnique = !duplicateTechs.some(t => {
        const otherFull = (t.nama_lengkap || t.nama || '').trim().toLowerCase();
        return otherFull === fullName.toLowerCase();
      });
      if (isFullNameUnique) {
        return fullName;
      }
    }

    // 2. Jika nama depan identik atau hanya 1 kata ("Reza"):
    // Gunakan format nama dengan username unik: `${user.nama} (${user.username})`
    if (username) {
      return `${firstName} (${username})`;
    }
    return `${firstName} (#${tech.id})`;
  }

  // Jika nama unik di daftar teknisi, cukup tampilkan nama depan / nama panggilan
  return firstName;
};

function DashboardPimpinan() {
  const [activeMenu, setActiveMenu] = useState(() => {
    try {
      // Gunakan sessionStorage agar saat tutup browser/aplikasi selalu kembali ke Dashboard utama
      const saved = sessionStorage.getItem('sto_active_tab_pimpinan');
      const valid = ['dashboard', 'tracking', 'tabel-odp', 'kelola-tugas', 'approval', 'laporan-kerja', 'laporan-gudang', 'tabel-pelanggan', 'kelola-pegawai'];
      return saved && valid.includes(saved) ? saved : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const handleSetActiveMenu = (tab) => {
    setActiveMenu(tab);
    try {
      sessionStorage.setItem('sto_active_tab_pimpinan', tab);
      window.history.pushState({ role: 'pimpinan', tab }, '', window.location.pathname);
    } catch {}
  };

  // Mencegah tombol Back browser kembali ke halaman Login tanpa logout eksplisit
  useEffect(() => {
    // Inisialisasi state awal di history browser
    window.history.pushState({ role: 'pimpinan', tab: activeMenu }, '', window.location.pathname);

    const handlePopState = (e) => {
      // Jika pengguna menekan tombol Back saat berada di sub-menu, arahkan kembali ke Dashboard utama
      if (activeMenu !== 'dashboard') {
        setActiveMenu('dashboard');
        try {
          sessionStorage.setItem('sto_active_tab_pimpinan', 'dashboard');
        } catch {}
        window.history.pushState({ role: 'pimpinan', tab: 'dashboard' }, '', window.location.pathname);
      } else {
        // Jika sudah di dashboard utama, tahan pengguna agar tidak mental kembali ke form login
        window.history.pushState({ role: 'pimpinan', tab: 'dashboard' }, '', window.location.pathname);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeMenu]);

  // Reset tab ke overview dashboard jika logo diklik
  useEffect(() => {
    const handleReset = (e) => {
      if (!e.detail?.role || e.detail.role === 'pimpinan') {
        setActiveMenu('dashboard');
        try {
          sessionStorage.setItem('sto_active_tab_pimpinan', 'dashboard');
        } catch {}
      }
    };
    window.addEventListener('sto:reset-dashboard-tab', handleReset);
    return () => window.removeEventListener('sto:reset-dashboard-tab', handleReset);
  }, []);

  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showAddPegawaiModal, setShowAddPegawaiModal] = useState(false);
  const [bastpModalTask, setBastpModalTask] = useState(null);
  const [selectedTrackingTaskId, setSelectedTrackingTaskId] = useState(null);
  const [selectedTechnician, setSelectedTechnician] = useState(null);

  const navigate = useNavigate();
  const { isDark } = useTheme();
  const {
    tugas = [],
    permohonan = [],
    barang = [],
    users = [],
    odp = [],
    sidebarCollapsed
  } = useApp();

  // Proteksi sesi pimpinan
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user || user?.role !== 'pimpinan') {
        navigate('/');
      }
    } catch {
      navigate('/');
    }
  }, [navigate]);

  // Daftar teknisi lapangan asli
  const fieldTechnicians = useMemo(() => {
    return users.filter(u =>
      u.role === 'teknisi' &&
      Number(u.id) !== 99 &&
      !String(u.nama_lengkap || '').toLowerCase().includes('pool')
    );
  }, [users]);

  // Helper normalisasi status tiket
  const isDoneTask = useCallback((status) => ['done', 'selesai', 'closed'].includes(String(status || '').toLowerCase()), []);
  const isProgressTask = useCallback((status) => ['progress', 'in_progress', 'assigned', 'pengerjaan'].includes(String(status || '').toLowerCase()), []);

  // =========================================================================
  // SECTION 1: EXECUTIVE KPI STRIP METRICS
  // =========================================================================
  const totalTasks = tugas.length;
  const progressTasks = useMemo(() => tugas.filter(t => isProgressTask(t.status)).length, [tugas, isProgressTask]);
  const doneTasks = useMemo(() => tugas.filter(t => isDoneTask(t.status)).length, [tugas, isDoneTask]);
  const pendingRequests = useMemo(() => permohonan.filter(p => String(p.status || '').toLowerCase() === 'pending').length, [permohonan]);

  // Breakdown mikro Kolom 1: Pasang Baru vs Gangguan
  const psbCount = useMemo(() => {
    return tugas.filter(t => {
      const jk = (t.jenis_kerja || '').toLowerCase();
      return jk.includes('pasang') || jk.includes('psb');
    }).length;
  }, [tugas]);

  const gangguanCount = useMemo(() => {
    return tugas.filter(t => {
      const jk = (t.jenis_kerja || '').toLowerCase();
      return jk.includes('gangguan') || jk.includes('repair') || jk.includes('putus') || jk.includes('los');
    }).length;
  }, [tugas]);

  const otherCount = useMemo(() => {
    return Math.max(0, totalTasks - psbCount - gangguanCount);
  }, [totalTasks, psbCount, gangguanCount]);

  // Breakdown mikro Kolom 2: Teknisi Aktif
  const activeTechCount = useMemo(() => {
    return fieldTechnicians.filter(tech =>
      tugas.some(t => Number(t.teknisi_id) === Number(tech.id) && isProgressTask(t.status))
    ).length;
  }, [fieldTechnicians, tugas, isProgressTask]);

  // Breakdown mikro Kolom 3: % Kepatuhan Redaman Optik Ideal (-16 s/d -24 dBm)
  const doneTasksList = useMemo(() => tugas.filter(t => isDoneTask(t.status)), [tugas, isDoneTask]);
  const attenuationPercent = useMemo(() => {
    if (doneTasksList.length === 0) return 100;
    const compliant = doneTasksList.filter(t => {
      const rawVal = parseFloat(t.redaman_dbm || t.bastp?.redaman_dbm || '-18.5');
      const val = Math.abs(rawVal);
      return val >= 16 && val <= 24;
    }).length;
    return Math.round((compliant / doneTasksList.length) * 100);
  }, [doneTasksList]);

  // Pembagian Teknisi: Sedang Bertugas vs Siaga di Posko
  const activeTechAssignments = useMemo(() => {
    const list = [];
    fieldTechnicians.forEach(tech => {
      const currentTask = tugas.find(t =>
        Number(t.teknisi_id) === Number(tech.id) && isProgressTask(t.status)
      );
      if (currentTask) {
        list.push({ tech, currentTask });
      }
    });
    return list;
  }, [fieldTechnicians, tugas, isProgressTask]);

  const idleTechnicians = useMemo(() => {
    return fieldTechnicians.filter(tech =>
      !tugas.some(t => Number(t.teknisi_id) === Number(tech.id) && isProgressTask(t.status))
    );
  }, [fieldTechnicians, tugas, isProgressTask]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 dark:bg-[#0a0f1d] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Left Sidebar Layout */}
      <ModernSidebar activeTab={activeMenu} onTabChange={handleSetActiveMenu} />

      {/* Main Content Area beside Sidebar */}
      <main className={`flex-1 min-w-0 flex flex-col overflow-y-auto ${sidebarCollapsed ? 'md:pl-20' : 'md:pl-72'} transition-all duration-300`}>
        <div className="p-2.5 sm:p-4 space-y-3 flex-1 max-w-7xl w-full mx-auto">
          
          {/* Header Banner (Enterprise Telecom Standard) */}
          <div className="p-3 sm:p-3.5 rounded-2xl border bg-white/90 dark:bg-slate-950/70 border-slate-200 dark:border-rose-950/30 text-slate-900 dark:text-white backdrop-blur-xl shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors">
            <div>
              {activeMenu === 'tracking' ? (
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <Network className="w-4 h-4" />
                  </div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Pemetaan ODP &amp; Aset Jaringan
                  </h1>
                </div>
              ) : activeMenu === 'kelola-tugas' ? (
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-400">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Manajemen Tiket Lapangan
                  </h1>
                </div>
              ) : activeMenu === 'approval' ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Persetujuan Material Teknisi
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    {pendingRequests.length} Menunggu Otorisasi
                  </span>
                </div>
              ) : activeMenu === 'laporan-kerja' ? (
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Laporan Kerja Lapangan
                  </h1>
                </div>
              ) : activeMenu === 'laporan-gudang' ? (
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 shrink-0">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Laporan Logistik Gudang
                  </h1>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    {activeMenu === 'dashboard' && 'Dashboard Pimpinan'}
                    {activeMenu === 'tabel-odp' && 'Inventarisasi Aset Jaringan'}
                    {activeMenu === 'tabel-pelanggan' && 'Data Pelanggan & Aset'}
                    {activeMenu === 'kelola-pegawai' && 'Kelola Pegawai'}
                  </h1>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {activeMenu === 'tracking' ? (
                <div className="grid grid-cols-2 gap-2 mt-3 sm:flex sm:mt-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('sto:open-add-odp'))}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah ODP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateTaskModal(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Tiket Baru</span>
                  </button>
                </div>
              ) : activeMenu === 'kelola-pegawai' ? (
                <button
                  type="button"
                  onClick={() => setShowAddPegawaiModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95 whitespace-nowrap w-full sm:w-auto justify-center"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Tambah Pegawai</span>
                </button>
              ) : activeMenu === 'laporan-gudang' ? (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('sto:export-gudang'))}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95 whitespace-nowrap w-full sm:w-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              ) : activeMenu === 'tabel-pelanggan' ? (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('sto:export-pelanggan'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Data</span>
                </button>
              ) : activeMenu === 'laporan-kerja' ? (
                <button
                  type="button"
                  onClick={() => {
                    const origTitle = document.title;
                    document.title = ' ';
                    window.print();
                    setTimeout(() => { document.title = origTitle; }, 1500);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 shadow-sm transition cursor-pointer active:scale-95 whitespace-nowrap w-full sm:w-auto"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Rekap</span>
                </button>
              ) : activeMenu === 'tabel-odp' ? (
                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('sto:export-odp'))}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('sto:open-add-odp'))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ ODP</span>
                  </button>
                </div>
              ) : activeMenu === 'kelola-tugas' ? (
                <button
                  type="button"
                  onClick={() => setShowCreateTaskModal(true)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 hover:shadow-rose-900/40 transition cursor-pointer active:scale-95 whitespace-nowrap w-full sm:w-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Terbitkan Tiket Baru</span>
                </button>
              ) : activeMenu === 'approval' ? null : (
                <button
                  type="button"
                  onClick={() => setShowCreateTaskModal(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95 whitespace-nowrap w-full mt-2 sm:w-auto sm:mt-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Tiket Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: DASHBOARD LENGKAP */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              
              {/* ============================================================= */}
              {/* SECTION 1: EXECUTIVE KPI STRIP (4 Key Pillars) */}
              {/* ============================================================= */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
                
                {/* 1. Kolom 1 (Total Operasi) */}
                <div className={`card-interactive cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  isDark
                    ? 'bg-slate-950/70 backdrop-blur-xl border-rose-950/30 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Total Operasi
                      </span>
                      <div className={`w-6 h-6 rounded-lg border flex items-center justify-center ${
                        isDark ? 'bg-slate-900 border-white/5 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black mt-1 font-mono tracking-tight ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {totalTasks}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 mt-2 pt-1.5 border-t text-[10px] font-mono truncate ${
                    isDark ? 'border-white/5' : 'border-slate-100'
                  }`}>
                    <span className="text-blue-500 font-bold">{psbCount} PSB</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-rose-500 font-bold">{gangguanCount} Gangguan</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-amber-500 font-bold">{otherCount} Lainnya</span>
                  </div>
                </div>

                {/* 2. Kolom 2 (Tiket Dalam Proses / Operasi Berjalan) */}
                <div className={`card-interactive cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  isDark
                    ? 'bg-slate-950/70 backdrop-blur-xl border-blue-950/40 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
                    : 'bg-blue-50/70 border-blue-200/80 shadow-sm'
                }`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                        Tiket Dalam Proses
                      </span>
                      <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-500 dark:text-blue-400 flex items-center justify-center shadow-[0_0_8px_rgba(59,130,246,0.2)]">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono tracking-tight">
                      {progressTasks}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 mt-2 pt-1.5 border-t text-[10px] ${
                    isDark ? 'border-white/5' : 'border-blue-200/60'
                  }`}>
                    <span className="relative flex h-1.5 w-1.5 mr-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">{activeTechCount} Teknisi</span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>On-Duty</span>
                  </div>
                </div>

                {/* 3. Kolom 3 (Tiket Selesai / QC Passed) */}
                <div className={`card-interactive cursor-pointer p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  isDark
                    ? 'bg-slate-950/70 backdrop-blur-xl border-emerald-950/40 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
                    : 'bg-emerald-50/70 border-emerald-200/80 shadow-sm'
                }`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        Tiket Selesai (QC Passed)
                      </span>
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono tracking-tight">
                      {doneTasks}
                    </div>
                  </div>
                  <div className={`flex items-center justify-between mt-2 pt-1.5 border-t text-[10px] ${
                    isDark ? 'border-white/5' : 'border-emerald-200/60'
                  }`}>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Kepatuhan Redaman:</span>
                    <span className="font-mono font-bold text-teal-600 dark:text-cyan-400">{attenuationPercent}% Optimal</span>
                  </div>
                </div>

                {/* 4. Kolom 4 (Pending Otorisasi / Menunggu Persetujuan) */}
                <div
                  onClick={() => handleSetActiveMenu('approval')}
                  className={`p-3 sm:p-3.5 rounded-xl border hover:scale-[1.02] transition-all duration-300 cursor-pointer group flex flex-col justify-between ${
                    isDark
                      ? 'bg-slate-950/70 backdrop-blur-xl border-amber-500/40 hover:border-amber-400 shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                      : 'bg-amber-50/70 border-amber-200/80 hover:border-amber-400 shadow-sm hover:shadow-md'
                  }`}
                  title="Klik untuk meninjau permohonan material teknisi"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider group-hover:text-amber-500 transition">
                        Pending Otorisasi
                      </span>
                      <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-[0_0_8px_rgba(245,158,11,0.25)] group-hover:scale-110 transition">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono tracking-tight group-hover:text-amber-500 transition">
                      {pendingRequests}
                    </div>
                  </div>
                  <div className={`flex items-center justify-between mt-2 pt-1.5 border-t text-[10px] ${
                    isDark ? 'border-white/5' : 'border-amber-200/60'
                  }`}>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Status Permohonan:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1 group-hover:underline">
                      <span>{pendingRequests > 0 ? 'Perlu Tindakan' : 'Semua Clear'}</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>

              </div>

              {/* ============================================================= */}
              {/* SECTION 2: OPERATIONAL WORKLOAD & QUALITY BENCHMARK */}
              {/* ============================================================= */}
              <AnalyticsChartsPimpinan
                tugas={tugas}
                barang={barang}
                odp={odp}
                onNavigateGudang={() => handleSetActiveMenu('laporan-gudang')}
              />

              {/* ============================================================= */}
              {/* SECTION 3: LIVE FIELD DISPATCH & ACTIVITY LEDGER (65% : 35%) */}
              {/* ============================================================= */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
                
                {/* KOLOM KIRI (65% ~ 8/12): Log Penugasan Terkini (Fixed-Width Table) */}
                <div className={`lg:col-span-8 p-3.5 sm:p-4 rounded-2xl border space-y-2.5 ${
                  isDark
                    ? 'bg-slate-950/70 backdrop-blur-xl border-rose-950/30 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-rose-500" />
                      <h2 className={`text-xs sm:text-sm font-bold tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        LOG PENUGASAN TERKINI
                      </h2>
                    </div>
                    <button
                      onClick={() => handleSetActiveMenu('laporan-kerja')}
                      className="text-xs text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Lihat Semua</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tampilan Desktop: Table (hidden di mobile, tampil di md:block) */}
                  <div className={`hidden md:block w-full overflow-hidden rounded-xl border ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                    <table className={`w-full table-fixed text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <thead className={`${
                        isDark ? 'bg-slate-950/90 text-slate-400 border-rose-950/40' : 'bg-slate-100 text-slate-700 border-slate-200'
                      } border-b uppercase text-[10px] tracking-wider`}>
                        <tr>
                          <th className="px-2.5 py-2 font-bold w-[24%]">ID &amp; Pekerjaan</th>
                          <th className="px-2.5 py-2 font-bold w-[44%]">Informasi Pelanggan &amp; Alamat</th>
                          <th className="px-2.5 py-2 font-bold w-[20%]">Teknisi Bertugas</th>
                          <th className="px-1.5 py-2 text-center font-bold w-[12%]">Status &amp; BASTP</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-rose-950/20' : 'divide-slate-200'}`}>
                        {tugas.slice(0, 5).map(t => {
                          const tech = users.find(u => Number(u.id) === Number(t.teknisi_id));
                          const cust = parseTelecomTaskDetails(t);
                          const isDone = isDoneTask(t.status);
                          const isProgress = isProgressTask(t.status);
                          const taskTypeCfg = getTaskTypeConfig(t.jenis_kerja);

                          return (
                            <tr key={t.id} className={`${isDark ? 'hover:bg-rose-950/10' : 'hover:bg-slate-50'} transition-colors`}>
                              {/* Kolom 1: ID Tiket & Jenis Pekerjaan */}
                              <td className="px-2.5 py-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-black text-rose-500 text-xs shrink-0">
                                    #{t.id}
                                  </span>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-bold border tracking-wide whitespace-nowrap shrink-0 ${taskTypeCfg.badgeBg}`}>
                                    {taskTypeCfg.badgeText}
                                  </span>
                                </div>
                              </td>

                              {/* Kolom 2: Informasi Pelanggan & Alamat (Diparsing Bersih Tanpa Duplikasi) */}
                              <td className="px-2.5 py-2">
                                <div className="space-y-0.5 min-w-0">
                                  <div className={`font-semibold text-xs truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                    <span>{cust.name}</span>
                                    {cust.telp && (
                                      <span className={`text-[10px] font-mono font-normal ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        • {cust.telp}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400 flex items-center gap-1 truncate" title={cust.address}>
                                    <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                                    <span className="truncate max-w-[240px]">
                                      {truncateAddress(cust.address, 40)}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Kolom 3: Teknisi Bertugas */}
                              <td className="px-2.5 py-2">
                                <div className="truncate min-w-0">
                                  {tech ? (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedTechnician(tech)}
                                      className="font-semibold text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1.5 cursor-pointer transition text-left truncate w-full"
                                      title={tech.nama_lengkap}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)] shrink-0"></span>
                                      <span className="truncate">{tech.nama_lengkap}</span>
                                    </button>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/60 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                      📢 Open Pool
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Kolom 4: Status Tiket & BASTP */}
                              <td className="px-1.5 py-2 text-center">
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {isDone ? (
                                    <>
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)] whitespace-nowrap">
                                        Done
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setBastpModalTask(t)}
                                        className="px-1.5 py-0.5 rounded-md bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 text-[9px] font-bold transition cursor-pointer shrink-0 inline-flex items-center gap-1"
                                        aria-label="Buka Dokumen BASTP"
                                        title="Buka Rekap BASTP"
                                      >
                                        <FileText className="w-2.5 h-2.5" aria-hidden="true" />
                                        <span>BASTP</span>
                                      </button>
                                    </>
                                  ) : (
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                                      isProgress
                                        ? 'bg-blue-950/60 text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)]'
                                        : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                                    }`}>
                                      {t.status || 'Open'}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Tampilan Mobile: Card-based List (block md:hidden, bebas overflow horizontal) */}
                  <div className="block md:hidden space-y-2.5">
                    {tugas.slice(0, 5).map(t => {
                      const tech = users.find(u => Number(u.id) === Number(t.teknisi_id));
                      const cust = parseTelecomTaskDetails(t);
                      const isDone = isDoneTask(t.status);
                      const isProgress = isProgressTask(t.status);
                      const taskTypeCfg = getTaskTypeConfig(t.jenis_kerja);

                      return (
                        <div
                          key={t.id}
                          className={`p-3 rounded-xl border space-y-2 ${
                            isDark ? 'bg-slate-900/60 border-white/5' : 'bg-slate-50 border-slate-200 shadow-xs'
                          }`}
                        >
                          {/* Header Kartu: Nomor Tiket, Badge Jenis Pekerjaan, Badge Status */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono font-black text-rose-500 text-xs shrink-0">
                                #{t.id}
                              </span>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-bold border tracking-wide truncate ${taskTypeCfg.badgeBg}`}>
                                {taskTypeCfg.badgeText}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                                isDone
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                                  : isProgress
                                  ? 'bg-blue-950/60 text-blue-400 border border-blue-500/30'
                                  : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                              }`}>
                                {isDone ? 'Done' : (t.status || 'Open')}
                              </span>
                            </div>
                          </div>

                          {/* Body: Nama Pelanggan & No. Telepon */}
                          <div className="text-xs">
                            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{cust.name}</span>
                            {cust.telp && (
                              <span className={`text-[10px] font-mono ml-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                • {cust.telp}
                              </span>
                            )}
                          </div>

                          {/* Lokasi: Alamat singkat dengan ikon MapPin */}
                          <div className={`text-[11px] flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span className="truncate">{cust.address}</span>
                          </div>

                          {/* Footer: Nama Teknisi bertugas + Tombol Lihat BASTP (jika Done) */}
                          <div className={`flex items-center justify-between pt-2 border-t text-[11px] ${
                            isDark ? 'border-white/5' : 'border-slate-200'
                          }`}>
                            <div className="truncate min-w-0 pr-2">
                              {tech ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedTechnician(tech)}
                                  className="font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 cursor-pointer truncate"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                  <span className="truncate">{tech.nama_lengkap}</span>
                                </button>
                              ) : (
                                <span className="text-amber-400 text-[10px] font-bold">
                                  📢 Open Pool
                                </span>
                              )}
                            </div>
                            {isDone && (
                              <button
                                type="button"
                                onClick={() => setBastpModalTask(t)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shrink-0 ${
                                  isDark
                                    ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                                }`}
                              >
                                <FileText className="w-3 h-3" />
                                <span>BASTP</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* KOLOM KANAN (35% ~ 4/12): Status Penugasan Tim Teknisi */}
                <div className={`lg:col-span-4 p-3.5 sm:p-4 rounded-2xl border space-y-2.5 ${
                  isDark
                    ? 'bg-slate-950/70 backdrop-blur-xl border-rose-950/30 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-rose-500" />
                      <h2 className={`text-xs sm:text-sm font-bold tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Status Tim Teknisi
                      </h2>
                    </div>

                    <button
                      onClick={() => handleSetActiveMenu('tracking')}
                      className="px-2 py-0.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-500/30 hover:border-rose-400 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <MapPin className="w-3 h-3 text-rose-500" />
                      <span>Peta Sebaran ODP</span>
                    </button>
                  </div>

                  {/* Bagian Atas: Teknisi Aktif Lapangan (On-Duty) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">
                      <span>Teknisi Aktif ({activeTechAssignments.length})</span>
                    </div>

                    {activeTechAssignments.length === 0 ? (
                      <div className={`p-2.5 rounded-xl border text-[10px] italic text-center ${
                        isDark ? 'bg-slate-900/50 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}>
                        Tidak ada teknisi aktif di lapangan saat ini.
                      </div>
                    ) : (
                      activeTechAssignments.map(({ tech, currentTask }) => {
                        const cust = parseTelecomTaskDetails(currentTask);
                        const taskCfg = getTaskTypeConfig(currentTask.jenis_kerja);

                        return (
                          <div
                            key={tech.id}
                            className={`p-2 rounded-xl border transition-all flex flex-col gap-1 ${
                              isDark
                                ? 'bg-slate-900/60 border-white/5 hover:border-blue-500/30'
                                : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {tech.nama_lengkap?.charAt(0) || 'T'}
                                </div>
                                <div className="leading-tight">
                                  <div className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tech.nama_lengkap}</div>
                                  <div className="text-[9px] text-slate-400 font-mono">Tiket #{currentTask.id}</div>
                                </div>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold border ${taskCfg.badgeBg}`}>
                                {taskCfg.badgeText}
                              </span>
                            </div>

                            <div className={`text-[10px] flex items-center gap-1 truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                              <span className="truncate" title={cust.address}>{cust.address}</span>
                            </div>

                            <div className={`flex items-center justify-between pt-1 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                              <button
                                type="button"
                                onClick={() => setSelectedTechnician(tech)}
                                className={`text-[9px] transition flex items-center gap-1 cursor-pointer ${
                                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                                }`}
                              >
                                <User className="w-2.5 h-2.5" />
                                <span>Detail</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTrackingTaskId(currentTask.id);
                                  handleSetActiveMenu('tracking');
                                }}
                                className="px-1.5 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[9px] font-bold flex items-center gap-1 transition cursor-pointer"
                              >
                                <MapPin className="w-2 h-2" />
                                <span>Lacak</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bagian Bawah: Teknisi Siaga / Posko (Standby) */}
                  <div className={`space-y-1.5 pt-1.5 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">
                      <span>Siaga di Posko ({idleTechnicians.length})</span>
                    </div>

                    {idleTechnicians.length === 0 ? (
                      <div className="text-[10px] text-slate-500 italic">
                        Semua teknisi sedang aktif di lapangan.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {idleTechnicians.map(tech => (
                          <button
                            key={tech.id}
                            type="button"
                            onClick={() => setSelectedTechnician(tech)}
                            className={`px-2 py-0.5 rounded-lg border transition flex items-center gap-1.5 cursor-pointer group ${
                              isDark
                                ? 'bg-slate-900/60 hover:bg-slate-900 border-white/5 hover:border-emerald-500/30'
                                : 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                            }`}
                            title={tech.nama_lengkap}
                          >
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            <span className={`text-[10px] font-semibold transition truncate max-w-[120px] ${
                              isDark ? 'text-slate-300 group-hover:text-white' : 'text-slate-700'
                            }`}>
                              {getTechDisplayName(tech, fieldTechnicians)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
              <TabelAsetJaringan hideHeader={true} onNavigateToWebGis={() => handleSetActiveMenu('tracking')} />
            </div>
          )}

          {/* TAB 3: MANAJEMEN PENUGASAN LAPANGAN */}
          {activeMenu === 'kelola-tugas' && (
            <div className="animate-in fade-in duration-200">
              <KelolaTugas
                hideHeader={true}
                onOpenCreateModal={() => setShowCreateTaskModal(true)}
                onOpenBastp={setBastpModalTask}
              />
            </div>
          )}

          {/* TAB 4: PERMOHONAN DARI TEKNISI (APPROVAL MATERIAL) */}
          {activeMenu === 'approval' && (
            <div className="animate-in fade-in duration-200">
              <ApprovalMaterial hideHeader={true} />
            </div>
          )}

          {/* TAB 5: LAPORAN KERJA LAPANGAN */}
          {activeMenu === 'laporan-kerja' && (
            <div className="animate-in fade-in duration-200">
              <LaporanAudit hideHeader={true} />
            </div>
          )}

          {/* TAB 6: LAPORAN BARANG DARI GUDANG (MODULAR COMPONENT) */}
          {activeMenu === 'laporan-gudang' && (
            <div className="animate-in fade-in duration-200">
              <LaporanGudangPimpinan />
            </div>
          )}

          {/* TAB 7: DATA PELANGGAN & AUDIT PENARIKAN ASET STO */}
          {activeMenu === 'tabel-pelanggan' && (
            <div className="animate-in fade-in duration-200">
              <TabelPelangganAset />
            </div>
          )}

          {/* TAB 8: KELOLA AKUN & PEGAWAI */}
          {activeMenu === 'kelola-pegawai' && (
            <div className="animate-in fade-in duration-200">
              <KelolaPegawai
                hideHeader={true}
                showAddModal={showAddPegawaiModal}
                setShowAddModal={setShowAddPegawaiModal}
              />
            </div>
          )}

        </div>
      </main>

      {/* Modal: Buat Tiket Tugas Baru (SOP 1) - Render via React Portal ke document.body */}
      {showCreateTaskModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-2xl relative my-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-white">
                <PlusCircle className="w-5 h-5 text-rose-500" />
                Buat &amp; Siarkan Tiket Kerja
              </h3>
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Tutup"
              >
                ✕
              </button>
            </div>

            <FormTugas onCreated={() => setShowCreateTaskModal(false)} />
          </div>
        </div>,
        document.body
      )}

      {/* Modal BASTP & Rekonsiliasi Material Digital */}
      {bastpModalTask && typeof document !== 'undefined' && createPortal(
        <ModalBASTP
          task={bastpModalTask}
          onClose={() => setBastpModalTask(null)}
        />,
        document.body
      )}

      {/* Modal Detail & Riwayat Kerja Teknisi */}
      {selectedTechnician && typeof document !== 'undefined' && createPortal(
        <ModalDetailRiwayatTeknisi
          teknisi={selectedTechnician}
          onClose={() => setSelectedTechnician(null)}
          onOpenBastp={setBastpModalTask}
          onNavigateToTracking={(taskId) => {
            setSelectedTrackingTaskId(taskId);
            handleSetActiveMenu('tracking');
          }}
        />,
        document.body
      )}

    </div>
  );
}

export default DashboardPimpinan;
