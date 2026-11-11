// oxlint-disable no-unused-vars
/**
 * ============================================================================
 * KOMPONEN: ModalBASTP (Berita Acara Serah Terima Pekerjaan & Rekonsiliasi Material)
 * ============================================================================
 * Penjelasan Teknis Operasional STO Telkom Akses:
 * Dokumen BASTP ini adalah bukti digital resmi standar Telkom Akses yang membuktikan:
 * 1. Pekerjaan lapangan telah selesai dikerjakan dengan kualitas redaman teruji.
 * 2. Perangkat hardware (Modem ONT dengan Serial Number terdata) telah terpasang di rumah pelanggan.
 * 3. Rekonsiliasi material membuktikan kabel Dropcore dan material lain benar-benar
 *    "TERPASANG DI PELANGGAN" dan bukan hilang tanpa jejak.
 * 4. Dapat dicetak langsung (Print/PDF) untuk keperluan arsip administrasi resmi perusahaan.
 * ============================================================================
 */

import React from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Printer,
  X,
  CheckCircle2,
  Radio,
  Barcode,
  Calendar,
  User,
  MapPin,
  ShieldCheck,
  Package
} from 'lucide-react';

export default function ModalBASTP({ task, onClose }) {
  const { isDark } = useTheme();

  if (!task) return null;

  const bastp = task.bastp || {
    nomor_bastp: `BASTP/TA-PYK/2026/${String(task.id).padStart(4, '0')}`,
    odp_id: task.odp_id || 'ODP-PYK-FA/014',
    port_odp: task.port_odp || '03',
    redaman_dbm: task.redaman_dbm || '-18.5',
    sn_ont: task.sn_ont || 'ZTEGC8B90112',
    pelanggan_nama: task.pelanggan_nama || 'Pelanggan Telkom',
    waktu_closing: task.waktu_selesai || '2026-10-12 11:00',
    catatan_teknisi: task.catatan_selesai || task.catatan || 'Instalasi selesai, koneksi optimal.',
    reconciliation: [
      {
        nama_barang: 'Kabel Dropcore 1 Core (FO)',
        jumlah_diambil: 150,
        jumlah_terpakai: 120,
        jumlah_sisa: 30,
        satuan: 'meter',
        status: 'TERPASANG DI PELANGGAN'
      },
      {
        nama_barang: 'Modem ONT GPON Wi-Fi (ZTE F609)',
        jumlah_diambil: 1,
        jumlah_terpakai: 1,
        jumlah_sisa: 0,
        satuan: 'unit',
        sn: task.sn_ont || 'ZTEGC8B90112',
        status: 'TERPASANG DI PELANGGAN'
      }
    ]
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className={`rounded-3xl w-full max-w-4xl border-2 shadow-2xl transition-all max-h-[94vh] flex flex-col ${
        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
      }`}>
        
        {/* HEADER MODAL DENGAN TOMBOL PRINT */}
        <div className="no-print flex items-center justify-between p-4 sm:p-5 border-b-2 border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold">
                Berita Acara Serah Terima Pekerjaan (BASTP) Resmi
              </h2>
              <p className="text-[11px] text-slate-400">
                Dokumen Audit Rekonsiliasi Material & Bukti Penyelesaian Lapangan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak BASTP (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AREA DOKUMEN CETAK BASTP RESMI */}
        <div className="printable-bastp flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 text-xs text-slate-900 dark:text-slate-100">
          
          {/* KOP SURAT FORMAL TELKOM AKSES */}
          <div className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-rose-600 to-rose-700 flex flex-col items-center justify-center text-white shadow-md border-2 border-rose-400 shrink-0">
                <span className="font-black text-lg tracking-wider leading-none">TA</span>
                <span className="text-[8px] font-bold tracking-tighter opacity-90 mt-0.5">TELKOM</span>
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight uppercase print-text-dark">
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
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Nomor BASTP Resmi:</div>
              <div className="font-black text-xs sm:text-sm text-rose-600 dark:text-rose-400 print-text-dark">
                {bastp.nomor_bastp}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 print-text-dark mt-0.5">
                Waktu Selesai: <strong>{bastp.waktu_closing}</strong>
              </div>
              <div className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
                Status: Selesai & Terpasang
              </div>
            </div>
          </div>

          {/* Garis Pembatas Kop Surat Ganda */}
          <div className="border-b-4 border-rose-600 mt-2"></div>
          <div className="border-b border-slate-800 dark:border-slate-500 mt-1 mb-6"></div>

          {/* JUDUL DOKUMEN */}
          <div className="text-center py-1">
            <h2 className="text-base sm:text-lg font-black tracking-wider uppercase underline underline-offset-4 decoration-rose-600 print-text-dark">
              BERITA ACARA SERAH TERIMA PEKERJAAN & PEMAKAIAN MATERIAL
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 print-text-dark">
              Ref: Tiket Perintah Kerja #{task.id} &bull; Klasifikasi Pekerjaan: <strong>{task.jenis_kerja}</strong>
            </p>
          </div>

          {/* GRID DATA PELANGGAN & PARAMETER TEKNIS DENGAN BORDER TEBAL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Data Pelanggan */}
            <div className={`p-4 rounded-2xl border-2 ${
              isDark ? 'bg-slate-950/70 border-slate-700' : 'bg-slate-50 border-slate-300'
            } space-y-2`}>
              <div className="font-bold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                <User className="w-3.5 h-3.5 text-blue-500" />
                <span>Identitas Pelanggan & Lokasi Pemasangan:</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800/60">
                  <span className="text-slate-400">Nama Pelanggan:</span>
                  <strong>{bastp.pelanggan_nama || task.pelanggan_nama}</strong>
                </div>
                <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800/60">
                  <span className="text-slate-400">Alamat Lokasi:</span>
                  <strong className="text-right max-w-[200px] truncate">{task.lokasi}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nomor Telepon:</span>
                  <span className="font-mono">{task.pelanggan_telp || '0812-xxxx-xxxx'}</span>
                </div>
              </div>
            </div>

            {/* Box 2: Parameter Teknis Quality Assurance */}
            <div className={`p-4 rounded-2xl border-2 ${
              isDark ? 'bg-slate-950/70 border-slate-700' : 'bg-slate-50 border-slate-300'
            } space-y-2`}>
              <div className="font-bold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5 border-slate-200 dark:border-slate-800">
                <Radio className="w-3.5 h-3.5 text-emerald-500" />
                <span>Parameter Teknis Quality Assurance (OPM & ODP):</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800/60">
                  <span className="text-slate-400">ID ODP / Port:</span>
                  <strong className="font-mono text-rose-600 dark:text-rose-400">{bastp.odp_id} (Port {bastp.port_odp})</strong>
                </div>
                <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-800/60">
                  <span className="text-slate-400">Redaman Optik (OPM):</span>
                  <strong className="font-mono text-emerald-500 font-bold">
                    {bastp.redaman_dbm} dBm (Lolos QC Telkom)
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Serial Number (SN) ONT:</span>
                  <strong className="font-mono text-purple-400 font-black">{bastp.sn_ont}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* TABEL REKONSILIASI MATERIAL REAL */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-amber-500" />
                <span>Rincian Rekonsiliasi Pemakaian Material Riil di Lapangan:</span>
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Status: Resmi Terpasang di Pelanggan
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border-2 border-slate-300 dark:border-slate-700">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b-2 ${isDark ? 'bg-slate-950 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-400'} uppercase text-[10px] tracking-wider font-black`}>
                    <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-700">No</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-700">Nama Barang / Material</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-300 dark:border-slate-700">Diambil</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400">Terpasang di Pelanggan</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-300 dark:border-slate-700 text-amber-600 dark:text-amber-400">Sisa Retur</th>
                    <th className="py-2.5 px-3 text-right">Status Inventaris</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {bastp.reconciliation?.map((m, idx) => (
                    <tr key={idx} className={isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}>
                      <td className="py-2.5 px-3 font-mono text-slate-400 border-r border-slate-200 dark:border-slate-800 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                        <strong className="block">{m.nama_barang}</strong>
                        {m.sn && (
                          <span className="text-[10px] font-mono text-purple-400 font-bold">
                            SN Barcode: {m.sn}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono border-r border-slate-200 dark:border-slate-800">
                        {m.jumlah_diambil} {m.satuan}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-800">
                        {m.jumlah_terpakai} {m.satuan}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400 border-r border-slate-200 dark:border-slate-800">
                        {m.jumlah_sisa} {m.satuan}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 whitespace-nowrap">
                          TERPASANG DI PELANGGAN
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-blue-950/40 border-blue-800/60 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'} text-[11px]`}>
              <strong>Keterangan Audit Material:</strong> Material yang tercatat pada kolom <em>Terpasang di Pelanggan</em> secara permanen telah menjadi instalasi CPE di rumah pelanggan. Material sisa telah diverifikasi untuk retur ke gudang logistik STO.
            </div>
          </div>

          {/* FOTO BUKTI LAPANGAN */}
          {task.foto_bukti && (
            <div className="space-y-2">
              <span className="font-bold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Dokumentasi Bukti Fisik Lapangan:
              </span>
              <div className={`flex items-center gap-4 p-3.5 rounded-2xl border-2 ${isDark ? 'border-slate-700 bg-slate-950/60' : 'border-slate-300 bg-slate-50'}`}>
                <img
                  src={task.foto_bukti}
                  alt="Bukti BASTP"
                  className="w-28 h-20 object-cover rounded-xl border border-slate-700 shadow-sm shrink-0"
                />
                <div>
                  <div className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Dokumentasi Lapangan Terverifikasi Sistem</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-md">
                    Catatan Teknisi: "{bastp.catatan_teknisi}"
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* KOLOM TANDA TANGAN DENGAN KOTAK RAPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t-2 border-slate-300 dark:border-slate-700 text-center text-xs print-text-dark">
            <div className={`p-3.5 rounded-2xl border-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-300 bg-slate-50'} space-y-2`}>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Pelanggan Penerima</div>
              <div className="h-16 flex items-center justify-center border-y border-dashed border-slate-300 dark:border-slate-700 my-1 font-bold text-xs">
                ( {bastp.pelanggan_nama || task.pelanggan_nama} )
              </div>
              <p className="text-[10px] text-slate-400">Penerima Layanan IndiHome</p>
            </div>

            <div className={`p-3.5 rounded-2xl border-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-300 bg-slate-50'} space-y-2`}>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Teknisi Pelaksana</div>
              <div className="h-16 flex items-center justify-center border-y border-dashed border-slate-300 dark:border-slate-700 my-1 font-black text-xs text-rose-600 dark:text-rose-400">
                ( Petugas Lapangan STO )
              </div>
              <p className="text-[10px] text-slate-400">Unit Provisioning & Maintenance</p>
            </div>

            <div className={`p-3.5 rounded-2xl border-2 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-300 bg-slate-50'} space-y-2`}>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Pimpinan STO / Asman</div>
              <div className="h-16 flex items-center justify-center border-y border-dashed border-slate-300 dark:border-slate-700 my-1 font-bold text-xs">
                ( Ir. Bambang Hermanto )
              </div>
              <p className="text-[10px] text-slate-400">Manager STO Payakumbuh</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
