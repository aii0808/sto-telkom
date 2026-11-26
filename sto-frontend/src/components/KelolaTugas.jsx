// oxlint-disable no-unused-vars
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import {
  ClipboardList,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  UserCheck,
  User,
  X,
  MapPin,
  Phone,
  Eye,
  Plus
} from 'lucide-react';
import ModalDetailRiwayatTeknisi from './ModalDetailRiwayatTeknisi';
import { parseTaskDetails, formatWaktuBuat } from '../utils/taskFormatter';

export default function KelolaTugas({ onOpenCreateModal, onOpenBastp, hideHeader = false }) {
  const { isDark } = useTheme();
  const {
    tugas = [],
    users = [],
    updateTugas,
    deleteTugas,
    showToast
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jenisFilter, setJenisFilter] = useState('all');
  const [selectedTechnician, setSelectedTechnician] = useState(null);

  // Edit Modal State
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({
    jenis_kerja: '',
    pelanggan_nama: '',
    pelanggan_telp: '',
    lokasi: '',
    teknisi_id: '',
    status: '',
    keterangan: ''
  });

  const getTaskTypeBadge = (jenisKerja = '') => {
    const jk = (jenisKerja || '').toLowerCase();
    if (jk.includes('pasang') || jk.includes('psb')) {
      return 'bg-blue-950/60 text-blue-400 border-blue-500/30';
    }
    if (jk.includes('gangguan') || jk.includes('putus') || jk.includes('los') || jk.includes('repair') || jk.includes('kabel')) {
      return 'bg-rose-950/60 text-rose-400 border-rose-500/30';
    }
    if (jk.includes('maintenance')) {
      return 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30';
    }
    if (jk.includes('odp') || jk.includes('feeder')) {
      return 'bg-purple-950/60 text-purple-400 border-purple-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const getStatusBadge = (status = '') => {
    const s = (status || '').toLowerCase();
    if (s === 'done' || s === 'selesai') {
      return {
        text: 'Done',
        className: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
      };
    }
    if (s === 'progress' || s === 'in-progress' || s === 'dikerjakan') {
      return {
        text: 'In-Progress',
        className: 'bg-blue-950/60 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
      };
    }
    return {
      text: status || 'Menunggu',
      className: 'bg-amber-950/60 text-amber-400 border-amber-500/30'
    };
  };

  const technicians = users.filter(u => u.role === 'teknisi');

  const handleStartEdit = (task) => {
    setEditingTask(task);
    setEditForm({
      jenis_kerja: task.jenis_kerja || 'Pasang Baru',
      pelanggan_nama: task.pelanggan_nama || '',
      pelanggan_telp: task.pelanggan_telp || '',
      lokasi: task.lokasi || '',
      teknisi_id: task.teknisi_id ? String(task.teknisi_id) : '',
      status: task.status || 'Open',
      keterangan: task.keterangan || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    await updateTugas(editingTask.id, {
      jenis_kerja: editForm.jenis_kerja,
      pelanggan_nama: editForm.pelanggan_nama,
      pelanggan_telp: editForm.pelanggan_telp,
      lokasi: editForm.lokasi,
      teknisi_id: editForm.teknisi_id ? parseInt(editForm.teknisi_id, 10) : null,
      status: editForm.status,
      keterangan: editForm.keterangan
    });

    setEditingTask(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm(`Yakin ingin membatalkan & menghapus tiket #${id}?`)) {
      await deleteTugas(id);
    }
  };

  // Filter tugas
  const filteredTugas = tugas.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      String(t.id).includes(q) ||
      (t.pelanggan_nama || '').toLowerCase().includes(q) ||
      (t.lokasi || '').toLowerCase().includes(q) ||
      (t.jenis_kerja || '').toLowerCase().includes(q);

    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchJenis = jenisFilter === 'all' || t.jenis_kerja === jenisFilter;

    return matchSearch && matchStatus && matchJenis;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Top Header Terpadu (Hanya muncul jika hideHeader bernilai false) */}
      {!hideHeader && (
        <div className="bg-white dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200 dark:border-rose-950/40 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.37)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Manajemen Tiket Lapangan
            </h1>
          </div>

          {onOpenCreateModal && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 hover:shadow-rose-900/40 transition cursor-pointer active:scale-95 whitespace-nowrap w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Terbitkan Tiket Baru</span>
            </button>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200 dark:border-rose-950/40 rounded-2xl p-3.5 sm:p-4 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.37)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari ID tiket, nama pelanggan, lokasi jalan, atau jenis pekerjaan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border bg-slate-50 dark:bg-slate-950/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-semibold border bg-slate-50 dark:bg-slate-950/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-rose-500/60 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="Open">Open (Menunggu)</option>
            <option value="Progress">Progress (Dikerjakan)</option>
            <option value="Done">Done (Selesai)</option>
          </select>

          {/* Jenis Kerja Filter */}
          <select
            value={jenisFilter}
            onChange={(e) => setJenisFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-semibold border bg-slate-50 dark:bg-slate-950/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-rose-500/60 cursor-pointer"
          >
            <option value="all">Semua Jenis Pekerjaan</option>
            <option value="Pasang Baru">Pasang Baru</option>
            <option value="Gangguan">Gangguan (LOS)</option>
            <option value="ODP">Maintenance ODP</option>
          </select>
        </div>
      </div>

      {/* Tampilan Desktop: Tabel Data Tiket (hidden md:block) */}
      <div className="hidden md:block bg-white dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200 dark:border-rose-950/40 rounded-2xl overflow-hidden shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 table-auto">
            <thead className="bg-slate-100 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-rose-950/40 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-3.5 py-3 whitespace-nowrap w-[68px]">ID Tiket</th>
                <th className="px-3 py-3 whitespace-nowrap min-w-[140px]">Jenis Pekerjaan</th>
                <th className="px-3.5 py-3 min-w-[180px]">Pelanggan &amp; Lokasi</th>
                <th className="px-3 py-3 whitespace-nowrap w-[130px]">Teknisi Bertugas</th>
                <th className="px-3 py-3 text-center whitespace-nowrap w-[100px]">Status</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap w-[130px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-rose-950/20">
              {filteredTugas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-400 italic">
                    Tidak ada tiket pekerjaan yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredTugas.map((task) => {
                  const tech = users.find(u => Number(u.id) === Number(task.teknisi_id));
                  const isDone = task.status === 'Done';
                  const cust = parseTaskDetails(task);
                  const statusInfo = getStatusBadge(task.status);

                  return (
                    <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-rose-950/10 transition-colors">
                      {/* Kolom ID Tiket */}
                      <td className="px-3.5 py-2.5 font-mono font-bold text-rose-500 dark:text-rose-400 text-xs tracking-wider whitespace-nowrap">
                        #{task.id}
                      </td>

                      {/* Kolom Jenis Pekerjaan */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border tracking-wide shrink-0 ${getTaskTypeBadge(task.jenis_kerja)}`}>
                          {task.jenis_kerja || 'Penugasan'}
                        </span>
                      </td>

                      {/* Kolom Pelanggan & Lokasi (Diparsing Bersih Tanpa Duplikasi) */}
                      <td className="px-3.5 py-2.5">
                        <div className="space-y-0.5">
                          {/* Baris 1: Nama Pelanggan & No. Telepon */}
                          <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs tracking-wide truncate">
                            <span>{cust.name}</span>
                            {cust.telp && (
                              <span className="text-slate-500 dark:text-slate-300 font-mono font-normal ml-1.5">
                                • {cust.telp}
                              </span>
                            )}
                          </div>

                          {/* Baris 2: Alamat Jalan Singkat dengan MapPin */}
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span className="truncate max-w-[200px] xl:max-w-[280px]" title={cust.address}>{cust.address}</span>
                          </div>

                          {/* Baris 3: Waktu Buat kecil */}
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            Waktu Buat: {formatWaktuBuat(task)}
                          </div>
                        </div>
                      </td>

                      {/* Kolom Teknisi Bertugas */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {tech ? (
                          <button
                            type="button"
                            onClick={() => setSelectedTechnician(tech)}
                            className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 hover:underline cursor-pointer font-semibold transition text-left"
                            title="Lihat riwayat teknisi"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0"></span>
                            <span className="truncate max-w-[120px]">{tech.nama_lengkap}</span>
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-500/30 whitespace-nowrap inline-flex items-center gap-1">
                            📢 Open Pool
                          </span>
                        )}
                      </td>

                      {/* Kolom Status (Badge Status Bersih) */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase inline-block whitespace-nowrap border ${statusInfo.className}`}>
                          ● {statusInfo.text}
                        </span>
                      </td>

                      {/* Kolom Aksi */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isDone && onOpenBastp && (
                            <button
                              type="button"
                              onClick={() => onOpenBastp(task)}
                              className="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap"
                              title="Buka Dokumen Resmi BASTP"
                            >
                              <FileText className="w-3 h-3" />
                              <span>BASTP</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartEdit(task)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                            aria-label="Edit Tiket"
                            title="Edit Data Tiket"
                          >
                            <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="hidden xl:inline">Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                            aria-label="Hapus Tiket"
                            title="Hapus Tiket"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tampilan Mobile: Mobile Card View (block md:hidden, bebas overflow horizontal) */}
      <div className="block md:hidden space-y-3">
        {filteredTugas.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 rounded-2xl border bg-white dark:bg-slate-950/70 border-slate-200 dark:border-rose-950/40 italic">
            Tidak ada tiket pekerjaan yang sesuai dengan kriteria filter.
          </div>
        ) : (
          filteredTugas.map((task) => {
            const tech = users.find(u => Number(u.id) === Number(task.teknisi_id));
            const isDone = task.status === 'Done';
            const cust = parseTaskDetails(task);
            const statusInfo = getStatusBadge(task.status);

            return (
              <div
                key={task.id}
                className="p-4 rounded-2xl border bg-white dark:bg-slate-950/70 border-slate-200 dark:border-rose-950/40 backdrop-blur-xl shadow-sm dark:shadow-lg space-y-2.5"
              >
                {/* Header Card: ID Tiket (#38), Badge Jenis Kerja, Badge Status di kanan atas */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-rose-500 dark:text-rose-400 text-xs shrink-0">
                      #{task.id}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-bold border tracking-wide truncate ${getTaskTypeBadge(task.jenis_kerja)}`}>
                      {task.jenis_kerja || 'Penugasan'}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap shrink-0 ${statusInfo.className}`}>
                    ● {statusInfo.text}
                  </span>
                </div>

                {/* Body Card */}
                <div className="space-y-1.5 text-xs">
                  {/* Nama Pelanggan & Nomor Telepon (Bold) */}
                  <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                    <span>{cust.name}</span>
                    {cust.telp && (
                      <span className="text-slate-500 dark:text-slate-300 font-mono font-normal ml-1.5">
                        • {cust.telp}
                      </span>
                    )}
                  </div>

                  {/* Alamat lokasi (dengan ikon MapPin) */}
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{cust.address}</span>
                  </div>

                  {/* Teknisi bertugas & Tanggal terbit tiket */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-white/5 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {tech ? (
                        <button
                          type="button"
                          onClick={() => setSelectedTechnician(tech)}
                          className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-500 dark:hover:text-rose-300 font-semibold cursor-pointer truncate"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                          <span className="truncate">{tech.nama_lengkap}</span>
                        </button>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                          📢 Open Pool
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{formatWaktuBuat(task)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Card: Action bar horizontal penuh */}
                <div className={`grid ${isDone && onOpenBastp ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs font-bold`}>
                  {isDone && onOpenBastp && (
                    <button
                      type="button"
                      onClick={() => onOpenBastp(task)}
                      className="min-h-[38px] px-2 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Lihat BASTP</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartEdit(task)}
                    className="min-h-[38px] px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(task.id)}
                    className="min-h-[38px] px-2 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Edit Tiket Penugasan */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border p-6 shadow-2xl bg-white dark:bg-slate-950/90 backdrop-blur-2xl border-slate-200 dark:border-rose-950/50 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-rose-950/40">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-100 dark:bg-rose-600/20 text-rose-600 dark:text-rose-500 border border-rose-200 dark:border-rose-500/30">
                  <Edit2 className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Tiket Penugasan #{editingTask.id}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                aria-label="Tutup jendela"
                title="Tutup"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-600 dark:text-slate-400">Jenis Pekerjaan</label>
                  <select
                    value={editForm.jenis_kerja}
                    onChange={(e) => setEditForm({ ...editForm, jenis_kerja: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500/60"
                  >
                    <option value="Pasang Baru">Pasang Baru</option>
                    <option value="Gangguan">Gangguan (LOS)</option>
                    <option value="ODP">Maintenance ODP</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-600 dark:text-slate-400">Status Tiket</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500/60"
                  >
                    <option value="Open">Open (Menunggu)</option>
                    <option value="Progress">Progress (Dikerjakan)</option>
                    <option value="Done">Done (Selesai)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-600 dark:text-slate-400">Nama Pelanggan</label>
                  <input
                    type="text"
                    required
                    value={editForm.pelanggan_nama}
                    onChange={(e) => setEditForm({ ...editForm, pelanggan_nama: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500/60"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-600 dark:text-slate-400">No. Telepon / HP</label>
                  <input
                    type="text"
                    value={editForm.pelanggan_telp}
                    onChange={(e) => setEditForm({ ...editForm, pelanggan_telp: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-600 dark:text-slate-400">Alamat Lokasi Pelanggan</label>
                <input
                  type="text"
                  required
                  value={editForm.lokasi}
                  onChange={(e) => setEditForm({ ...editForm, lokasi: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500/60"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-600 dark:text-slate-400">Teknisi Penanggung Jawab</label>
                <select
                  value={editForm.teknisi_id}
                  onChange={(e) => setEditForm({ ...editForm, teknisi_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500/60"
                >
                  <option value="">-- Siarkan Terbuka di Pool Teknisi --</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.nama_lengkap} ({tech.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-600 dark:text-slate-400">Keterangan / Instruksi Kerja</label>
                <textarea
                  rows="2"
                  value={editForm.keterangan}
                  onChange={(e) => setEditForm({ ...editForm, keterangan: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/80 border-slate-300 dark:border-rose-950/40 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500/60"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-rose-950/40">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold shadow-lg shadow-rose-950/40 transition active:scale-95 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail & Riwayat Kerja Teknisi */}
      {selectedTechnician && (
        <ModalDetailRiwayatTeknisi
          teknisi={selectedTechnician}
          onClose={() => setSelectedTechnician(null)}
          onOpenBastp={onOpenBastp}
          onNavigateToTracking={() => {}}
        />
      )}
    </div>
  );
}
