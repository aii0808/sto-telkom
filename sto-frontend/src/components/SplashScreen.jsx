import React, { useEffect, useState } from 'react';
import { Activity, Radio, ArrowRight } from 'lucide-react';

import BrandLogo from './BrandLogo';

export default function SplashScreen({ onFinish, duration = 1800 }) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(interval);
        setIsFadingOut(true);
        setTimeout(() => {
          if (onFinish) onFinish();
        }, 350);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [duration, onFinish]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 200);
  };

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 text-white transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Skip Button on top right */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
      >
        <span>Lewati</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>

      {/* Center Animated Logo Emblem */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Pulsing Concentric Rings */}
        <div className="absolute w-44 h-44 rounded-full border-2 border-rose-500/30 animate-ping opacity-60 pointer-events-none" />
        <div className="absolute w-36 h-36 rounded-full border border-blue-500/40 animate-pulse pointer-events-none" />

        {/* High-Tech Corporate Logo */}
        <BrandLogo size="xl" className="transform scale-125" />
      </div>

      {/* Text Branding */}
      <div className="text-center px-4 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-[11px] font-bold text-rose-300 uppercase tracking-widest mb-2">
          <Radio className="w-3.5 h-3.5 animate-pulse text-rose-400" />
          <span>Sistem Komando Operasional Lapangan</span>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Integrasi WebGIS Real-Time, Penugasan Lapangan, dan Logistik Material
        </p>
      </div>

      {/* Progress Bar & Status Counter */}
      <div className="w-64 max-w-xs space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-rose-400 animate-spin" />
            <span>Memuat Sistem...</span>
          </span>
          <span className="text-rose-400 font-bold">{progress}%</span>
        </div>

        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-[1px]">
          <div
            className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-400 rounded-full transition-all duration-75 shadow-sm shadow-rose-500/50"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer copyright */}
      <div className="absolute bottom-6 text-[10px] text-slate-400 font-mono">
        © 2026 PT Telkom Akses — Sentral Telepon Otomatis Payakumbuh
      </div>
    </div>
  );
}
