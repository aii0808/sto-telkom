/**
 * ============================================================================
 * KOMPONEN: BrandLogo (Logo Resmi Aplikasi Telkom Akses STO Payakumbuh)
 * ============================================================================
 * Menggunakan aset resmi logoTelkom.png dari /assets/logoTelkom.png.
 * Tampilan dirancang bersih, proporsional, tajam, dan tidak berantakan.
 * Dilengkapi fitur navigasi: Klik logo akan mengarahkan pengguna langsung
 * ke halaman Dashboard utama sesuai role (Pimpinan, Teknisi, atau Gudang).
 * ============================================================================
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import defaultTelkomLogo from '../assets/logoTelkom.png';

export default function BrandLogo({
  logoUrl = defaultTelkomLogo,
  size = 'md',
  collapsed = false,
  clickable = true,
  onClick,
  className = ''
}) {
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useApp() || {};

  // Pengaturan ukuran badge icon dan typography
  const sizeConfig = {
    sm: {
      box: 'w-9 h-9 rounded-xl p-1',
      title: 'text-xs font-black',
      sub: 'text-[9px] font-bold',
      gap: 'gap-2.5'
    },
    md: {
      box: 'w-11 h-11 rounded-2xl p-1.5',
      title: 'text-sm font-black',
      sub: 'text-[10px] font-bold',
      gap: 'gap-3'
    },
    lg: {
      box: 'w-14 h-14 rounded-2xl p-2',
      title: 'text-lg font-black',
      sub: 'text-xs font-bold',
      gap: 'gap-3.5'
    },
    xl: {
      box: 'w-20 h-20 rounded-3xl p-2.5',
      title: 'text-2xl font-black',
      sub: 'text-sm font-bold',
      gap: 'gap-4'
    }
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  // Navigasi cerdas ke Dashboard berdasarkan sesi pengguna
  const handleLogoClick = (e) => {
    if (onClick) {
      onClick(e);
      return;
    }

    if (!clickable) return;

    try {
      const rawUser = localStorage.getItem('user');
      const user = currentUser || (rawUser ? JSON.parse(rawUser) : null);
      const role = user?.role;

      if (role === 'teknisi') {
        try { localStorage.setItem('sto_active_tab_teknisi', 'tiket'); } catch {}
        window.dispatchEvent(new CustomEvent('sto:reset-dashboard-tab', { detail: { role: 'teknisi', tab: 'tiket' } }));
        navigate('/dashboard-teknisi');
      } else if (role === 'gudang') {
        try { localStorage.setItem('sto_active_tab_gudang', 'daftar-barang'); } catch {}
        window.dispatchEvent(new CustomEvent('sto:reset-dashboard-tab', { detail: { role: 'gudang', tab: 'daftar-barang' } }));
        navigate('/dashboard-gudang');
      } else if (role === 'pimpinan' || role === 'admin') {
        try { localStorage.setItem('sto_active_tab_pimpinan', 'dashboard'); } catch {}
        window.dispatchEvent(new CustomEvent('sto:reset-dashboard-tab', { detail: { role: 'pimpinan', tab: 'dashboard' } }));
        navigate('/dashboard-pimpinan');
      } else {
        navigate('/login');
      }
    } catch {
      navigate('/');
    }
  };

  return (
    <div
      onClick={handleLogoClick}
      title={clickable ? 'Kembali ke Dashboard Utama STO' : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleLogoClick(e);
        }
      }}
      className={`flex items-center ${currentSize.gap} select-none transition-all duration-200 ${
        clickable ? 'cursor-pointer group hover:opacity-95' : ''
      } ${className}`}
    >
      {/* Wadah Ikon Logo Telkom Akses */}
      <div className={`relative flex-shrink-0 flex items-center justify-center ${
        clickable ? 'group-hover:scale-105 group-active:scale-95 transition-transform duration-200' : ''
      }`}>
        {/* Soft Ambient Glow di belakang logo */}
        <div className="absolute inset-0 bg-rose-600/25 rounded-2xl blur-md pointer-events-none" />

        {/* Kotak Putih Rapi / Badge untuk Logo Resmi */}
        <div
          className={`relative ${currentSize.box} bg-white shadow-sm ring-1 ring-slate-200/90 dark:ring-slate-700/80 flex items-center justify-center overflow-hidden`}
        >
          {logoUrl && !imageError ? (
            <img
              src={logoUrl}
              alt="Logo Telkom Akses STO Payakumbuh"
              className="w-full h-full object-contain filter drop-shadow-sm pointer-events-none select-none"
              onError={() => setImageError(true)}
            />
          ) : (
            /* Fallback Vektor SVG Telkom Akses jika gambar gagal dimuat */
            <svg
              viewBox="0 0 40 40"
              className="w-full h-full drop-shadow-sm"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="taGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f43f5e" />
                  <stop offset="50%" stopColor="#e11d48" />
                  <stop offset="100%" stopColor="#be123c" />
                </linearGradient>
              </defs>
              <circle cx="20" cy="20" r="16" fill="url(#taGrad)" />
              <circle cx="20" cy="20" r="11" fill="#ffffff" />
              <path d="M15 15L25 15L25 19L22 19L22 26L18 26L18 19L15 19Z" fill="#e11d48" />
            </svg>
          )}
        </div>
      </div>

      {/* Teks Identitas Perusahaan Telkom Akses (Sembunyi jika sidebar collapsed) */}
      {!collapsed && (
        <div className="flex flex-col leading-tight min-w-0">
          <div
            className={`tracking-tight ${currentSize.title} text-slate-900 dark:text-white flex items-center gap-1.5 truncate`}
          >
            <span className="font-extrabold tracking-tight">TELKOM</span>
            <span className="text-rose-600 dark:text-rose-500 font-black">AKSES</span>
          </div>
          <div
            className={`tracking-wider uppercase text-slate-500 dark:text-slate-400 ${currentSize.sub} truncate flex items-center gap-1.5 mt-0.5`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="truncate">STO PAYAKUMBUH</span>
          </div>
        </div>
      )}
    </div>
  );
}
