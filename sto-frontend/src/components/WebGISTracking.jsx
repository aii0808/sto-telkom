import React, { useState, useEffect } from 'react';
import {
  Search,
  Radio,
  Edit2,
  Trash2,
  Filter
} from 'lucide-react';
import WebGISMap from './WebGISMap';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

export default function WebGISTracking({ initialSelectedTaskId = null, onEditOdp = null }) {
  const { isDark } = useTheme();
  const {
    odp = [],
    deleteOdp
  } = useApp();

  const [selectedOdpId, setSelectedOdpId] = useState(null);
  const [selectedTugasId, setSelectedTugasId] = useState(initialSelectedTaskId);

  useEffect(() => {
    if (initialSelectedTaskId != null) {
      setSelectedTugasId(initialSelectedTaskId);
    }
  }, [initialSelectedTaskId]);
  const [odpToEdit, setOdpToEdit] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Handler Edit ODP standar React tanpa bergantung pada objek global window
  const handleEditOdp = (pointOrId) => {
    let target = pointOrId;
    if (typeof pointOrId === 'number' || typeof pointOrId === 'string') {
      target = odp.find(o => Number(o.id) === Number(pointOrId)) || null;
    }
    setOdpToEdit(target);
    if (typeof onEditOdp === 'function') {
      onEditOdp(target);
    }
  };

  const handleDeleteOdp = (id) => {
    if (window.confirm('Yakin ingin menghapus titik ODP ini dari WebGIS?')) {
      deleteOdp(id);
    }
  };

  // Filter ODP untuk daftar CRUD di bawah WebGIS
  const filteredOdp = odp.filter((item) => {
    const matchSearch =
      item.kode_odp?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nama_lokasi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.alamat?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Statistik Geospasial ODP & Okupansi Port Realtime Dari Tabel WebGIS
  const totalOdp = odp.length || 0;
  const odpTersedia = odp.filter(
    (o) => o.status === 'Tersedia' || (!o.status && (Number(o.kapasitas_port || 8) - Number(o.port_terpakai || 0) > 0))
  ).length;
  const odpPenuh = odp.filter(
    (o) => o.status === 'Penuh' || (Number(o.kapasitas_port || 8) - Number(o.port_terpakai || 0) <= 0)
  ).length;
  const odpMaint = odp.filter(
    (o) => o.status === 'Maintenance' || o.status === 'Optimasi' || Number(o.redaman_dbm) <= -24
  ).length;
  const calcTotalOdp = totalOdp > 0 ? totalOdp : 1;

  const odpRadius = 38;
  const odpCircumference = 2 * Math.PI * odpRadius;
  const tersediaStroke = (odpTersedia / calcTotalOdp) * odpCircumference;
  const penuhStroke = (odpPenuh / calcTotalOdp) * odpCircumference;
  const maintStroke = (odpMaint / calcTotalOdp) * odpCircumference;

  const tersediaPercent = totalOdp > 0 ? Math.round((odpTersedia / totalOdp) * 100) : 0;
  const penuhPercent = totalOdp > 0 ? Math.round((odpPenuh / totalOdp) * 100) : 0;
  const maintPercent = totalOdp > 0 ? Math.max(0, 100 - tersediaPercent - penuhPercent) : 0;

  const totalPorts = odp.reduce((acc, curr) => acc + (Number(curr.kapasitas_port) || 8), 0);
  const usedPorts = odp.reduce((acc, curr) => acc + (Number(curr.port_terpakai) || 0), 0);
  const totalIdlePorts = Math.max(0, totalPorts - usedPorts);
  const portOkupansiPct = totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Status ODP & Ringkasan Geospasial Realtime Di Atas Peta WebGIS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Kolom 1: Donut Chart Status ODP Realtime Dari Tabel WebGIS */}
        <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
          isDark ? 'bg-slate-950/70 border-slate-800/80 backdrop-blur-xl shadow-lg' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>Status ODP Realtime</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30">
              {totalOdp} Titik
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 py-1">
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={odpRadius} fill="transparent" stroke={isDark ? '#1e293b' : '#f1f5f9'} strokeWidth="12" />
                <circle cx="50" cy="50" r={odpRadius} fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray={`${tersediaStroke} ${odpCircumference}`} strokeDashoffset="0" className="transition-all duration-700" />
                <circle cx="50" cy="50" r={odpRadius} fill="transparent" stroke="#f43f5e" strokeWidth="12" strokeDasharray={`${penuhStroke} ${odpCircumference}`} strokeDashoffset={`-${tersediaStroke}`} className="transition-all duration-700" />
                <circle cx="50" cy="50" r={odpRadius} fill="transparent" stroke="#f59e0b" strokeWidth="12" strokeDasharray={`${maintStroke} ${odpCircumference}`} strokeDashoffset={`-${tersediaStroke + penuhStroke}`} className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-sm font-black text-white font-mono leading-none">{totalIdlePorts}</span>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Port Idle</span>
              </div>
            </div>

            <div className="space-y-1 shrink-0 text-[10px]">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Tersedia:</span>
                </span>
                <strong className="font-mono text-emerald-400">{odpTersedia} ({tersediaPercent}%)</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span>Penuh:</span>
                </span>
                <strong className="font-mono text-rose-400">{odpPenuh} ({penuhPercent}%)</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>Maintenance:</span>
                </span>
                <strong className="font-mono text-amber-400">{odpMaint} ({maintPercent}%)</strong>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Total Port FO:</span>
            <span className="font-bold text-cyan-400 font-mono">{usedPorts}/{totalPorts} ({portOkupansiPct}% Okupansi)</span>
          </div>
        </div>

        {/* Kolom 2: 4 Kartu KPI Atas */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card 1: Total ODP */}
          <div className={`card-interactive cursor-pointer p-3 rounded-2xl border transition-all flex flex-col justify-between ${
            isDark ? 'bg-slate-950/70 border-slate-800/80 backdrop-blur-xl shadow-lg' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>TOTAL ODP</div>
            <div className={`text-lg sm:text-xl font-black mt-0.5 font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalOdp} Titik</div>
            <div className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tersebar STO Pyk</div>
          </div>

          {/* Card 2: Port Tersedia */}
          <div className={`card-interactive cursor-pointer p-3 rounded-2xl border transition-all flex flex-col justify-between ${
            isDark ? 'bg-slate-950/70 border-emerald-950/40 backdrop-blur-xl shadow-lg' : 'bg-emerald-50/70 border-emerald-200 shadow-sm'
          }`}>
            <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">PORT TERSEDIA</div>
            <div className="text-lg sm:text-xl font-black mt-0.5 text-emerald-600 dark:text-emerald-400 font-mono">{totalIdlePorts} Port</div>
            <div className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-emerald-700/80'}`}>Siap Pasang Baru</div>
          </div>

          {/* Card 3: ODP Penuh */}
          <div className={`card-interactive cursor-pointer p-3 rounded-2xl border transition-all flex flex-col justify-between ${
            isDark ? 'bg-slate-950/70 border-rose-950/40 backdrop-blur-xl shadow-lg' : 'bg-rose-50/70 border-rose-200 shadow-sm'
          }`}>
            <div className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">ODP PENUH</div>
            <div className="text-lg sm:text-xl font-black mt-0.5 text-rose-600 dark:text-rose-400 font-mono">{odpPenuh} Titik</div>
            <div className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-rose-700/80'}`}>Okupansi 100%</div>
          </div>

          {/* Card 4: Perlu Optimasi */}
          <div className={`card-interactive cursor-pointer p-3 rounded-2xl border transition-all flex flex-col justify-between ${
            isDark ? 'bg-slate-950/70 border-amber-950/40 backdrop-blur-xl shadow-lg' : 'bg-amber-50/70 border-amber-200 shadow-sm'
          }`}>
            <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">PERLU OPTIMASI</div>
            <div className="text-lg sm:text-xl font-black mt-0.5 text-amber-600 dark:text-amber-400 font-mono">{odpMaint} Titik</div>
            <div className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-amber-700/80'}`}>Redaman &gt; -24 dBm</div>
          </div>
        </div>
      </div>

      {/* Grid: Map Utama WebGIS (Tinggi Proporsional, Rapi & Elegan) */}
      <div className={`h-[440px] sm:h-[480px] w-full rounded-3xl overflow-hidden shadow-2xl border ${
        isDark ? 'border-slate-800/80 bg-slate-950' : 'border-slate-300 bg-white'
      }`}>
        <WebGISMap
          selectedOdpId={selectedOdpId}
          onSelectOdp={setSelectedOdpId}
          selectedTugasId={selectedTugasId}
          onSelectTugas={setSelectedTugasId}
          odpToEdit={odpToEdit}
          onClearEditOdp={() => setOdpToEdit(null)}
          onEditOdp={handleEditOdp}
        />
      </div>

      {/* Grid List Kartu ODP Detail (CRUD ODP di bawah WebGIS) */}
      <div className={`p-4 sm:p-5 rounded-3xl border shadow-xl ${
        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-500 border border-blue-500/30 flex items-center justify-center font-bold">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Daftar Titik ODP Jaringan (Hasil Pemetaan WebGIS)
              </h3>
              <p className="text-[11px] text-slate-400">
                Pilih ODP untuk fokus di peta &bull; Edit kapasitas port &bull; Hapus titik
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search ODP */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
              isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari kode ODP / alamat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent focus:outline-none w-36 sm:w-48 text-xs"
              />
            </div>

            {/* Filter Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
              isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent focus:outline-none text-xs font-semibold cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="Tersedia">Tersedia</option>
                <option value="Penuh">Penuh</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grid List Kartu ODP */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredOdp.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-500 text-xs italic">
              Tidak ada titik ODP yang cocok dengan filter pencarian.
            </div>
          ) : (
            filteredOdp.map((point) => {
              const isSelected = selectedOdpId === point.id;
              const usedPort = Number(point.port_terpakai) || 0;
              const totalPort = Number(point.kapasitas_port) || 8;
              const availablePort = Math.max(0, totalPort - usedPort);
              const percentUsed = Math.min(100, Math.round((usedPort / totalPort) * 100));

              let statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
              let barColor = 'bg-emerald-500';

              if (point.status === 'Penuh' || availablePort === 0) {
                statusBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                barColor = 'bg-rose-500';
              } else if (point.status === 'Maintenance') {
                statusBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                barColor = 'bg-amber-500';
              }

              const rawVal = parseFloat(point.redaman_dbm);
              const redamanMag = !isNaN(rawVal) ? Math.abs(rawVal) : 18.5;
              const formattedRedaman = `-${redamanMag.toFixed(1)} dBm`;

              let redamanBadgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
              if (redamanMag > 24) {
                redamanBadgeClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
              } else if (redamanMag > 22) {
                redamanBadgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
              }

              return (
                <div
                  key={point.id}
                  onClick={() => setSelectedOdpId(point.id)}
                  className={`card-interactive p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-500/10'
                      : isDark
                      ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-500 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                        FO
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {point.kode_odp}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {Number(point.latitude).toFixed(4)}, {Number(point.longitude).toFixed(4)}
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusBadge}`}>
                      {point.status}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px]">Alamat Tiang:</span>
                      <div className={`font-semibold text-[11px] truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {point.alamat || point.nama_lokasi}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-400">Okupansi Port:</span>
                        <strong className={isDark ? 'text-white' : 'text-slate-900'}>
                          {usedPort} dari {totalPort} Port Terpakai ({availablePort} Kosong)
                        </strong>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentUsed}%` }}></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="text-slate-400">Redaman Optik:</span>
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border shrink-0 whitespace-nowrap ${redamanBadgeClass}`}>
                        {formattedRedaman}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/40">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditOdp(point);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOdp(point.id);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}