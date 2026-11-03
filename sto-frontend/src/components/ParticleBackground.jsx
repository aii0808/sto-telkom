import React, { useEffect, useRef, useState } from 'react';
import { Palette, Check } from 'lucide-react';

export const PARTICLE_THEMES = {
  burgundy: {
    id: 'burgundy',
    label: 'Merah Burgundy',
    dotColor: '#be123c',
    lineColor: 'rgba(190, 18, 60, ',
    glow: 'rgba(190, 18, 60, 0.4)',
    accentBg: 'bg-rose-900/40 border-rose-500/50 text-rose-300'
  },
  navy: {
    id: 'navy',
    label: 'Biru Dongker',
    dotColor: '#38bdf8',
    lineColor: 'rgba(56, 189, 248, ',
    glow: 'rgba(56, 189, 248, 0.4)',
    accentBg: 'bg-blue-900/40 border-blue-500/50 text-blue-300'
  },
  emerald: {
    id: 'emerald',
    label: 'Cyber Emerald',
    dotColor: '#10b981',
    lineColor: 'rgba(16, 185, 129, ',
    glow: 'rgba(16, 185, 129, 0.4)',
    accentBg: 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300'
  },
  amber: {
    id: 'amber',
    label: 'Amber Gold',
    dotColor: '#f59e0b',
    lineColor: 'rgba(245, 158, 11, ',
    glow: 'rgba(245, 158, 11, 0.4)',
    accentBg: 'bg-amber-900/40 border-amber-500/50 text-amber-300'
  },
  white: {
    id: 'white',
    label: 'Kristal Putih',
    dotColor: '#f8fafc',
    lineColor: 'rgba(248, 250, 252, ',
    glow: 'rgba(255, 255, 255, 0.4)',
    accentBg: 'bg-slate-700/40 border-slate-400/50 text-slate-200'
  }
};

export default function ParticleBackground({ activeColor = 'burgundy', onColorChange, showSelector = true }) {
  const canvasRef = useRef(null);
  const [selectedColor, setSelectedColor] = useState(activeColor);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setSelectedColor(activeColor);
  }, [activeColor]);

  const handleSelectColor = (key) => {
    setSelectedColor(key);
    setDropdownOpen(false);
    if (onColorChange) onColorChange(key);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle nodes setup
    const particleCount = Math.min(width > 768 ? 36 : 20, 50);
    const particles = [];
    const colorConfig = PARTICLE_THEMES[selectedColor] || PARTICLE_THEMES.burgundy;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        radius: Math.random() * 2 + 1.5,
        alpha: Math.random() * 0.5 + 0.3
      });
    }

    let mouse = { x: null, y: null, radius: 140 };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw particle connections & movement
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        // Bounce on edges
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Draw particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = colorConfig.dotColor;
        ctx.fill();

        // Connect particles within distance
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const lineAlpha = (1 - dist / 130) * 0.35;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `${colorConfig.lineColor}${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // Mouse connection effect
        if (mouse.x !== null && mouse.y !== null) {
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < mouse.radius) {
            const mLineAlpha = (1 - mdist / mouse.radius) * 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `${colorConfig.lineColor}${mLineAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [selectedColor]);

  const activeTheme = PARTICLE_THEMES[selectedColor] || PARTICLE_THEMES.burgundy;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Compact Floating Color Switcher Dropdown */}
      {showSelector && (
        <div className="absolute top-4 right-4 z-20 pointer-events-auto">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 backdrop-blur-xl shadow-xl transition-all active:scale-95 text-xs text-slate-200 cursor-pointer"
              title="Pilih Warna Partikel"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/60 shadow-sm flex-shrink-0"
                style={{ backgroundColor: activeTheme.dotColor }}
              />
              <Palette className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline font-medium text-[11px]">{activeTheme.label}</span>
            </button>

            {dropdownOpen && (
              <>
                {/* Backdrop to close */}
                <div
                  className="fixed inset-0 z-30 pointer-events-auto"
                  onClick={() => setDropdownOpen(false)}
                />

                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-44 z-40 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1">
                    Tema Partikel
                  </div>
                  {Object.keys(PARTICLE_THEMES).map((key) => {
                    const item = PARTICLE_THEMES[key];
                    const isSelected = selectedColor === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSelectColor(key)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-burgundy-600/30 text-white font-semibold border border-burgundy-500/40'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-white/40 flex-shrink-0"
                            style={{ backgroundColor: item.dotColor }}
                          />
                          <span className="text-[11px]">{item.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-burgundy-400" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
