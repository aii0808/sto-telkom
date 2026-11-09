import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { Printer, FileText, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function CetakSuratPermohonan() {
  const { isDark } = useTheme();
  const { permohonan, detailPermohonan, barang, tugas, users, currentUser } = useApp();

  // Cari daftar permohonan milik teknisi ini atau semua jika pimpinan
  const techRequests = permohonan.filter(p => {
    const parentTask = tugas.find(t => t.id === p.tugas_id);
    if (currentUser?.role === 'teknisi') {
      return parentTask?.teknisi_id === currentUser?.id;
    }
    return true;
  });

  const [selectedReqId, setSelectedReqId] = useState(techRequests[0]?.id || null);

  const activeRequest = permohonan.find(p => p.id === selectedReqId) || techRequests[0];
  const activeTask = tugas.find(t => t.id === activeRequest?.tugas_id);
  const activeTech = users.find(u => u.id === activeTask?.teknisi_id) || currentUser;
  const activePimpinan = users.find(u => u.id === activeTask?.pimpinan_id) || users.find(u => u.role === 'pimpinan');

  const requestDetails = detailPermohonan
    .filter(d => d.permohonan_id === activeRequest?.id)
    .map(d => {
      const item = barang.find(b => b.id === d.barang_id);
      return { ...d, item };
    });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Selector Toolbar (Hidden on Print) */}
      <div className={`no-print p-4 sm:p-5 rounded-2xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-600/20 text-rose-500 border border-rose-500/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Cetak Fisik Surat Permohonan Material Gudang
            </h2>
            <p className="text-xs text-slate-400">
              Dokumen pengesahan fisik pengambilan barang untuk serah terima ke petugas logistik gudang STO.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2.5">
          <select
            value={activeRequest?.id || ''}
            onChange={(e) => setSelectedReqId(Number(e.target.value))}
            className={`w-full sm:w-auto text-xs px-3.5 py-2.5 rounded-xl border font-semibold ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} focus:outline-none focus:border-rose-500`}
          >
            {techRequests.map(req => (
              <option key={req.id} value={req.id}>
                Permohonan #{req.id} - Tiket #{req.tugas_id} ({req.status})
              </option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-900/30 transition cursor-pointer active:scale-95 shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ Cetak Formulir (Print)</span>
          </button>
        </div>
      </div>

      {/* Official Telkom Akses Printable Letter */}
      {activeRequest ? (
        <div className={`p-5 sm:p-10 rounded-3xl border-2 ${isDark ? 'bg-slate-900/90 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'} shadow-2xl print-card transition-all`}>
          
          {/* Official Letterhead (KOP SURAT RESMI TELKOM AKSES) */}
          <div className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-rose-600 to-rose-700 flex flex-col items-center justify-center text-white shadow-md border-2 border-rose-400 shrink-0">
                <span className="font-black text-lg tracking-wider leading-none">TA</span>
                <span className="text-[8px] font-bold tracking-tighter opacity-90 mt-0.5">TELKOM</span>
              </div>
              <div>
                <h1 className={`text-base sm:text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'} uppercase print-text-dark`}>
                  PT TELKOM AKSES (PERSERO)
                </h1>
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                  AREA OPERASIONAL PAYAKUMBUH &bull; WITEL SUMATERA BARAT
                </div>
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 print-text-dark">
                  Sentral Telepon Otomatis (STO) Koto Nan IV
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 print-text-dark mt-0.5">
                  Jl. Soekarno-Hatta No. 12, Koto Nan IV, Kec. Payakumbuh Barat, Kota Payakumbuh 26224 | Telp: (0752) 92881
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right font-mono text-xs mt-1 sm:mt-0 border-l-2 sm:border-l-0 pl-3 sm:pl-0 border-rose-500">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Nomor Formulir Resmi:</div>
              <div className={`font-black text-xs sm:text-sm text-rose-600 dark:text-rose-400 print-text-dark`}>
                SPB/TA-PYK/{new Date().getFullYear()}/{String(activeRequest.id).padStart(4, '0')}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 print-text-dark mt-0.5">
                Tanggal: <strong>{activeRequest.waktu_request || new Date().toISOString().split('T')[0]}</strong>
              </div>
              <div className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
                Status: {activeRequest.status || 'Pending'}
              </div>
            </div>
          </div>

          {/* Garis Pembatas Kop Surat Ganda (Standar Dokumen Resmi Telkom) */}
          <div className="border-b-4 border-rose-600 mt-2"></div>
          <div className="border-b border-slate-800 dark:border-slate-500 mt-1 mb-6"></div>

          {/* Title Dokumen */}
          <div className="text-center mb-6">
            <h2 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'} print-text-dark uppercase tracking-wider underline underline-offset-4 decoration-rose-600`}>
              SURAT PERMOHONAN PENGAMBILAN MATERIAL GUDANG (SPMG)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 print-text-dark mt-1.5">
              Dasar Penugasan Lapangan Tiket Operasional & Logistik PT Telkom Akses Payakumbuh
            </p>
          </div>

          {/* Metadata Section dengan Border Tebal & Jelas */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 rounded-2xl border-2 ${isDark ? 'border-slate-700 bg-slate-950/60 text-slate-300' : 'border-slate-300 bg-slate-50 text-slate-800'} print-table mb-6 text-xs print-text-dark`}>
            <div className="space-y-2">
              <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-bold">ID Tiket Pekerjaan:</span>
                <strong className="font-mono text-rose-600 dark:text-rose-400">#{activeTask?.id || activeRequest.tugas_id}</strong>
              </div>
              <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-bold">Jenis Pekerjaan:</span>
                <strong>{activeTask?.jenis_kerja || 'Pasang Baru / Perbaikan'}</strong>
              </div>
              <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-bold">Nama Pelanggan:</span>
                <strong>{activeTask?.pelanggan_nama || 'Pelanggan Telkom'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Alamat Lokasi:</span>
                <span className="text-right truncate max-w-[200px]">{activeTask?.lokasi || 'Koto Nan IV Payakumbuh'}</span>
              </div>
            </div>

            <div className="space-y-2 sm:border-l sm:pl-4 border-slate-200 dark:border-slate-800">
              <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-bold">Teknisi Pemohon:</span>
                <strong>{activeTech?.nama_lengkap || 'Ahmad Fadli'}</strong>
              </div>
              <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-bold">ID / NIK Teknisi:</span>
                <span className="font-mono">TA-{activeTech?.id || '02'}9821</span>
              </div>
              <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-bold">Catatan Kebutuhan:</span>
                <span className="italic truncate max-w-[180px]">"{activeRequest.catatan_teknisi || '-'}"</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Verifikasi Sistem:</span>
                <span className="font-mono font-bold text-emerald-500">TERDATA SECARA RESMI</span>
              </div>
            </div>
          </div>

          {/* Items Table dengan Border Jelas & Kontras Standar Formulir Cetak */}
          <div className="overflow-x-auto mb-6">
            <table className={`w-full text-left text-xs border-collapse border-2 ${isDark ? 'border-slate-700 text-slate-200' : 'border-slate-400 text-slate-800'} print-table`}>
              <thead>
                <tr className={`${isDark ? 'bg-slate-950 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-400'} uppercase text-[10px] tracking-wider border-b-2 font-black`}>
                  <th className="px-3 py-3 text-center w-12 border border-slate-400 dark:border-slate-700">No</th>
                  <th className="px-3 py-3 border border-slate-400 dark:border-slate-700">Kode Material</th>
                  <th className="px-3 py-3 border border-slate-400 dark:border-slate-700">Nama Barang / Spesifikasi Material</th>
                  <th className="px-3 py-3 text-center border border-slate-400 dark:border-slate-700">Satuan</th>
                  <th className="px-3 py-3 text-right border border-slate-400 dark:border-slate-700">Jumlah Permohonan</th>
                  <th className="px-3 py-3 text-center border border-slate-400 dark:border-slate-700">Paraf Gudang</th>
                </tr>
              </thead>
              <tbody>
                {requestDetails.map((detail, idx) => (
                  <tr key={idx} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2.5 text-center font-mono border border-slate-300 dark:border-slate-700 font-bold">{idx + 1}</td>
                    <td className={`px-3 py-2.5 font-mono border border-slate-300 dark:border-slate-700 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {detail.item?.kode || `MAT-0${detail.barang_id}`}
                    </td>
                    <td className={`px-3 py-2.5 font-bold border border-slate-300 dark:border-slate-700 ${isDark ? 'text-white' : 'text-slate-900'} print-text-dark`}>
                      {detail.item?.nama_barang || `Material ID #${detail.barang_id}`}
                    </td>
                    <td className={`px-3 py-2.5 text-center border border-slate-300 dark:border-slate-700 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {detail.item?.satuan || 'pcs'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-rose-600 dark:text-rose-400 border border-slate-300 dark:border-slate-700 print-text-dark text-sm">
                      {detail.jumlah_minta}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-400 border border-slate-300 dark:border-slate-700 print-text-dark font-mono">
                      [ &nbsp; &nbsp; &nbsp; &nbsp; ]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Official Signatures Block dengan Border Box Rapi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t-2 border-slate-300 dark:border-slate-700 text-center text-xs print-text-dark">
            {/* Box 1: Teknisi */}
            <div className={`p-4 rounded-2xl border-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-300 bg-slate-50'} space-y-2`}>
              <p className="font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                Pemohon (Teknisi Lapangan)
              </p>
              <div className="h-16 flex items-center justify-center border-y border-dashed border-slate-300 dark:border-slate-700 my-1">
                <span className="text-slate-400 italic text-[11px]">( Tanda Tangan Fisik )</span>
              </div>
              <p className="font-black text-slate-900 dark:text-white underline">{activeTech?.nama_lengkap || 'Ahmad Fadli'}</p>
              <p className="text-[10px] text-slate-500 font-mono">NIK: TA-{activeTech?.id || '02'}9821</p>
            </div>

            {/* Box 2: Pimpinan STO */}
            <div className={`p-4 rounded-2xl border-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-300 bg-slate-50'} space-y-2`}>
              <p className="font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                Menyetujui (Pimpinan STO)
              </p>
              <div className="h-16 flex items-center justify-center border-y border-dashed border-slate-300 dark:border-slate-700 my-1">
                {activeRequest.status === 'Approved' || activeRequest.status === 'Released' ? (
                  <div className="px-3 py-1 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>DISETUJUI DIGITAL</span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-[11px]">( Tanda Tangan & Cap )</span>
                )}
              </div>
              <p className="font-black text-slate-900 dark:text-white underline">
                {activePimpinan?.nama_lengkap || 'Ir. Bambang Sudirman, M.T.'}
              </p>
              <p className="text-[10px] text-slate-500">Manager STO Payakumbuh</p>
            </div>

            {/* Box 3: Petugas Gudang */}
            <div className={`p-4 rounded-2xl border-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-300 bg-slate-50'} space-y-2`}>
              <p className="font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                Menyerahkan (Petugas Gudang)
              </p>
              <div className="h-16 flex items-center justify-center border-y border-dashed border-slate-300 dark:border-slate-700 my-1">
                <span className="text-slate-400 italic text-[11px]">( Tanda Tangan & Cap Logistik )</span>
              </div>
              <p className="font-black text-slate-900 dark:text-white underline">Restui / Siti Rahmawati</p>
              <p className="text-[10px] text-slate-500">Staff Logistik & Inventaris</p>
            </div>
          </div>

        </div>
      ) : (
        <div className={`p-12 text-center rounded-3xl border-2 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <Clock className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Belum Ada Surat Permohonan Barang
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Silakan ajukan permohonan material terlebih dahulu melalui tombol "Isi Kebutuhan Material" pada daftar tiket aktif.
          </p>
        </div>
      )}
    </div>
  );
}
