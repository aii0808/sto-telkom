/**
 * ============================================================================
 * STATE MANAGEMENT & DATA SYNC (sto-frontend/src/context/AppContext.jsx)
 * ============================================================================
 * Standar Operasional Prosedur (Alur Kerja Lengkap 6 SOP Telkom Akses STO):
 * 
 * 1. SOP 1 (Pimpinan):
 *    Pimpinan membuat tiket penugasan (Pasang Baru IndiHome / Perbaikan Gangguan).
 *    Tiket disiarkan secara terbuka (Broadcast Open Pool) ke seluruh teknisi lapangan.
 * 
 * 2. SOP 1.5 (Teknisi):
 *    Teknisi melihat daftar siaran terbuka dan mengambil (Klaim) tiket pekerjaan.
 * 
 * 3. SOP 2 (Teknisi):
 *    Teknisi mengajukan permohonan material ke gudang (Dropcore, ONT Modem, Roset, dll).
 * 
 * 4. SOP 3 (Pimpinan):
 *    Pimpinan meninjau dan memberikan persetujuan (Approval) terhadap permohonan barang.
 * 
 * 5. SOP 4 (Gudang):
 *    Petugas gudang merilis barang fisik ke teknisi. Stok gudang otomatis terpotong
 *    dan tersinkronisasi ke database Supabase Cloud.
 * 
 * 6. SOP 5 (Teknisi & WebGIS):
 *    Teknisi bergerak menuju lokasi pelanggan di Payakumbuh. Sensor GPS menyiarkan
 *    koordinat realtime ke peta WebGIS yang dipantau Pimpinan di Command Center.
 * 
 * 7. SOP 6 (Closing Pekerjaan & Rekonsiliasi Material):
 *    Teknisi menyelesaikan instalasi: mengukur redaman optik (OPM dBm), menginput
 *    Serial Number (SN Barcode ONT), dan merekonsiliasi pemakaian material.
 *    Material resmi berstatus "TERPASANG DI PELANGGAN (CONSUMED)", sisa kabel diretur,
 *    dan Dokumen Digital BASTP resmi diterbitkan.
 * ============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import supabase, { isSupabaseConfigured } from '../api/supabaseClient';
import api from '../api/axiosInstance';
import { playNotificationChime } from '../utils/soundHelper';
import { parseTaskDetails } from '../utils/taskFormatter';
import {
  sendTelegramAlert,
  escTelegramHtml,
  truncateTelegramMessage,
  formatTelegramPhoneLinks,
  formatTelegramMapsUrl,
  TELEGRAM_SEPARATOR
} from '../utils/telegramHelper';
import {
  initialUsers,
  initialBarang,
  initialTugas,
  initialPermohonan,
  initialDetailPermohonan,
  initialOdp,
  initialPelanggan,
  STO_COORDINATES
} from '../data/seedData';

const AppContext = createContext();

export function AppProvider({ children }) {
  const stoChannelRef = useRef(null);

  // Helper pengiriman sinyal broadcast peer-to-peer WebSocket via Supabase Realtime
  const broadcastLiveSignal = useCallback((event, payload) => {
    try {
      playNotificationChime();
      if (stoChannelRef.current) {
        stoChannelRef.current.send({
          type: 'broadcast',
          event,
          payload
        });
      }
    } catch (err) {
      console.warn('[Realtime Broadcast] Gagal broadcast sinyal:', err);
    }
  }, []);
  // 1. Connectivity & Sync Status
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState('syncing'); // 'synced' | 'local' | 'syncing' | 'offline'
  const [lastSyncedAt, setLastSyncedAt] = useState(() => localStorage.getItem('sto_lastSyncedAt') || null);

  // 2. Current Active User (Session)
  // Membaca sesi aktif dari sessionStorage agar saat halaman di-refresh (F5) tetap login di halaman aktif
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('sto_active_user');
      if (saved && saved !== 'null' && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.role) {
          return parsed;
        }
      }
    } catch { /* ignore */ }
    return null; // Link dibuka pertama kali lewat share/tab baru wajib login
  });

  // 3. Database Tables
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('sto_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = initialUsers.map(initU => {
            const found = parsed.find(p => p.role === initU.role || p.email === initU.email || Number(p.id) === Number(initU.id));
            return found ? { ...initU, ...found, email: initU.email, password: initU.password, nama_lengkap: initU.nama_lengkap } : initU;
          });
          parsed.forEach(p => {
            if (!merged.some(m => m.email === p.email || Number(m.id) === Number(p.id))) {
              merged.push(p);
            }
          });
          return merged;
        }
      } catch {}
    }
    return initialUsers;
  });

  const [barang, setBarang] = useState(() => {
    const saved = localStorage.getItem('sto_barang');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return isSupabaseConfigured() ? [] : initialBarang;
  });

  const [tugas, setTugas] = useState(() => {
    // Jika Supabase terhubung, inisialisasi awal ke array kosong agar realtime dari Supabase dan tidak memunculkan data tiket yang telah dihapus
    if (isSupabaseConfigured()) {
      return [];
    }
    const saved = localStorage.getItem('sto_tugas');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return initialTugas;
  });

  const [permohonan, setPermohonan] = useState(() => {
    const saved = localStorage.getItem('sto_permohonan');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return isSupabaseConfigured() ? [] : initialPermohonan;
  });

  const [detailPermohonan, setDetailPermohonan] = useState(() => {
    const saved = localStorage.getItem('sto_detailPermohonan');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return isSupabaseConfigured() ? [] : initialDetailPermohonan;
  });

  // Database Nomor Seri ONT (Audit Lifecycle Realtime)
  const [ontSerials, setOntSerials] = useState(() => {
    try {
      const stored = localStorage.getItem('sto_ont_serials');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // GPS Tracking dinonaktifkan sesuai kebutuhan produksi
  const trackingGps = [];
  const setTrackingGps = () => {};
  const initialTrackingGps = [];

  const [odp, setOdp] = useState(() => {
    const saved = localStorage.getItem('sto_odp');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return isSupabaseConfigured() ? [] : initialOdp;
  });

  // Master Data Pelanggan & Audit Kontrak Aset STO Telkom Payakumbuh
  const [pelanggan, setPelanggan] = useState(() => {
    try {
      const saved = localStorage.getItem('sto_pelanggan');
      return saved ? JSON.parse(saved) : initialPelanggan;
    } catch {
      return initialPelanggan;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sto_pelanggan', JSON.stringify(pelanggan));
    } catch {}
  }, [pelanggan]);

  // Saldo Sisa Material Teknisi (Mobile Stock di Kendaraan Teknisi - Realtime Otomatis Dari Sisa Pemasangan)
  const [saldoTeknisi, setSaldoTeknisi] = useState(() => {
    try {
      const saved = localStorage.getItem('sto_saldo_teknisi');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Sanitasi: jika masih menyimpan sisa dummy lama (85m), reset ke 0 agar data murni otomatis
        if (parsed && (parsed.kabel_m === 85 || parsed.dummy)) {
          return { kabel_m: 0, roset: 0, fast_connector: 0, klem_segitiga: 0 };
        }
        return {
          kabel_m: Number(parsed.kabel_m) || 0,
          roset: Number(parsed.roset) || 0,
          fast_connector: Number(parsed.fast_connector) || 0,
          klem_segitiga: Number(parsed.klem_segitiga) || 0
        };
      }
      return { kabel_m: 0, roset: 0, fast_connector: 0, klem_segitiga: 0 };
    } catch {
      return { kabel_m: 0, roset: 0, fast_connector: 0, klem_segitiga: 0 };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sto_saldo_teknisi', JSON.stringify(saldoTeknisi));
    } catch {}
  }, [saldoTeknisi]);

  // Kode Otorisasi Korporat Registrasi Pegawai STO Payakumbuh
  const STO_CORPORATE_TOKEN = 'STO-PYK-2026';

  // State persistensi ciutkan/lebarkan sidebar (tersimpan permanen di LocalStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sto_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sto_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Current active navigation view
  // 'landing' | 'login' | 'pimpinan' | 'teknisi' | 'gudang' | 'audit'
  const [currentView, setCurrentView] = useState('pimpinan');
  const [notification, setNotification] = useState(null);

  // Show Toast / Notification
  const showToast = useCallback((message, type = 'success') => {
    setNotification({ message, type, id: Date.now() });
    if (type !== 'error') {
      playNotificationChime();
    }
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  }, []);

  // Sync Session ke sessionStorage & LocalStorage
  useEffect(() => {
    try {
      if (currentUser) {
        sessionStorage.setItem('sto_active_user', JSON.stringify(currentUser));
        localStorage.setItem('sto_currentUser', JSON.stringify(currentUser));
        localStorage.setItem('user', JSON.stringify(currentUser));
      } else {
        sessionStorage.removeItem('sto_active_user');
        localStorage.removeItem('sto_currentUser');
        localStorage.removeItem('user');
      }
    } catch {}
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('sto_users', JSON.stringify(users));
    } catch {}
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem('sto_barang', JSON.stringify(barang));
    } catch {}
  }, [barang]);

  useEffect(() => {
    try {
      // Sanitasi foto base64 raksasa agar tidak memicu DOMException QuotaExceededError
      const sanitized = tugas.map(t => ({
        ...t,
        foto_bukti: t.foto_bukti && t.foto_bukti.length > 256 ? '[FOTO_TERSIMPAN]' : t.foto_bukti
      }));
      localStorage.setItem('sto_tugas', JSON.stringify(sanitized));
    } catch (err) {
      console.warn('LocalStorage quota notice:', err);
    }
  }, [tugas]);

  useEffect(() => {
    try {
      localStorage.setItem('sto_permohonan', JSON.stringify(permohonan));
    } catch {}
  }, [permohonan]);

  useEffect(() => {
    try {
      localStorage.setItem('sto_detailPermohonan', JSON.stringify(detailPermohonan));
    } catch {}
  }, [detailPermohonan]);

  useEffect(() => {
    try {
      localStorage.removeItem('sto_trackingGps');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sto_odp', JSON.stringify(odp));
    } catch {}
  }, [odp]);

  // Robust Fetch & Sync from Supabase with Local Fallback
  const fetchRealData = useCallback(async (isSilent = false) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    if (!isSupabaseConfigured()) {
      setSyncStatus('local');
      return;
    }

    if (!isSilent) setSyncStatus('syncing');

    try {
      const [
        resUsers,
        resBarang,
        resTugas,
        resPermohonan,
        resDetail,
        resPelanggan] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('barang').select('*').order('nama_barang', { ascending: true }),
        supabase.from('tugas').select('*').order('id', { ascending: false }),
        supabase.from('permohonan').select('*').order('id', { ascending: false }),
        supabase.from('detail_permohonan').select('*'),
        supabase.from('pelanggan').select('*').order('id', { ascending: false }).then(r => r, () => ({ data: [] }))
      ]);

      if (Array.isArray(resUsers.data) && resUsers.data.length > 0) {
        setUsers((prev) => {
          const merged = [...resUsers.data];
          (prev || []).forEach(p => {
            if (!merged.some(m => m.email?.toLowerCase().trim() === p.email?.toLowerCase().trim())) {
              merged.push(p);
            }
          });
          return merged;
        });
      }

      if (Array.isArray(resBarang.data)) {
        // Otomatis gabungkan/deduplikasi jika ada data historis yang double di database gudang
        const deduplicatedMap = new Map();
        resBarang.data.forEach(item => {
          const key = String(item.nama_barang || '').trim().toLowerCase();
          if (!deduplicatedMap.has(key)) {
            deduplicatedMap.set(key, { ...item, stok: Number(item.stok) || 0 });
          } else {
            const existing = deduplicatedMap.get(key);
            existing.stok += (Number(item.stok) || 0);
          }
        });
        const cleanBarang = Array.from(deduplicatedMap.values());

        setBarang((prev) => {
          if (prev && prev.length === cleanBarang.length) {
            const isSame = prev.every((oldB, i) => {
              const newB = cleanBarang[i];
              return Number(oldB.id) === Number(newB.id) && Number(oldB.stok) === Number(newB.stok);
            });
            if (isSame) return prev;
          }
          return cleanBarang;
        });
        if (cleanBarang.length === 0) {
          try {
            localStorage.setItem('sto_barang', '[]');
          } catch {}
        }
      }

      // Sinkronisasi data tugas: Supabase Cloud adalah Single Source of Truth
      if (Array.isArray(resTugas.data)) {
        if (resTugas.data.length === 0) {
          // Database kosong: bersihkan state & localStorage agar tidak menampilkan tiket hantu / mock statis
          setTugas([]);
          try {
            localStorage.setItem('sto_tugas', '[]');
          } catch {}
        } else {
          let checkinMap = {};
          let doneList = [];
          try {
            checkinMap = JSON.parse(localStorage.getItem('sto_checkin_tasks') || '{}');
            doneList = JSON.parse(localStorage.getItem('sto_done_tasks') || '[]');
          } catch {}

          const mappedFetched = resTugas.data.map((t, idx) => {
            const rawStatus = String(t.status || '').toLowerCase().trim();
            const isExplicitDbDone = rawStatus === 'done' || rawStatus === 'closed' || rawStatus === 'selesai';
            // Lifecycle status aktif dari database tidak boleh tertimpa oleh local doneList
            const isExplicitDbActive = [
              'progress',
              'in_progress',
              'assigned',
              'menunggu_material',
              'material_approved',
              'pengerjaan',
              'bastp_ready',
              'menunggu',
              'open',
              'pending',
              'proses'
            ].includes(rawStatus);

            const isTaskDone = isExplicitDbDone || (!isExplicitDbActive && doneList.includes(Number(t.id)));

            const offsetLat = (((Number(t.id || idx) * 7) % 30) - 15) * 0.0012;
            const offsetLng = (((Number(t.id || idx) * 11) % 30) - 15) * 0.0012;

            return {
              ...t,
              status: isTaskDone ? 'Done' : (t.status || 'menunggu'),
              target_lat: t.target_lat || (STO_COORDINATES.lat + offsetLat),
              target_lng: t.target_lng || (STO_COORDINATES.lng + offsetLng),
              pelanggan_nama: t.pelanggan_nama || (t.lokasi ? t.lokasi.split('-')[0].trim() : `Pelanggan #${t.id}`),
              keterangan: t.keterangan || `Pekerjaan ${t.jenis_kerja} di ${t.lokasi}`,
              checkin: checkinMap[Number(t.id)] || (isTaskDone ? { verified: true } : null),
              foto_bukti: t.foto_bukti || null,
              bastp: null,
              sn_ont: t.sn_ont || null,
              material_status: t.material_status || null
            };
          });

          // Optimasi Memori: Cek apakah data tugas berubah sebelum mengganti referensi state
          setTugas((prev) => {
            if (prev && prev.length === mappedFetched.length) {
              const isSame = prev.every((oldT, i) => {
                const newT = mappedFetched[i];
                return (
                  Number(oldT.id) === Number(newT.id) &&
                  oldT.status === newT.status &&
                  oldT.material_status === newT.material_status &&
                  oldT.teknisi_id === newT.teknisi_id &&
                  oldT.sn_ont === newT.sn_ont &&
                  Boolean(oldT.checkin) === Boolean(newT.checkin)
                );
              });
              if (isSame) return prev; // Pertahankan referensi lama untuk cegah re-render massal
            }
            return mappedFetched;
          });
        }
      }

      // Sinkronisasi permohonan material
      if (Array.isArray(resPermohonan.data)) {
        setPermohonan((prev) => {
          if (prev && prev.length === resPermohonan.data.length) {
            const isSame = prev.every((oldP, i) => {
              const newP = resPermohonan.data[i];
              return Number(oldP.id) === Number(newP.id) && oldP.status === newP.status;
            });
            if (isSame) return prev;
          }
          return resPermohonan.data;
        });
        if (resPermohonan.data.length === 0) {
          try {
            localStorage.setItem('sto_permohonan', '[]');
          } catch {}
        }
      }

      // Sinkronisasi detail permohonan
      if (Array.isArray(resDetail.data)) {
        setDetailPermohonan(resDetail.data);
        if (resDetail.data.length === 0) {
          try {
            localStorage.setItem('sto_detailPermohonan', '[]');
          } catch {}
        }
      }
      // GPS data query removed

      // 7. Ambil data titik ODP Jaringan Fiber Optic
      try {
        const { data: resOdpData, error: odpErr } = await supabase.from('odp').select('*').order('id', { ascending: true });
        if (!odpErr && Array.isArray(resOdpData)) {
          const mapped = resOdpData.map(o => ({
            ...o,
            alamat: o.alamat || o.nama_lokasi || 'Koto Nan IV Payakumbuh',
            nama_lokasi: o.alamat || o.nama_lokasi || 'Koto Nan IV Payakumbuh'
          }));
          setOdp(mapped);
          if (mapped.length === 0) {
            try {
              localStorage.setItem('sto_odp', '[]');
            } catch {}
          }
        } else {
          // Coba dari backend Express API
          const apiOdp = await api.get('/odp');
          if (apiOdp.data?.data && Array.isArray(apiOdp.data.data)) {
            setOdp(apiOdp.data.data);
          }
        }
      } catch {
        // Tetap gunakan state lokal odp
      }

      // 8. Sinkronisasi Data Pelanggan (Sintesis Realtime dari Supabase, Tugas Selesai PSB, Audit Asset, & Cache)
      try {
        let dbPelanggan = [];
        try {
          if (Array.isArray(resPelanggan?.data) && resPelanggan.data.length > 0) {
            dbPelanggan = resPelanggan.data;
          } else {
            const localStoredCust = JSON.parse(localStorage.getItem('sto_pelanggan') || '[]');
            if (Array.isArray(localStoredCust) && localStoredCust.length > 0) {
              dbPelanggan = localStoredCust;
            }
          }
        } catch {}

        setPelanggan(prev => {
          const custMap = new Map();

          // a. Masukkan seed data awal (target penarikan aset / debt collector seperti Ibu Siti Aminah dll)
          initialPelanggan.forEach(p => {
            custMap.set(String(p.nama || '').trim().toLowerCase(), { ...p });
          });

          // b. Masukkan data pelanggan dari database Supabase jika ada
          dbPelanggan.forEach(p => {
            custMap.set(String(p.nama || '').trim().toLowerCase(), { ...p });
          });

          // c. Sintesis pelanggan secara real-time dari seluruh tugas di database Supabase
          if (Array.isArray(resTugas.data)) {
            resTugas.data.forEach(t => {
              const cust = parseTaskDetails(t);
              if (cust.name && cust.name !== 'Pelanggan STO' && cust.name !== 'Pelanggan Telkom') {
                const key = cust.name.trim().toLowerCase();
                const isDone = String(t.status || '').toLowerCase() === 'done';
                const existing = custMap.get(key);

                if (!existing) {
                  custMap.set(key, {
                    id: t.id,
                    id_pelanggan: `112233${String(t.id).padStart(6, '0')}`,
                    nama: cust.name,
                    no_telp: cust.telp || '0812-3456-7890',
                    alamat: cust.address || t.lokasi || 'Payakumbuh',
                    patokan: cust.note || 'Instalasi pelanggan Telkom Akses',
                    latitude: t.target_lat || -0.22858,
                    longitude: t.target_lng || 100.62448,
                    odp_id: t.odp_id || 'ODP-PYK-FA/001',
                    port_odp: t.port_odp || '01',
                    paket: String(t.jenis_kerja || '').includes('Pasang') ? 'IndiHome Fiber 50 Mbps' : 'IndiHome 30 Mbps',
                    sn_ont: t.sn_ont || (isDone ? `ZTEGC8B90${String(t.id).padStart(3, '0')}` : '-'),
                    model_ont: 'Modem ONT ZTE F670L Dual Band',
                    sn_stb: '-',
                    tanggal_pasang: t.waktu_selesai || t.waktu_buat || '2026-11-20',
                    status_langganan: isDone ? 'Lancar' : 'Calon Pelanggan (Menunggu Pemasangan)',
                    total_tunggakan: 'Rp 0 (Lunas)',
                    foto_rumah: t.foto_bukti || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&auto=format&fit=crop&q=80',
                    catatan_kolektor: isDone ? 'Instalasi selesai & aktif normal.' : 'Dalam proses penugasan teknisi.'
                  });
                } else if (isDone && existing.status_langganan?.includes('Calon')) {
                  existing.status_langganan = 'Lancar';
                  if (t.sn_ont) existing.sn_ont = t.sn_ont;
                  if (t.foto_bukti) existing.foto_rumah = t.foto_bukti;
                  if (t.waktu_selesai) existing.tanggal_pasang = t.waktu_selesai;
                }
              }
            });
          }

          // d. Pertahankan state local storage jika ada
          (prev || []).forEach(p => {
            const key = String(p.nama || '').trim().toLowerCase();
            if (key && !custMap.has(key)) {
              custMap.set(key, p);
            }
          });

          return Array.from(custMap.values());
        });
      } catch (custSyncErr) {
        console.warn('[Sync Pelanggan Notice]:', custSyncErr);
      }

      const timestamp = new Date().toISOString();
      setLastSyncedAt(timestamp);
      localStorage.setItem('sto_lastSyncedAt', timestamp);
      setSyncStatus('synced');
    } catch (err) {
      console.warn('[Sync Fallback] Gagal memuat data dari Supabase, beralih ke cache lokal:', err);
      setSyncStatus('local');
    }
  }, []);

  // Network Online / Offline Detection & Automatic Re-sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchRealData();
      showToast('Koneksi pulih. Data disinkronisasi ulang.', 'info');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
      showToast('Koneksi terputus. Mode cache lokal aktif.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchRealData, showToast]);

  // Initial Fetch & Supabase Real-Time Listener
  useEffect(() => {
    fetchRealData();

    if (!isSupabaseConfigured()) return;

    // Interval Sinkronisasi Background Otomatis (Setiap 60 Detik & Hanya Saat Tab Aktif)
    const syncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return; // Lewati polling jika tab sedang tidak aktif / diminimalkan
      }
      fetchRealData(true);
    }, 60000);

    // Saluran Real-Time Supabase WebSocket Lintas Seluruh Operasional (Broadcast & Database Sync)
    const channel = supabase
      .channel('realtime_sto_live_operations', {
        config: { broadcast: { self: true, ack: true } }
      })
      // A. Supabase Realtime WebSocket Broadcast: Milidetik Sinyal Antar Perangkat ⚡
      .on('broadcast', { event: 'tugas_baru' }, ({ payload }) => {
        if (payload && payload.id) {
          setTugas((prev) => [payload, ...prev.filter(t => t.id !== payload.id)]);
          const curUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (curUser?.role === 'teknisi') {
            showToast(`🚨 TIKET BARU DITERBITKAN: ${payload.jenis_kerja || 'Pekerjaan'} di ${payload.lokasi || 'Payakumbuh'}`, 'info');
          }
        }
      })
      .on('broadcast', { event: 'tugas_diklaim' }, ({ payload }) => {
        if (payload && payload.tugas_id) {
          setTugas((prev) => prev.map(t => Number(t.id) === Number(payload.tugas_id) ? {
            ...t,
            teknisi_id: payload.teknisi_id,
            status: 'Progress'
          } : t));
          const curUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (curUser?.role === 'pimpinan') {
            showToast(`👷 Tiket #${payload.tugas_id} telah diambil oleh ${payload.teknisi_nama || 'Teknisi'}!`, 'info');
          }
        }
      })
      .on('broadcast', { event: 'permohonan_baru' }, ({ payload }) => {
        if (payload && payload.id) {
          setPermohonan((prev) => [payload, ...prev.filter(p => p.id !== payload.id)]);
          const curUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (curUser?.role === 'pimpinan') {
            showToast(`📦 PERMOHONAN MATERIAL: Teknisi mengajukan barang untuk Tiket #${payload.tugas_id}. Silakan periksa!`, 'warning');
          }
        }
      })
      .on('broadcast', { event: 'permohonan_approved' }, ({ payload }) => {
        if (payload && payload.id) {
          setPermohonan((prev) => prev.map(p => Number(p.id) === Number(payload.id) ? { ...p, status: 'Approved' } : p));
          const curUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (curUser?.role === 'gudang') {
            showToast(`✅ Permohonan #${payload.id} disetujui Pimpinan! Siap diserahkan ke teknisi.`, 'success');
          } else if (curUser?.role === 'teknisi') {
            showToast(`✅ Permohonan material disetujui Pimpinan! Silakan ambil barang ke Gudang STO.`, 'success');
          }
        }
      })
      .on('broadcast', { event: 'permohonan_rejected' }, ({ payload }) => {
        if (payload && payload.id) {
          setPermohonan((prev) => prev.map(p => Number(p.id) === Number(payload.id) ? {
            ...p,
            status: 'Rejected',
            catatan_pimpinan: payload.catatan_pimpinan
          } : p));
          const curUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (curUser?.role === 'teknisi' && (!payload.teknisi_id || Number(curUser.id) === Number(payload.teknisi_id))) {
            showToast(`⚠️ Permohonan #${payload.id} DITOLAK Pimpinan: "${payload.catatan_pimpinan || 'Coba periksa lagi material'}". Silakan ajukan ulang!`, 'error');
            playNotificationChime();
          }
        }
      })
      .on('broadcast', { event: 'barang_tambah' }, ({ payload }) => {
        if (payload && payload.id) {
          setBarang(prev => [payload, ...prev.filter(b => Number(b.id) !== Number(payload.id))]);
        }
      })
      .on('broadcast', { event: 'barang_update' }, ({ payload }) => {
        if (payload && payload.id) {
          setBarang(prev => prev.map(b => Number(b.id) === Number(payload.id) ? { ...b, ...payload } : b));
        }
      })
      .on('broadcast', { event: 'barang_hapus' }, ({ payload }) => {
        if (payload && payload.id) {
          setBarang(prev => prev.filter(b => Number(b.id) !== Number(payload.id)));
          if (payload.nama_barang) {
            setOntSerials(prev => {
              const next = prev.filter(s => s.model?.toLowerCase() !== payload.nama_barang?.toLowerCase());
              try { localStorage.setItem('sto_ont_serials', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        }
      })
      .on('broadcast', { event: 'ont_serials_sync' }, ({ payload }) => {
        if (Array.isArray(payload)) {
          setOntSerials(prev => {
            const next = [...payload, ...prev.filter(p => !payload.some(n => n.sn === p.sn))];
            try { localStorage.setItem('sto_ont_serials', JSON.stringify(next)); } catch {}
            return next;
          });
        }
      })
      .on('broadcast', { event: 'ont_serial_deleted' }, ({ payload }) => {
        if (payload && payload.sn) {
          setOntSerials(prev => {
            const next = prev.filter(s => s.sn !== payload.sn);
            try { localStorage.setItem('sto_ont_serials', JSON.stringify(next)); } catch {}
            return next;
          });
        }
      })
      .on('broadcast', { event: 'material_released' }, ({ payload }) => {
        if (payload && payload.id) {
          setPermohonan((prev) => prev.map(p => Number(p.id) === Number(payload.id) ? { ...p, status: 'Released' } : p));
          const curUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (curUser?.role === 'teknisi') {
            showToast(`📦 Material telah diserahkan Gudang! Status: Dalam Perjalanan menuju lokasi.`, 'success');
          }
        }
      })
      .on('broadcast', { event: 'tugas_selesai' }, ({ payload }) => {
        if (payload && payload.tugas_id) {
          setTugas((prev) => prev.map(t => Number(t.id) === Number(payload.tugas_id) ? { ...t, status: 'Done' } : t));
          const curUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (curUser?.role === 'pimpinan') {
            showToast(`🎉 Tiket #${payload.tugas_id} telah selesai dikerjakan & BASTP diterbitkan!`, 'success');
          }
        }
      })
      .on('broadcast', { event: 'tugas_dihapus' }, ({ payload }) => {
        if (payload && payload.tugas_id) {
          const delId = Number(payload.tugas_id);
          setTugas((prev) => prev.filter(t => Number(t.id) !== delId));
          setPermohonan((prev) => prev.filter(p => Number(p.tugas_id) !== delId));
          try {
            const doneList = JSON.parse(localStorage.getItem('sto_done_tasks') || '[]');
            const nextDone = doneList.filter(dId => Number(dId) !== delId);
            localStorage.setItem('sto_done_tasks', JSON.stringify(nextDone));
          } catch {}
          const curUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (curUser?.role === 'teknisi') {
            showToast(`ℹ️ Tiket #${delId} telah dibatalkan / dihapus oleh Pimpinan STO.`, 'info');
          }
        }
      })
      // B. Database Replication Changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tugas' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new;
            setTugas((prev) => [newTask, ...prev.filter(t => Number(t.id) !== Number(newTask.id))]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setTugas((prev) => prev.map(t => Number(t.id) === Number(updated.id) ? { ...t, ...updated, status: String(updated.status || '').toLowerCase() === 'done' ? 'Done' : (updated.status || t.status) } : t));
          } else if (payload.eventType === 'DELETE') {
            const delId = Number(payload.old?.id);
            if (delId) {
              setTugas((prev) => prev.filter(t => Number(t.id) !== delId));
              setPermohonan((prev) => prev.filter(p => Number(p.tugas_id) !== delId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'permohonan' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPerm = payload.new;
            setPermohonan((prev) => [newPerm, ...prev.filter(p => p.id !== newPerm.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setPermohonan((prev) => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
          } else if (payload.eventType === 'DELETE') {
            const delId = Number(payload.old?.id);
            if (delId) {
              setPermohonan((prev) => prev.filter(p => Number(p.id) !== delId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'barang' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBarang((prev) => [...prev.filter(b => b.id !== payload.new.id), payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setBarang((prev) => prev.map(b => b.id === payload.new.id ? { ...b, ...payload.new } : b));
          } else if (payload.eventType === 'DELETE') {
            setBarang((prev) => prev.filter(b => b.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    stoChannelRef.current = channel;

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchRealData]);

  // Auth Operations
  const login = useCallback((email, password) => {
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!found) {
      showToast("Email pengguna tidak ditemukan!", "error");
      return false;
    }
    if (found.password !== password) {
      showToast("Kata sandi salah!", "error");
      return false;
    }
    setCurrentUser(found);
    if (found.role === 'pimpinan') setCurrentView('pimpinan');
    else if (found.role === 'teknisi') setCurrentView('teknisi');
    else if (found.role === 'gudang') setCurrentView('gudang');
    showToast(`Selamat datang kembali, ${found.nama_lengkap}!`, "success");
    return true;
  }, [users, showToast]);

  const loginAsRole = useCallback((role) => {
    const found = users.find(u => u.role === role);
    if (found) {
      setCurrentUser(found);
      if (role === 'pimpinan') setCurrentView('pimpinan');
      else if (role === 'teknisi') setCurrentView('teknisi');
      else if (role === 'gudang') setCurrentView('gudang');
      showToast(`Beralih ke akun ${found.nama_lengkap} (${found.jabatan || found.role})`, "info");
    }
  }, [users, showToast]);

  const logout = useCallback(() => {
    sessionStorage.removeItem('sto_active_user');
    sessionStorage.removeItem('sto_splash_seen');
    localStorage.removeItem('user');
    localStorage.removeItem('sto_currentUser');
    localStorage.removeItem('sto_active_tab_pimpinan');
    localStorage.removeItem('sto_active_tab_teknisi');
    localStorage.removeItem('sto_active_tab_gudang');
    sessionStorage.removeItem('sto_active_tab_pimpinan');
    sessionStorage.removeItem('sto_active_tab_teknisi');
    sessionStorage.removeItem('sto_active_tab_gudang');
    setCurrentUser(null);
    setCurrentView('landing');
    showToast("Anda telah keluar dari sistem.", "info");
  }, [showToast]);

  // SOP 1: Pimpinan membuat tiket tugas dan menyiarkan ke pool teknisi secara instan via Supabase Realtime WebSocket & Telegram
  const createTugas = useCallback(async (taskData) => {
    const newId = tugas.length > 0 ? Math.max(...tugas.map(t => Number(t.id) || 0)) + 1 : 101;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const offsetLat = (Math.random() - 0.5) * 0.02;
    const offsetLng = (Math.random() - 0.5) * 0.02;
    const target_lat = taskData.target_lat || (STO_COORDINATES.lat + offsetLat);
    const target_lng = taskData.target_lng || (STO_COORDINATES.lng + offsetLng);

    const fullLokasi = taskData.pelanggan_nama
      ? `${taskData.pelanggan_nama}${taskData.pelanggan_telp ? ' (' + taskData.pelanggan_telp + ')' : ''} - ${taskData.lokasi}${taskData.keterangan ? ' [' + taskData.keterangan + ']' : ''}`
      : taskData.lokasi;

    // Pastikan teknisi_id tidak null (menggunakan id 99 = Siaga Pool Terbuka jika tidak ditugaskan khusus)
    const assignedTeknisiId = taskData.teknisi_id && Number(taskData.teknisi_id) !== 0 ? Number(taskData.teknisi_id) : 99;

    let finalTask = {
      id: newId,
      nomor_tiket: taskData.nomor_tiket || `TKT-PYK-2026-${String(newId).padStart(3, '0')}`,
      pimpinan_id: currentUser ? currentUser.id : 1,
      teknisi_id: assignedTeknisiId,
      jenis_kerja: taskData.jenis_kerja,
      lokasi: taskData.lokasi,
      pelanggan_nama: taskData.pelanggan_nama || "Pelanggan Belum Terdata",
      pelanggan_telp: taskData.pelanggan_telp || "",
      status: "menunggu",
      keterangan: taskData.keterangan || "",
      target_lat,
      target_lng,
      foto_bukti: null,
      waktu_buat: formattedDate
    };

    // 1. Simpan ke database Supabase Cloud (Single Source of Truth)
    let dbAssignedId = null;
    if (isSupabaseConfigured()) {
      try {
        // Validasi Foreign Key Pimpinan & Teknisi terhadap database
        const pimpinanIdValid = users.some(u => Number(u.id) === Number(finalTask.pimpinan_id))
          ? Number(finalTask.pimpinan_id)
          : 1;

        const teknisiIdValid = users.some(u => Number(u.id) === Number(assignedTeknisiId))
          ? Number(assignedTeknisiId)
          : 99;

        // Validasi Foreign Key ODP
        let validOdpId = null;
        if (taskData.odp_id && odp.some(o => Number(o.id) === Number(taskData.odp_id))) {
          validOdpId = Number(taskData.odp_id);
        }

        const insertPayload = {
          pimpinan_id: pimpinanIdValid,
          teknisi_id: teknisiIdValid,
          jenis_kerja: finalTask.jenis_kerja,
          lokasi: fullLokasi,
          status: 'menunggu',
          broadcast_status: 'sent'
        };

        if (validOdpId) {
          insertPayload.odp_id = validOdpId;
        }

        let { data: dbData, error: dbErr } = await supabase.from('tugas').insert([insertPayload]).select();

        // Jika gagal karena foreign key ODP, otomatis coba lagi tanpa odp_id
        if (dbErr && dbErr.code === '23503' && insertPayload.odp_id) {
          delete insertPayload.odp_id;
          const retryRes = await supabase.from('tugas').insert([insertPayload]).select();
          dbData = retryRes.data;
          dbErr = retryRes.error;
        }

        if (!dbErr && dbData && dbData.length > 0) {
          dbAssignedId = dbData[0].id;
          finalTask = { ...finalTask, id: dbAssignedId, ...dbData[0] };
        } else if (dbErr) {
          console.warn('[createTugas] Supabase direct insert notice:', dbErr.message);
        }
      } catch (err) {
        console.warn('[createTugas] Supabase insert warning:', err);
      }
    }

    // Backend Express Sync jika online (non-blocking)
    api.post('/tugas', {
      pimpinan_id: Number(finalTask.pimpinan_id) || 1,
      teknisi_id: assignedTeknisiId,
      jenis_kerja: finalTask.jenis_kerja,
      lokasi: finalTask.lokasi,
      pelanggan_nama: finalTask.pelanggan_nama,
      pelanggan_telp: finalTask.pelanggan_telp,
      odp_kode: taskData.odp_kode || null,
      odp_id: taskData.odp_id,
      keterangan: taskData.keterangan || ''
    }).catch(() => {});

    // 2. Update state React lokal seketika & persistensikan ke localStorage
    setTugas(prev => {
      const updated = [finalTask, ...prev.filter(t => t.id !== newId && t.id !== finalTask.id)];
      try {
        localStorage.setItem('sto_tugas', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2b. Simpan data calon pelanggan ke Master Data Pelanggan STO sejak awal tiket diterbitkan Pimpinan
    if (finalTask.pelanggan_nama) {
      setPelanggan(prev => {
        const cleanName = finalTask.pelanggan_nama.trim().toLowerCase();
        const exists = prev.some(p => p.nama && p.nama.trim().toLowerCase() === cleanName);
        if (!exists) {
          const newCustomer = {
            id: prev.length + 1,
            id_pelanggan: `112233${String(prev.length + 1).padStart(6, '0')}`,
            nama: finalTask.pelanggan_nama,
            no_telp: finalTask.pelanggan_telp || '0812-7711-2233',
            alamat: finalTask.lokasi || 'Payakumbuh',
            patokan: finalTask.keterangan || 'Tiket Terbit - Dalam Penanganan Teknisi Lapangan',
            latitude: target_lat,
            longitude: target_lng,
            odp_id: taskData.odp_kode || 'ODP-PYK-FA/001',
            port_odp: '-',
            paket: finalTask.jenis_kerja?.includes('Pasang Baru') ? 'IndiHome Fiber 50 Mbps' : 'Maintenance Jaringan',
            sn_ont: 'Menunggu Closing BASTP',
            model_ont: 'Modem ONT ZTE F670L Dual Band',
            sn_stb: '-',
            tanggal_pasang: 'Dalam Proses Pasang',
            status_langganan: 'Proses Pasang Baru',
            total_tunggakan: 'Rp 0',
            foto_rumah: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&auto=format&fit=crop&q=80',
            catatan_kolektor: `Tiket #${finalTask.id} diterbitkan Pimpinan STO.`
          };
          return [newCustomer, ...prev];
        }
        return prev;
      });
    }

    // 3. Supabase Realtime WebSocket Broadcast
    broadcastLiveSignal('tugas_baru', finalTask);
    playNotificationChime();

    // 4. Siarkan Notifikasi ke Grup Telegram (Dual-Dispatch: Express API + Direct Telegram Bot API)
    try {
      const matchedOdp = odp.find(o => Number(o.id) === Number(taskData.odp_id));
      const odpKode = taskData.odp_kode || matchedOdp?.kode_odp || 'Titik ODP Belum Ditentukan';
      const assignedUser = users.find(u => Number(u.id) === assignedTeknisiId);
      const isOpenPool = assignedTeknisiId === 99;
      const cleanAddress = parseTaskDetails(finalTask).address || taskData.lokasi || 'Alamat belum terdata';
      const mapsUrl = formatTelegramMapsUrl(target_lat, target_lng, cleanAddress);
      const kontakHtml = formatTelegramPhoneLinks(finalTask.pelanggan_telp);
      const portalUrl = 'https://sto-telkom.vercel.app';

      const headerLine = isOpenPool
        ? `🚨 <b>[TELKOM AKSES STO PAYAKUMBUH — SPK BARU]</b>`
        : `📌 <b>[TELKOM AKSES STO PAYAKUMBUH — PENUGASAN LANGSUNG]</b>`;

      const statusLine = isOpenPool
        ? `📊 <b>Status:</b> <code>OPEN POOL — Menunggu Klaim Teknisi</code>`
        : `👷 <b>Teknisi Ditugaskan:</b> ${escTelegramHtml(assignedUser?.nama_lengkap || 'Teknisi Lapangan')}\n📊 <b>Status:</b> <code>ASSIGNED — Menunggu Pengerjaan</code>`;

      const teksTelegram = truncateTelegramMessage([
        headerLine,
        TELEGRAM_SEPARATOR,
        `📋 <b>Tiket:</b> #${escTelegramHtml(finalTask.id)} • <b>${escTelegramHtml(finalTask.jenis_kerja || 'Penugasan Lapangan')}</b>`,
        `🔌 <b>ODP Target:</b> <code>${escTelegramHtml(odpKode)}</code>`,
        `👤 <b>Pelanggan:</b> ${escTelegramHtml(finalTask.pelanggan_nama || 'Pelanggan Belum Terdata')}`,
        `📞 <b>Kontak:</b> ${kontakHtml}`,
        `📍 <b>Alamat:</b> ${escTelegramHtml(cleanAddress)}${mapsUrl ? ` (<a href="${escTelegramHtml(mapsUrl)}">Buka Maps</a>)` : ''}`,
        finalTask.keterangan ? `📝 <b>Instruksi NOC:</b> ${escTelegramHtml(finalTask.keterangan)}` : null,
        statusLine,
        `⏱️ <b>Target SLA:</b> &lt; 3 Jam (Prioritas Operasional)`,
        TELEGRAM_SEPARATOR,
        `👉 <a href="${escTelegramHtml(portalUrl)}">Buka Detail Tiket di Portal</a>`
      ].filter(Boolean).join('\n'));

      sendTelegramAlert(teksTelegram).catch((tgErr) => {
        console.error('[TelegramBot Error]:', tgErr.message);
      });
    } catch (tgErr) {
      console.error('[TelegramBot Error]:', tgErr.message);
    }

    showToast(`Tiket #${finalTask.id} (${taskData.jenis_kerja}) berhasil disiarkan ke aplikasi & Telegram!`, "success");
    return finalTask;
  }, [tugas, odp, currentUser, users, showToast, broadcastLiveSignal]);

  // SOP 1.5: Teknisi mengklaim/mengambil tiket yang diumumkan (Single Source of Truth via Express API)
  const claimTugas = useCallback(async (tugasId, teknisiId = null) => {
    const parsedTugasId = parseInt(tugasId, 10);
    const parsedTeknisiId = parseInt(teknisiId, 10) || currentUser?.id || 2;

    if (!tugasId || isNaN(parsedTugasId) || parsedTugasId <= 0) {
      showToast('ID tugas tidak valid!', 'error');
      return false;
    }

    const targetTask = tugas.find(t => Number(t.id) === parsedTugasId);
    if (!targetTask) {
      showToast('Tiket tugas tidak ditemukan!', 'error');
      return false;
    }

    if (targetTask.status === 'Done') {
      showToast('Tiket ini sudah selesai dikerjakan!', 'error');
      return false;
    }

    const isPoolTask = !targetTask.teknisi_id || Number(targetTask.teknisi_id) === 99 || Number(targetTask.teknisi_id) === 0;
    if (!isPoolTask && Number(targetTask.teknisi_id) !== parsedTeknisiId && targetTask.status !== 'Open' && targetTask.status !== 'menunggu') {
      showToast('Tiket ini sudah diambil oleh teknisi lain!', 'error');
      return false;
    }

    // 1. Jalur Utama: Sinkronisasi ke Backend Express API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.patch(`/tugas/${parsedTugasId}/claim`, { teknisi_id: parsedTeknisiId });
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[claimTugas] Backend Express API notice:', apiErr?.response?.data?.message || apiErr?.message);
    }

    // 2. Update state React lokal
    setTugas(prev => prev.map(t => {
      if (Number(t.id) === parsedTugasId) {
        return {
          ...t,
          teknisi_id: parsedTeknisiId,
          status: 'Progress'
        };
      }
      return t;
    }));

    // 3. Offline Fallback: HANYA jika backend API offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        await supabase.from('tugas').update({
          teknisi_id: parsedTeknisiId,
          status: 'Progress'
        }).eq('id', parsedTugasId);
      } catch (err) {
        console.warn('Supabase claim task notice:', err);
      }
    }

    const techName = currentUser?.nama_lengkap || 'Teknisi Lapangan';

    // Broadcast sinyal instan via WebSocket Supabase Realtime
    broadcastLiveSignal('tugas_diklaim', {
      tugas_id: parsedTugasId,
      teknisi_id: parsedTeknisiId,
      teknisi_nama: techName
    });

    // Notifikasi ke Grup Telegram (Dual-Dispatch)
    try {
      const cust = parseTaskDetails(targetTask);
      const matchedOdp = odp.find(o => Number(o.id) === Number(targetTask.odp_id));
      const odpKode = targetTask.odp_kode || matchedOdp?.kode_odp || 'Titik ODP Belum Ditentukan';
      const mapsUrl = formatTelegramMapsUrl(targetTask.target_lat, targetTask.target_lng, cust.address);
      const kontakHtml = formatTelegramPhoneLinks(cust.telp || targetTask.pelanggan_telp);
      const portalUrl = 'https://sto-telkom.vercel.app';

      const claimText = truncateTelegramMessage([
        `👷 <b>[TELKOM AKSES STO PAYAKUMBUH — TIKET DIKLAIM]</b>`,
        TELEGRAM_SEPARATOR,
        `📋 <b>Tiket:</b> #${escTelegramHtml(parsedTugasId)} • <b>${escTelegramHtml(targetTask.jenis_kerja || 'Penugasan Lapangan')}</b>`,
        `👷 <b>Teknisi:</b> <b>${escTelegramHtml(techName)}</b>`,
        `🔌 <b>ODP Target:</b> <code>${escTelegramHtml(odpKode)}</code>`,
        `👤 <b>Pelanggan:</b> ${escTelegramHtml(cust.name || 'Pelanggan Belum Terdata')}`,
        `📞 <b>Kontak:</b> ${kontakHtml}`,
        `📍 <b>Alamat:</b> ${escTelegramHtml(cust.address || 'Alamat belum terdata')}${mapsUrl ? ` (<a href="${escTelegramHtml(mapsUrl)}">Buka Maps</a>)` : ''}`,
        `📊 <b>Status:</b> <code>PROGRESS (Diambil Teknisi)</code>`,
        TELEGRAM_SEPARATOR,
        `📌 <i>Langkah berikutnya: Ajukan material di portal jika membutuhkan perangkat/kabel gudang, atau langsung menuju lokasi.</i>`,
        `👉 <a href="${escTelegramHtml(portalUrl)}">Buka Portal Tiket</a>`
      ].join('\n'));

      sendTelegramAlert(claimText).catch((tgErr) => {
        console.error('[TelegramBot Error]:', tgErr.message);
      });
    } catch (tgErr) {
      console.error('[TelegramBot Error]:', tgErr.message);
    }

    showToast(`Tiket #${parsedTugasId} berhasil Anda ambil! Segera ajukan permohonan material ke gudang.`, 'success');
    return true;
  }, [tugas, odp, currentUser, showToast, broadcastLiveSignal]);

  // SOP 2: Teknisi mengajukan material ke gudang (Mendukung Multi-Tiket / Batch Kolektif)
  const requestMaterial = useCallback(async (param1, param2, param3, param4) => {
    let tugasId = param1;
    let items = param2;
    let catatan = param3;
    let tugasIds = [];

    if (typeof param1 === 'object' && param1 !== null && !Array.isArray(param1)) {
      tugasId = param1.tugas_id || param1.tugasId;
      items = param1.items || param1.barang || [];
      catatan = param1.catatan || param1.catatan_teknisi;
      tugasIds = param1.tugas_ids || (tugasId ? [tugasId] : []);
    } else if (Array.isArray(param4) && param4.length > 0) {
      tugasIds = param4;
    } else {
      tugasIds = tugasId ? [tugasId] : [];
    }

    const parsedTugasId = parseInt(tugasId, 10) || Number(tugasId);
    const validTugasIds = Array.from(new Set(tugasIds.map(Number).filter(Boolean)));
    if (parsedTugasId && !validTugasIds.includes(parsedTugasId)) {
      validTugasIds.push(parsedTugasId);
    }

    const newPermohonanId = permohonan.length > 0 ? Math.max(...permohonan.map(p => Number(p.id) || 0)) + 1 : 501;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const isBatch = validTugasIds.length > 1;
    const batchTasks = tugas.filter(t => validTugasIds.includes(Number(t.id)));
    const batchPelangganNames = batchTasks.map(t => t.pelanggan_nama || `#${t.id}`).join(', ');

    let curPId = permohonan.length > 0 ? Math.max(...permohonan.map(p => Number(p.id) || 0)) + 1 : 501;
    let startDetailId = detailPermohonan.length > 0 ? Math.max(...detailPermohonan.map(d => Number(d.id) || 0)) + 1 : 1;

    // Buat permohonan untuk setiap tiket yang dipilih (Konsisten untuk Multi-Select Tiket)
    const newPermohonans = validTugasIds.map(tid => {
      const pId = curPId++;
      return {
        id: pId,
        tugas_id: tid,
        tugas_ids: validTugasIds,
        is_batch: isBatch,
        batch_count: validTugasIds.length,
        batch_pelanggan: batchPelangganNames,
        status: "Pending",
        waktu_request: formattedDate,
        catatan_teknisi: catatan || (isBatch ? `Permohonan kolektif (Batch ${validTugasIds.length} Pelanggan: ${batchPelangganNames})` : "Kebutuhan perbaikan / instalasi lapangan")
      };
    });

    const newDetails = [];
    newPermohonans.forEach(p => {
      (items || []).forEach(item => {
        newDetails.push({
          id: startDetailId++,
          permohonan_id: p.id,
          barang_id: parseInt(item.barang_id, 10),
          jumlah_minta: parseInt(item.jumlah_minta, 10) || 1
        });
      });
    });

    // Otomatis bersihkan permohonan yang berstatus Rejected untuk tugas terkait karena material sudah diperbarui
    setPermohonan(prev => [
      ...newPermohonans,
      ...prev.filter(p => !(validTugasIds.includes(Number(p.tugas_id)) && p.status === 'Rejected'))
    ]);
    setDetailPermohonan(prev => [...newDetails, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        supabase.from('permohonan').delete().in('tugas_id', validTugasIds).eq('status', 'Rejected').then(() => {}, () => {});
      } catch {}
    }

    const activeTechId = Number(currentUser?.id || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}')?.id : null) || 2);

    // Set seluruh tugas yang ada di batch ke status Progress dan pastikan teknisi_id assigned ke teknisi aktif jika belum
    setTugas(prev => prev.map(t => {
      if (validTugasIds.includes(Number(t.id))) {
        const needsAssign = !t.teknisi_id || Number(t.teknisi_id) === 99 || Number(t.teknisi_id) === 0;
        return {
          ...t,
          status: 'Progress',
          ...(needsAssign ? { teknisi_id: activeTechId } : {})
        };
      }
      return t;
    }));

    // 1. Sinkronisasi ke Backend Express API (Single Source of Truth)
    let backendHandled = false;
    let realPId = newPermohonans[0]?.id || 501;

    try {
      const apiRes = await api.post('/permohonan', {
        tugas_id: validTugasIds[0],
        tugas_ids: validTugasIds,
        is_batch: isBatch,
        barang: items.map(k => ({ barang_id: k.barang_id, jumlah_minta: k.jumlah_minta })),
        teknisi_id: activeTechId,
        teknisi_nama: currentUser?.nama_lengkap || 'Teknisi Lapangan'
      });
      if (apiRes.data?.success) {
        backendHandled = true;
        if (apiRes.data?.data?.permohonan?.id) {
          realPId = apiRes.data.data.permohonan.id;
        }
      }
    } catch (apiErr) {
      console.warn('[requestMaterial] Backend Express API notice:', apiErr.message);
    }

    // 2. Direct Supabase Fallback (hanya jika Backend API offline untuk mencegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        const permohonanRows = validTugasIds.map(tid => ({
          tugas_id: tid,
          status: 'Pending',
          waktu_request: new Date().toISOString()
        }));

        const { data: pData } = await supabase
          .from('permohonan')
          .insert(permohonanRows)
          .select();

        if (pData && pData.length > 0) {
          realPId = pData[0].id;
          const detailsToInsert = [];
          pData.forEach(p => {
            (items || []).forEach(item => {
              detailsToInsert.push({
                permohonan_id: p.id,
                barang_id: parseInt(item.barang_id, 10),
                jumlah_minta: parseInt(item.jumlah_minta, 10) || 1
              });
            });
          });

          if (detailsToInsert.length > 0) {
            await supabase.from('detail_permohonan').insert(detailsToInsert);
          }

          const updatePayload = { status: 'Progress' };
          if (activeTechId) {
            updatePayload.teknisi_id = activeTechId;
          }
          await supabase.from('tugas').update(updatePayload).in('id', validTugasIds);
        }
      } catch (err) {
        console.warn('Supabase request material notice:', err);
      }
    }

    // 3. Supabase Realtime WebSocket Broadcast ke Petugas Gudang & Pimpinan
    broadcastLiveSignal('permohonan_baru', {
      id: realPId,
      tugas_id: validTugasIds[0],
      tugas_ids: validTugasIds,
      teknisi_nama: currentUser?.nama_lengkap || 'Teknisi Lapangan',
      items
    });

    // 4. Notifikasi Telegram ke Grup Gudang (Dual-Dispatch)
    try {
      const parentTask = tugas.find(t => Number(t.id) === parsedTugasId);
      const cust = parseTaskDetails(parentTask);
      const pemohonNama = currentUser?.nama_lengkap || 'Teknisi Lapangan';
      const maxItems = 20;
      const safeItems = (items || []).slice(0, maxItems);
      const remainingItems = (items || []).length - safeItems.length;

      let itemListText = safeItems.map(i => {
        const matchedBarang = barang.find(b => Number(b.id) === Number(i.barang_id));
        const itemNama = i.nama_barang || matchedBarang?.nama_barang || `Material #${i.barang_id}`;
        const itemSatuan = i.satuan || matchedBarang?.satuan || 'pcs';
        return `• <b>${escTelegramHtml(itemNama)}</b>: ${escTelegramHtml(i.jumlah_minta)} ${escTelegramHtml(itemSatuan)}`;
      }).join('\n');

      if (!itemListText) {
        itemListText = '• <i>Rincian material belum terlampir</i>';
      } else if (remainingItems > 0) {
        itemListText += `\n<i>... dan ${remainingItems} item material lainnya</i>`;
      }

      const tiketSummary = validTugasIds.length > 1
        ? `Batch ${validTugasIds.length} Tiket (${validTugasIds.slice(0, 15).map(id => `#${escTelegramHtml(id)}`).join(', ')}${validTugasIds.length > 15 ? ', ...' : ''})`
        : `#${escTelegramHtml(parsedTugasId)} (${escTelegramHtml(parentTask?.jenis_kerja || 'Penugasan Lapangan')})`;

      const portalUrl = 'https://sto-telkom.vercel.app';

      const textGudang = truncateTelegramMessage([
        `📦 <b>[TELKOM AKSES STO PAYAKUMBUH — PERMOHONAN MATERIAL]</b>`,
        TELEGRAM_SEPARATOR,
        `🔖 <b>No. Permohonan:</b> #${escTelegramHtml(realPId)}`,
        `📋 <b>Tiket:</b> ${tiketSummary}`,
        `👷 <b>Pemohon:</b> <b>${escTelegramHtml(pemohonNama)}</b>`,
        `👤 <b>Pelanggan:</b> ${escTelegramHtml(cust.name || 'Pelanggan Belum Terdata')}`,
        `📍 <b>Alamat:</b> ${escTelegramHtml(cust.address || 'Alamat belum terdata')}`,
        TELEGRAM_SEPARATOR,
        `📝 <b>Rincian Material:</b>`,
        itemListText,
        catatan ? `💬 <b>Catatan:</b> ${escTelegramHtml(catatan)}` : null,
        `📊 <b>Status:</b> <code>MENUNGGU PERSETUJUAN PIMPINAN</code>`,
        TELEGRAM_SEPARATOR,
        `👉 <a href="${escTelegramHtml(portalUrl)}">Tinjau Permohonan di Portal</a>`
      ].filter(Boolean).join('\n'));

      sendTelegramAlert(textGudang).catch((tgErr) => {
        console.error('[TelegramBot Error]:', tgErr.message);
      });
    } catch (tgErr) {
      console.error('[TelegramBot Error]:', tgErr.message);
    }

    showToast(`Permohonan material #${realPId} berhasil diajukan ke Gudang STO!`, "success");
  }, [tugas, permohonan, detailPermohonan, barang, currentUser, showToast, broadcastLiveSignal]);

  // SOP 3: Pimpinan memberikan persetujuan (approval)
  const approveMaterial = useCallback(async (permohonanId) => {
    const parsedId = parseInt(permohonanId, 10);
    const target = permohonan.find(p => Number(p.id) === parsedId);

    setPermohonan(prev => prev.map(p => {
      if (Number(p.id) === parsedId) {
        return { ...p, status: "Approved" };
      }
      return p;
    }));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('permohonan').update({ status: 'Approved' }).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase approve error:', err);
      }
    }

    try {
      await api.patch(`/permohonan/${parsedId}/approve`);
    } catch (apiErr) {
      console.warn('[approveMaterial] Backend API notice:', apiErr.message);
    }

    // Broadcast permohonan_approved via Supabase WebSocket ke seluruh teknisi
    broadcastLiveSignal('permohonan_approved', {
      id: parsedId,
      tugas_id: target?.tugas_id,
      teknisi_id: target?.teknisi_id
    });

    showToast(`Permohonan #${parsedId} DISETUJUI. Diteruskan ke Gudang untuk rilis barang!`, "success");
  }, [permohonan, broadcastLiveSignal, showToast]);

  const rejectMaterial = useCallback(async (permohonanId, reason = "Ditolak oleh Pimpinan") => {
    const parsedId = parseInt(permohonanId, 10);
    const targetPermohonan = permohonan.find(p => Number(p.id) === parsedId);

    setPermohonan(prev => prev.map(p => {
      if (Number(p.id) === parsedId) {
        return { ...p, status: "Rejected", catatan_pimpinan: reason };
      }
      return p;
    }));

    let backendHandled = false;
    try {
      const res = await api.patch(`/permohonan/${parsedId}/reject`, { catatan: reason });
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[rejectMaterial] Backend API notice:', apiErr.message);
    }

    if (!backendHandled && isSupabaseConfigured()) {
      try {
        await supabase.from('permohonan').update({ status: 'Rejected', catatan_pimpinan: reason }).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase reject error:', err);
      }
    }

    // Siarkan sinyal realtime ke teknisi pemohon
    broadcastLiveSignal('permohonan_rejected', {
      id: parsedId,
      tugas_id: targetPermohonan?.tugas_id,
      teknisi_id: targetPermohonan?.teknisi_id,
      teknisi_nama: targetPermohonan?.teknisi_nama,
      catatan_pimpinan: reason
    });

    showToast(`Permohonan #${parsedId} DITOLAK. Notifikasi arahan dikirim ke teknisi.`, "error");
  }, [permohonan, broadcastLiveSignal, showToast]);

  // SOP 4: Gudang merilis barang dan sistem melakukan pemotongan stok otomatis
  const releaseMaterial = useCallback(async (permohonanId, sn = null) => {
    const parsedId = parseInt(permohonanId, 10);
    const targetPermohonan = permohonan.find(p => Number(p.id) === parsedId);
    if (!targetPermohonan || targetPermohonan.status === 'Released') return;

    const itemsToRelease = detailPermohonan.filter(d => Number(d.permohonan_id) === parsedId);

    // Periksa apakah stok mencukupi
    for (const item of itemsToRelease) {
      const b = barang.find(x => Number(x.id) === Number(item.barang_id));
      if (b && Number(b.stok) < Number(item.jumlah_minta)) {
        showToast(`Stok ${b.nama_barang} tidak mencukupi (Sisa: ${b.stok}, Diminta: ${item.jumlah_minta})!`, "error");
        return;
      }
    }

    // Pemotongan stok otomatis di state lokal
    setBarang(prev => prev.map(b => {
      const matched = itemsToRelease.find(item => Number(item.barang_id) === Number(b.id));
      if (matched) {
        return { ...b, stok: Math.max(0, Number(b.stok) - Number(matched.jumlah_minta)) };
      }
      return b;
    }));

    // Update status permohonan ke Released
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const targetTugasIds = targetPermohonan.tugas_ids && targetPermohonan.tugas_ids.length > 0
      ? targetPermohonan.tugas_ids.map(Number)
      : [Number(targetPermohonan.tugas_id)];

    const allocations = (typeof sn === 'object' && sn !== null) ? sn : {};
    let defaultSn = typeof sn === 'string' ? sn : null;

    // Baca stok serials ONT di gudang untuk alokasi otomatis jika belum ditentukan manual
    let storedOnts = [];
    try {
      storedOnts = JSON.parse(localStorage.getItem('sto_ont_serials') || '[]');
    } catch {}

    const hasOntRequested = itemsToRelease.some(d => {
      const b = barang.find(x => Number(x.id) === Number(d.barang_id));
      const nm = String(b?.nama_barang || '').toLowerCase();
      return nm.includes('ont') || nm.includes('modem') || nm.includes('zte') || nm.includes('huawei');
    });

    // Otomatis salin dan alokasikan Serial Number ONT dari stok ready jika ada permintaan ONT
    let readySearchIdx = 0;
    targetTugasIds.forEach((tid) => {
      let currentSn = (typeof allocations[tid] === 'object' ? allocations[tid]?.sn : allocations[tid]) || defaultSn;
      if (!currentSn && hasOntRequested) {
        const readyOnt = storedOnts.find((s, idx) => (s.status === 'Tersedia' || s.status === 'Di Gudang') && idx >= readySearchIdx);
        if (readyOnt) {
          currentSn = readyOnt.sn;
          readySearchIdx++;
        } else {
          currentSn = `ZTEGC8B902${String(tid).padStart(2, '0')}`;
        }
        allocations[tid] = { sn: currentSn, model: 'Modem ONT ZTE F670L Dual Band' };
        if (!defaultSn) defaultSn = currentSn;
      }
    });

    setPermohonan(prev => prev.map(p => {
      if (Number(p.id) === parsedId) {
        return {
          ...p,
          status: "Released",
          waktu_rilis: formattedDate,
          sn_allocations: allocations
        };
      }
      return p;
    }));

    // Update setiap tugas dalam batch dengan SN ONT yang dialokasikan khusus oleh Gudang
    setTugas(prev => prev.map(t => {
      if (targetTugasIds.includes(Number(t.id))) {
        const assignedData = allocations[t.id];
        const assignedSn = (typeof assignedData === 'object' ? assignedData?.sn : assignedData) || defaultSn || t.sn_ont;
        const assignedModel = (typeof assignedData === 'object' ? assignedData?.model : null) || 'Modem ONT ZTE F670L Dual Band';

        return {
          ...t,
          material_status: 'Dalam Perjalanan',
          status_detail: 'Material Siap Dibawa (Alokasi ONT Gudang)',
          ...(assignedSn ? {
            sn_ont: assignedSn,
            assigned_sn_ont: assignedSn,
            assigned_model_ont: assignedModel
          } : {})
        };
      }
      return t;
    }));

    // Simpan trasir ONT ke penyimpanan lokal
    try {
      targetTugasIds.forEach(tid => {
        const assignedData = allocations[tid];
        const snToStore = (typeof assignedData === 'object' ? assignedData?.sn : assignedData) || defaultSn;
        const modelToStore = (typeof assignedData === 'object' ? assignedData?.model : null) || 'Modem ONT ZTE F670L Dual Band';
        const taskObj = tugas.find(t => Number(t.id) === Number(tid));

        if (snToStore) {
          const existIdx = storedOnts.findIndex(s => s.sn === snToStore);
          if (existIdx !== -1) {
            storedOnts[existIdx] = {
              ...storedOnts[existIdx],
              status: 'Di Perjalanan',
              pelanggan: taskObj?.pelanggan_nama || 'Pelanggan STO',
              tugas_id: tid,
              waktu_rilis: formattedDate
            };
          } else {
            storedOnts.push({
              id: `ONT-TRANS-${parsedId}-${tid}`,
              sn: snToStore,
              model: modelToStore,
              status: 'Di Perjalanan',
              pelanggan: taskObj?.pelanggan_nama || 'Pelanggan STO',
              tugas_id: tid,
              waktu_rilis: formattedDate
            });
          }
        }
      });
      localStorage.setItem('sto_ont_serials', JSON.stringify(storedOnts));
    } catch {}

    // 1. Sync ke backend Express API (Jalur utama yang memotong stok di Supabase)
    let backendHandled = false;
    try {
      const res = await api.patch(`/permohonan/${parsedId}/release`, {
        sn_ont: (typeof sn === 'string' ? sn : (sn && typeof sn === 'object' ? Object.values(sn)[0]?.sn : null)) || null,
        allocations: typeof sn === 'object' ? sn : null
      });
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[releaseMaterial] Backend API notice:', apiErr.message);
    }

    // 2. Sync to Supabase hanya jika backend offline (cegah double stock deduction)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        for (const item of itemsToRelease) {
          const currentB = barang.find(x => Number(x.id) === Number(item.barang_id));
          const newStok = Math.max(0, (Number(currentB?.stok) || 0) - Number(item.jumlah_minta));
          await supabase.from('barang').update({ stok: newStok }).eq('id', Number(item.barang_id));
        }
        await supabase.from('permohonan').update({ status: 'Released' }).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase release sync error:', err);
      }
    }

    showToast(`Barang Permohonan #${parsedId} berhasil dirilis & stok gudang otomatis terpotong!`, "success");
  }, [permohonan, detailPermohonan, barang, tugas, showToast]);

  // SOP 5: Teknisi menuju lokasi (Sistem melacak koordinat GPS)
  const updateGpsLocation = useCallback(() => {}, []);
  const simulateTechnicianStep = useCallback(() => {}, []);

  /**
   * ==========================================================================
   * SOP 6: TEKNISI KLOSING PEKERJAAN & REKONSILIASI MATERIAL REAL (STANDAR TELKOM AKSES)
   * ==========================================================================
   * Fungsi ini menangani penutupan tiket (Closing Work Order) sesuai SOP IndiHome / Telkom Akses:
   * 1. Mencatat SN ONT Modem yang terpasang di rumah pelanggan.
   * 2. Mencatat ID ODP, Port ODP, dan Redaman Optik (dBm) untuk Quality Assurance.
   * 3. Rekonsiliasi Material: Barang terpasang resmi menjadi 'TERPASANG DI PELANGGAN (CONSUMED)',
   *    sedangkan material sisa dapat diretur kembali ke inventaris gudang.
   * 4. Menerbitkan Dokumen Digital BASTP (Berita Acara Serah Terima Pekerjaan).
   */
  const finishTugas = useCallback(async (tugasId, argPhotoOrPayload, catatanHasil = "") => {
    const parsedTugasId = parseInt(tugasId, 10);
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Cek apakah argumen kedua berupa objek payload lengkap atau sekadar string URL foto
    const isPayloadObject = typeof argPhotoOrPayload === 'object' && argPhotoOrPayload !== null;
    const matchedTask = tugas.find(t => Number(t.id) === parsedTugasId);
    if (matchedTask && (matchedTask.status === 'Done' || matchedTask.status === 'selesai')) {
      console.warn(`[finishTugas] Tiket #${parsedTugasId} sudah berstatus Done. Aksi diabaikan.`);
      return matchedTask.bastp;
    }

    const proof = isPayloadObject
      ? (argPhotoOrPayload.fotoBuktiUrl || argPhotoOrPayload.foto_rumah || argPhotoOrPayload.foto_sn || argPhotoOrPayload.foto_bukti || "")
      : (argPhotoOrPayload || "");

    const fotoSn = isPayloadObject ? (argPhotoOrPayload.foto_sn || "") : "";
    const fotoOpm = isPayloadObject ? (argPhotoOrPayload.foto_opm || "") : "";
    const fotoRumah = isPayloadObject ? (argPhotoOrPayload.foto_rumah || proof || "") : proof;
    const kelebihanMaterial = isPayloadObject ? argPhotoOrPayload.kelebihan_material : null;
    const fotoSisa = kelebihanMaterial?.foto || (isPayloadObject ? argPhotoOrPayload.foto_sisa : null);

    const userNote = isPayloadObject ? (argPhotoOrPayload.catatan || "") : catatanHasil;
    const odpId = isPayloadObject ? (argPhotoOrPayload.odp_id || "ODP-PYK-FA/014") : "ODP-PYK-FA/014";
    const portOdp = isPayloadObject ? (argPhotoOrPayload.port_odp || "03") : "03";
    const redamanDbm = isPayloadObject ? (argPhotoOrPayload.redaman_dbm || "-18.5") : "-18.5";
    const snOnt = isPayloadObject ? (argPhotoOrPayload.sn_ont || "ZTEGC8B90112") : "ZTEGC8B90112";
    const pelangganNama = isPayloadObject ? (argPhotoOrPayload.pelanggan_nama || matchedTask?.pelanggan_nama || "") : (matchedTask?.pelanggan_nama || "");
    const pelangganTelp = isPayloadObject ? (argPhotoOrPayload.pelanggan_telp || matchedTask?.pelanggan_telp || "") : (matchedTask?.pelanggan_telp || "");
    const lokasiAlamat = isPayloadObject ? (argPhotoOrPayload.lokasi || matchedTask?.lokasi || "") : (matchedTask?.lokasi || "");
    const reconciliation = isPayloadObject ? (argPhotoOrPayload.reconciliation || []) : [];
    const bastpNumber = isPayloadObject
      ? (argPhotoOrPayload.bastp_number || `BASTP/TA-PYK/${now.getFullYear()}/${String(parsedTugasId).padStart(4, '0')}`)
      : `BASTP/TA-PYK/${now.getFullYear()}/${String(parsedTugasId).padStart(4, '0')}`;

    // Struktur BASTP Lengkap untuk Dokumen Digital & Audit
    const bastpData = {
      nomor_bastp: bastpNumber,
      odp_id: odpId,
      port_odp: portOdp,
      redaman_dbm: redamanDbm,
      sn_ont: snOnt,
      pelanggan_nama: pelangganNama,
      waktu_closing: formattedDate,
      catatan_teknisi: userNote,
      foto_bukti: proof,
      foto_sn: fotoSn,
      foto_opm: fotoOpm,
      foto_rumah: fotoRumah,
      foto_sisa: fotoSisa,
      kelebihan_material: kelebihanMaterial,
      reconciliation: reconciliation.map(r => ({
        ...r,
        status: (Number(r.jumlah_sisa) > 0) ? 'SEBAGIAN TERPASANG & RETUR' : 'TERPASANG DI PELANGGAN (CONSUMED)'
      }))
    };

    // 1. Perbarui state lokal tugas dengan metadata closing & BASTP
    setTugas(prev => prev.map(t => {
      if (Number(t.id) === parsedTugasId) {
        return {
          ...t,
          status: "Done",
          foto_bukti: proof,
          foto_sn: fotoSn,
          foto_opm: fotoOpm,
          foto_rumah: fotoRumah,
          foto_sisa: fotoSisa,
          kelebihan_material: kelebihanMaterial,
          reconciliation: reconciliation,
          catatan_selesai: userNote,
          waktu_selesai: formattedDate,
          odp_id: odpId,
          port_odp: portOdp,
          redaman_dbm: redamanDbm,
          sn_ont: snOnt,
          bastp: bastpData
        };
      }
      return t;
    }));

    // 2. Jika teknisi meretur sisa kabel/barang kembali ke gudang, kembalikan ke stok gudang
    if (isPayloadObject && argPhotoOrPayload.retur_ke_gudang && Array.isArray(reconciliation)) {
      await Promise.all(reconciliation.map(async (item) => {
        const sisa = Number(item.jumlah_sisa) || 0;
        if (sisa > 0 && item.barang_id) {
          setBarang(prev => prev.map(b => {
            if (Number(b.id) === Number(item.barang_id)) {
              return { ...b, stok: Number(b.stok) + sisa };
            }
            return b;
          }));

          // Sinkronisasi update stok sisa retur ke Supabase
          if (isSupabaseConfigured()) {
            try {
              const currentB = barang.find(x => Number(x.id) === Number(item.barang_id));
              const updatedStok = (Number(currentB?.stok) || 0) + sisa;
              await supabase.from('barang').update({ stok: updatedStok }).eq('id', Number(item.barang_id));
            } catch (err) {
              console.warn('[finishTugas Retur] Gagal sync stok retur ke Supabase:', err);
            }
          }
        }
      }));
    }

    // 3. Simpan status selesai permanen di penyimpanan lokal
    try {
      const doneList = JSON.parse(localStorage.getItem('sto_done_tasks') || '[]');
      if (!doneList.includes(parsedTugasId)) {
        doneList.push(parsedTugasId);
        localStorage.setItem('sto_done_tasks', JSON.stringify(doneList));
      }
    } catch {}

    // 4. Sinkronisasi status selesai: Jalur Utama via Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.put(`/tugas/${parsedTugasId}/close`, {
        sn_ont: snOnt,
        odp_id: odpId,
        port_odp: portOdp,
        redaman_dbm: redamanDbm,
        foto_ont: proof,
        catatan_teknisi: userNote,
        pelanggan_nama: pelangganNama,
        reconciliation
      });
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[finishTugas] Backend API notice:', apiErr.message);
    }

    // 5. Fallback Supabase HANYA jika backend offline (mencegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        const { data: updateRes, error: updateErr } = await supabase.from('tugas').update({
          status: 'Done',
          foto_bukti: proof
        }).eq('id', parsedTugasId).select();

        // Jika baris belum ada di Supabase, insert baris tugas baru dengan status Done
        if (!updateErr && (!updateRes || updateRes.length === 0)) {
          const matched = tugas.find(t => Number(t.id) === parsedTugasId);
          await supabase.from('tugas').insert([{
            id: parsedTugasId,
            pimpinan_id: Number(matched?.pimpinan_id) || 1,
            teknisi_id: Number(matched?.teknisi_id) || currentUser?.id || 8,
            jenis_kerja: matched?.jenis_kerja || 'Pasang Baru',
            lokasi: matched?.lokasi || 'Koto Nan IV Payakumbuh',
            status: 'Done',
            foto_bukti: proof,
            broadcast_status: 'sent'
          }]);
        }
      } catch (err) {
        console.warn('Supabase finish task notice:', err);
      }
    }

    // 6. Broadcast sinyal selesai via Supabase Realtime WebSocket
    broadcastLiveSignal('tugas_selesai', {
      tugas_id: parsedTugasId,
      status: 'Done',
      sn_ont: snOnt
    });

    // Update Saldo Sisa Material di Tangan Teknisi (Mobile Stock)
    if (isPayloadObject && argPhotoOrPayload.sisa_kabel_m !== undefined) {
      setSaldoTeknisi(prev => ({
        ...prev,
        kabel_m: Number(argPhotoOrPayload.sisa_kabel_m) || 0
      }));
    }

    // Rekonsiliasi & Daftarkan ke Master Data Pelanggan STO
    if (pelangganNama) {
      setPelanggan(prev => {
        const existingIdx = prev.findIndex(p => (p.nama && p.nama.toLowerCase().trim() === pelangganNama.toLowerCase().trim()) || p.sn_ont === snOnt);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            sn_ont: snOnt,
            odp_id: odpId,
            port_odp: portOdp,
            status_langganan: 'Lancar',
            tanggal_pasang: formattedDate,
            foto_rumah: proof
          };
          return updated;
        } else {
          return [
            {
              id: prev.length + 1,
              id_pelanggan: `112233${String(prev.length + 1).padStart(6, '0')}`,
              nama: pelangganNama,
              no_telp: pelangganTelp || '0812-3456-7890',
              alamat: lokasiAlamat || 'Koto Nan IV, Payakumbuh',
              patokan: 'Pemasangan baru selesai divalidasi BASTP',
              latitude: -0.22415,
              longitude: 100.63120,
              odp_id: odpId,
              port_odp: portOdp,
              paket: 'IndiHome Fiber 50 Mbps',
              sn_ont: snOnt,
              model_ont: 'Modem ONT ZTE F670L Dual Band',
              sn_stb: '-',
              tanggal_pasang: formattedDate,
              status_langganan: 'Lancar',
              total_tunggakan: 'Rp 0 (Lunas)',
              foto_rumah: proof,
              catatan_kolektor: 'Instalasi selesai & aktif normal.'
            },
            ...prev
          ];
        }
      });

      // Simpan data pelanggan PSB ke tabel 'pelanggan' Supabase (Keperluan Audit & Debt Collector STO)
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('pelanggan').upsert([{
            id_pelanggan: `112233${String(parsedTugasId).padStart(6, '0')}`,
            nama: pelangganNama,
            no_telp: pelangganTelp || '0812-3456-7890',
            alamat: lokasiAlamat || 'Payakumbuh',
            sn_ont: snOnt,
            model_ont: 'Modem ONT ZTE F670L Dual Band',
            odp_id: odpId,
            port_odp: portOdp,
            status_langganan: 'Lancar',
            tanggal_pasang: formattedDate,
            total_tunggakan: 'Rp 0 (Lunas)',
            foto_rumah: proof,
            catatan_kolektor: 'Instalasi PSB selesai & aktif normal.'
          }], { onConflict: 'id_pelanggan' });
        } catch (pelDbErr) {
          console.info('[Supabase Pelanggan Sync Notice]:', pelDbErr.message);
        }
      }
    }

    // Update status serial number ONT di penyimpanan lokal agar statusnya otomatis Terpasang & terlacak lengkap
    try {
      const storedOnts = JSON.parse(localStorage.getItem('sto_ont_serials') || '[]');
      const updatedOnts = storedOnts.map(s => {
        if (s.sn === snOnt || Number(s.tugas_id) === parsedTugasId) {
          return {
            ...s,
            status: 'Terpasang',
            pelanggan: pelangganNama || s.pelanggan || 'Pelanggan STO',
            tugas_id: parsedTugasId,
            lokasi: lokasiAlamat || s.lokasi || 'Payakumbuh',
            target_lat: currentTask?.target_lat || s.target_lat,
            target_lng: currentTask?.target_lng || s.target_lng,
            foto_bukti: isPayloadObject ? argPhotoOrPayload.fotoBuktiUrl : argPhotoOrPayload,
            foto_sn: isPayloadObject ? argPhotoOrPayload.foto_sn : null,
            foto_opm: isPayloadObject ? argPhotoOrPayload.foto_opm : null,
            foto_rumah: isPayloadObject ? argPhotoOrPayload.foto_rumah : null,
            redaman_dbm: isPayloadObject ? argPhotoOrPayload.redaman_dbm : '-18.5',
            odp_id: isPayloadObject ? argPhotoOrPayload.odp_id : 'ODP-PYK-FA/001',
            port_odp: isPayloadObject ? argPhotoOrPayload.port_odp : '01',
            bastp_no: bastpData.nomor_bastp,
            waktu_pasang: formattedDate
          };
        }
        return s;
      });
      localStorage.setItem('sto_ont_serials', JSON.stringify(updatedOnts));
    } catch {}

    showToast(`Tiket #${parsedTugasId} berhasil diselesaikan! Status ONT ${snOnt} di gudang otomatis menjadi TERPASANG.`, "success");
    return bastpData;
  }, [tugas, barang, currentUser, broadcastLiveSignal, showToast]);

  const updateBarang = useCallback(async (id, updatedFields) => {
    const parsedId = parseInt(id, 10);
    setBarang(prev => prev.map(b => {
      if (Number(b.id) === parsedId) {
        return { ...b, ...updatedFields };
      }
      return b;
    }));

    const payload = {};
    if (updatedFields.nama_barang !== undefined) payload.nama_barang = updatedFields.nama_barang;
    if (updatedFields.stok !== undefined) payload.stok = parseInt(updatedFields.stok, 10);
    if (updatedFields.satuan !== undefined) payload.satuan = updatedFields.satuan;

    // 1. Sync ke Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.put(`/barang/${parsedId}`, payload);
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[updateBarang] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase HANYA jika Backend offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        await supabase.from('barang').update(payload).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase update barang error:', err);
      }
    }

    // Siarkan sinyal realtime ke seluruh client
    broadcastLiveSignal('barang_update', { id: parsedId, ...payload });

    showToast("Data barang berhasil diperbarui!", "success");
  }, [showToast, broadcastLiveSignal]);

  const tambahStokBarang = useCallback(async (id, jumlah) => {
    const parsedId = parseInt(id, 10);
    const parsedJumlah = parseInt(jumlah, 10);
    if (isNaN(parsedId) || isNaN(parsedJumlah) || parsedJumlah <= 0) return;

    let targetItem = null;
    setBarang(prev => prev.map(b => {
      if (Number(b.id) === parsedId) {
        targetItem = { ...b, stok: Number(b.stok) + parsedJumlah };
        return targetItem;
      }
      return b;
    }));

    // 1. Sync ke Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.patch(`/barang/${parsedId}/stok`, { jumlah_tambah: parsedJumlah });
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[tambahStokBarang] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase HANYA jika Backend offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured() && targetItem) {
      try {
        await supabase.from('barang').update({ stok: targetItem.stok }).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase update stok notice:', err);
      }
    }

    if (targetItem) {
      broadcastLiveSignal('barang_update', { id: parsedId, stok: targetItem.stok });
    }

    showToast(`Stok ${targetItem?.nama_barang || 'barang'} bertambah +${parsedJumlah} ${targetItem?.satuan || 'pcs'}!`, "success");
  }, [showToast, broadcastLiveSignal]);

  // CRUD Gudang (Barang dengan Pencegahan Duplikasi Item)
  const addBarang = useCallback(async (item) => {
    const cleanName = String(item.nama_barang || '').trim();
    if (!cleanName) return null;
    const incomingStok = parseInt(item.stok, 10) || 0;

    // 1. Cek apakah barang dengan nama yang sama persis sudah ada di gudang (Case-Insensitive)
    const existing = barang.find(b => String(b.nama_barang || '').trim().toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      // AKUMULASI STOK KE BARANG YANG SUDAH ADA (Cegah Duplikasi Baris di Gudang)
      const newStok = (Number(existing.stok) || 0) + incomingStok;
      await updateBarang(existing.id, {
        stok: newStok,
        satuan: item.satuan || existing.satuan
      });
      broadcastLiveSignal('barang_update', { id: existing.id, stok: newStok });
      showToast(`Stok '${existing.nama_barang}' berhasil ditambah +${incomingStok} ${existing.satuan} (Total sekarang: ${newStok})!`, "success");
      return { ...existing, stok: newStok };
    }

    // 2. Jika barang benar-benar baru di katalog master
    const newId = barang.length > 0 ? Math.max(...barang.map(b => Number(b.id) || 0)) + 1 : 1;
    const newItem = {
      id: newId,
      nama_barang: cleanName,
      stok: incomingStok,
      satuan: item.satuan || "pcs",
      kategori: item.kategori || "Aksesoris"
    };

    setBarang(prev => [newItem, ...prev]);

    // Jalur Utama: Sync ke Express Backend API (Express meng-insert ke Supabase & siar ke Telegram)
    let backendHandled = false;
    try {
      const res = await api.post('/barang', newItem);
      if (res.data?.success) {
        backendHandled = true;
        const realId = res.data?.data?.id || res.data?.data?.barang?.id;
        if (realId) {
          newItem.id = realId;
          setBarang(prev => prev.map(b => b.id === newId ? { ...b, id: realId } : b));
        }
      }
    } catch (apiErr) {
      console.warn('[addBarang] Backend API notice:', apiErr.message);
    }

    // Fallback Supabase jika backend offline
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        const { data } = await supabase.from('barang').insert([{
          nama_barang: newItem.nama_barang,
          stok: newItem.stok,
          satuan: newItem.satuan
        }]).select();

        if (data && data.length > 0) {
          newItem.id = data[0].id;
          setBarang(prev => prev.map(b => b.id === newId ? { ...b, id: data[0].id } : b));
        }
      } catch (err) {
        console.warn('Supabase insert barang error:', err);
      }
    }

    broadcastLiveSignal('barang_tambah', newItem);
    showToast(`Barang '${cleanName}' berhasil ditambahkan ke inventaris!`, "success");
    return newItem;
  }, [barang, updateBarang, showToast, broadcastLiveSignal]);

  const deleteBarang = useCallback(async (id) => {
    const parsedId = parseInt(id, 10);
    const targetItem = barang.find(b => Number(b.id) === parsedId);

    setBarang(prev => prev.filter(b => Number(b.id) !== parsedId));

    // Bersihkan SN audit jika item yang dihapus memiliki nomor seri / ONT
    if (targetItem?.nama_barang) {
      setOntSerials(prev => {
        const next = prev.filter(s => s.model?.toLowerCase() !== targetItem.nama_barang?.toLowerCase());
        try { localStorage.setItem('sto_ont_serials', JSON.stringify(next)); } catch {}
        return next;
      });
    }

    // 1. Sync ke Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.delete(`/barang/${parsedId}`);
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[deleteBarang] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase HANYA jika Backend offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        await supabase.from('barang').delete().eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase delete barang error:', err);
      }
    }

    // Siarkan realtime penghapusan barang & audit SN terkait
    broadcastLiveSignal('barang_hapus', { id: parsedId, nama_barang: targetItem?.nama_barang });

    showToast("Barang dihapus dari inventaris gudang!", "info");
  }, [barang, showToast, broadcastLiveSignal]);

  // Manajemen Serial Number ONT Realtime
  const addOntSerials = useCallback((entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    setOntSerials(prev => {
      const next = [...entries, ...prev.filter(p => !entries.some(n => n.sn === p.sn))];
      try { localStorage.setItem('sto_ont_serials', JSON.stringify(next)); } catch {}
      return next;
    });
    broadcastLiveSignal('ont_serials_sync', entries);
  }, [broadcastLiveSignal]);

  const deleteOntSerial = useCallback((sn) => {
    if (!sn) return;
    setOntSerials(prev => {
      const next = prev.filter(s => s.sn !== sn);
      try { localStorage.setItem('sto_ont_serials', JSON.stringify(next)); } catch {}
      return next;
    });
    broadcastLiveSignal('ont_serial_deleted', { sn });
  }, [broadcastLiveSignal]);

  // CRUD Penugasan / Tiket (Tugas)
  const updateTugas = useCallback(async (id, updatedFields) => {
    const parsedId = parseInt(id, 10);
    setTugas(prev => prev.map(t => Number(t.id) === parsedId ? { ...t, ...updatedFields } : t));

    // 1. Sync ke Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.put(`/tugas/${parsedId}`, updatedFields);
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[updateTugas] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase HANYA jika Backend offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        await supabase.from('tugas').update(updatedFields).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase update tugas error:', err);
      }
    }

    showToast(`Tiket #${parsedId} berhasil diperbarui!`, "success");
  }, [showToast]);

  const deleteTugas = useCallback(async (id) => {
    const parsedId = parseInt(id, 10);
    setTugas(prev => prev.filter(t => Number(t.id) !== parsedId));
    setPermohonan(prev => prev.filter(p => Number(p.tugas_id) !== parsedId));

    try {
      const doneList = JSON.parse(localStorage.getItem('sto_done_tasks') || '[]');
      const nextDone = doneList.filter(dId => Number(dId) !== parsedId);
      localStorage.setItem('sto_done_tasks', JSON.stringify(nextDone));
    } catch {}

    // Siarkan sinyal broadcast realtime ke seluruh teknisi seketika
    broadcastLiveSignal('tugas_dihapus', { tugas_id: parsedId });

    // 1. Sync ke Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.delete(`/tugas/${parsedId}`);
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[deleteTugas] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase HANYA jika Backend offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        const { data: perms } = await supabase.from('permohonan').select('id').eq('tugas_id', parsedId);
        if (perms && perms.length > 0) {
          const permIds = perms.map(p => p.id);
          await supabase.from('detail_permohonan').delete().in('permohonan_id', permIds);
          await supabase.from('permohonan').delete().eq('tugas_id', parsedId);
        }
        await supabase.from('tugas').delete().eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase delete tugas error:', err);
      }
    }

    showToast(`Tiket #${parsedId} berhasil dibatalkan / dihapus!`, "info");
  }, [broadcastLiveSignal, showToast]);

  const checkInTugas = useCallback(async (id, coords = {}) => {
    const parsedId = parseInt(id, 10);
    const lat = coords.latitude || -0.2289;
    const lng = coords.longitude || 100.6322;
    const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    // 1. Update state seketika
    setTugas(prev => prev.map(t => Number(t.id) === parsedId ? {
      ...t,
      checkin: { lat, lng, time: waktu, verified: true }
    } : t));

    // 2. Simpan ke local storage seketika
    try {
      const checkinMap = JSON.parse(localStorage.getItem('sto_checkin_tasks') || '{}');
      checkinMap[parsedId] = { lat, lng, time: waktu, verified: true };
      localStorage.setItem('sto_checkin_tasks', JSON.stringify(checkinMap));
    } catch {}

    showToast(`GPS Aktif Terverifikasi! Anda telah sampai di lokasi kerja (${lat.toFixed(4)}, ${lng.toFixed(4)}) pk ${waktu}.`, 'success');

    // 3. Supabase Realtime broadcast (Asinkron / Non-blocking)
    broadcastLiveSignal('teknisi_checkin', {
      tugas_id: parsedId,
      lat,
      lng,
      waktu,
      teknisi_nama: currentUser?.nama_lengkap || 'Teknisi Lapangan'
    });

    // 4. Jalur Utama: Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.post(`/tugas/${parsedId}/checkin`, {
        latitude: lat,
        longitude: lng,
        teknisi_nama: currentUser?.nama_lengkap || 'Teknisi Lapangan'
      });
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[checkInTugas] Backend API notice:', apiErr.message);
    }

    // 5. Fallback Supabase HANYA jika Backend offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        await supabase.from('tugas').update({
          status: 'Progress'
        }).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase checkin error:', err);
      }
    }
  }, [currentUser, broadcastLiveSignal, showToast]);

  const closeTugas = useCallback(async (id, closingData = {}) => {
    const parsedId = parseInt(id, 10);
    const targetTask = tugas.find(t => Number(t.id) === parsedId);
    const odpIdOrKode = closingData.odp_id || targetTask?.odp_id || targetTask?.odp_kode || 'ODP-PYK-FA/001';

    // 1. Eksekusi WebGIS Magic: Tambah port ODP & hitung threshold warna (Kuning/Merah)
    setOdp(prev => prev.map(o => {
      const match = Number(o.id) === Number(odpIdOrKode) || o.kode_odp?.toUpperCase() === String(odpIdOrKode).toUpperCase();
      if (match) {
        const kapasitas = o.kapasitas_port || 8;
        const newPort = Math.min(kapasitas, (o.port_terpakai || 0) + 1);
        const ratio = newPort / kapasitas;
        const newStatus = ratio >= 1.0 ? 'Penuh' : ratio >= 0.7 ? 'Hampir Penuh' : 'Tersedia';
        return { ...o, port_terpakai: newPort, status: newStatus };
      }
      return o;
    }));

    const proof = closingData.foto_ont || targetTask?.foto_bukti || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80';

    // 2. Update status tugas menjadi 'Done'
    setTugas(prev => prev.map(t => Number(t.id) === parsedId ? {
      ...t,
      status: 'Done',
      sn_ont: closingData.sn_ont || t.sn_ont || 'ZTEGC8B90112',
      sn_status: 'Active',
      redaman_dbm: closingData.redaman_dbm || -18.5,
      foto_bukti: proof,
      tanda_tangan_pelanggan: closingData.tanda_tangan_pelanggan,
      bastp_no: `BASTP/TA-PYK/2026/${String(parsedId).padStart(4, '0')}`,
      closed_at: new Date().toISOString()
    } : t));

    // Simpan ke sto_done_tasks
    try {
      const doneList = JSON.parse(localStorage.getItem('sto_done_tasks') || '[]');
      if (!doneList.includes(parsedId)) {
        doneList.push(parsedId);
        localStorage.setItem('sto_done_tasks', JSON.stringify(doneList));
      }
    } catch {}

    // 3. Jalur Utama: Panggil Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.put(`/tugas/${parsedId}/close`, {
        ...closingData,
        odp_id: odpIdOrKode,
        pelanggan_nama: targetTask?.pelanggan_nama
      });
      if (res.data?.success) {
        backendHandled = true;
        if (res.data?.data?.odp_updated) {
          setOdp(prev => prev.map(o => o.id === res.data.data.odp_updated.id ? res.data.data.odp_updated : o));
        }
      }
    } catch (apiErr) {
      console.warn('[closeTugas] Backend API notice:', apiErr.message);
    }

    // 4. Fallback ke Supabase HANYA jika Backend offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        await supabase.from('tugas').update({
          status: 'Done',
          foto_bukti: proof
        }).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase close tugas error:', err);
      }
    }

    showToast(`🔥 Tiket #${parsedId} Resmi Ditutup (Selesai)! Port ODP bertambah & WebGIS telah diperbarui!`, 'success');
  }, [tugas, showToast]);

  // CRUD WebGIS ODP (Optical Distribution Point)
  const addOdp = useCallback(async (odpData) => {
    const newId = odp.length > 0 ? Math.max(...odp.map(o => Number(o.id) || 0)) + 1 : 1;
    const newOdpItem = {
      id: newId,
      kode_odp: (odpData.kode_odp || `ODP-PYK-FA/${String(newId).padStart(3, '0')}`).toUpperCase().trim(),
      nama_lokasi: odpData.nama_lokasi || 'Titik Distribusi ODP Payakumbuh',
      latitude: parseFloat(odpData.latitude) || STO_COORDINATES.lat,
      longitude: parseFloat(odpData.longitude) || STO_COORDINATES.lng,
      kapasitas_port: parseInt(odpData.kapasitas_port, 10) || 8,
      port_terpakai: parseInt(odpData.port_terpakai, 10) || 0,
      redaman_dbm: parseFloat(odpData.redaman_dbm) || -18.5,
      status: odpData.status || 'Tersedia',
      keterangan: odpData.keterangan || ''
    };

    setOdp(prev => [newOdpItem, ...prev]);

    // 1. Jalur Utama: Sync ke Express Backend API (Express meng-insert ke Supabase)
    let backendHandled = false;
    try {
      const res = await api.post('/odp', newOdpItem);
      if (res.data?.success) {
        backendHandled = true;
        const realId = res.data?.data?.id || res.data?.data?.odp?.id;
        if (realId) {
          setOdp(prev => prev.map(o => o.id === newId ? { ...o, id: realId } : o));
        }
      }
    } catch (apiErr) {
      console.warn('[addOdp] Backend API notice:', apiErr.message);
    }

    // 2. Direct Supabase Fallback (hanya jika Backend API offline untuk mencegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        const supabasePayload = {
          kode_odp: newOdpItem.kode_odp,
          alamat: newOdpItem.alamat || newOdpItem.nama_lokasi || 'Koto Nan IV Payakumbuh',
          latitude: newOdpItem.latitude,
          longitude: newOdpItem.longitude,
          kapasitas_port: newOdpItem.kapasitas_port,
          port_terpakai: newOdpItem.port_terpakai,
          status: newOdpItem.status
        };

        const { data } = await supabase.from('odp').insert([supabasePayload]).select();
        if (data && data.length > 0) {
          setOdp(prev => prev.map(o => o.id === newId ? { ...o, id: data[0].id, alamat: data[0].alamat, nama_lokasi: data[0].alamat } : o));
        }
      } catch (err) {
        console.warn('Supabase insert ODP notice:', err);
      }
    }

    showToast(`Titik ODP '${newOdpItem.kode_odp}' berhasil didaftarkan ke WebGIS!`, "success");
    return newOdpItem;
  }, [odp, showToast]);

  const updateOdp = useCallback(async (id, updatedFields) => {
    const parsedId = parseInt(id, 10);
    setOdp(prev => prev.map(o => Number(o.id) === parsedId ? { ...o, ...updatedFields } : o));

    // 1. Sync ke Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.put(`/odp/${parsedId}`, updatedFields);
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[updateOdp] Backend API notice:', apiErr.message);
    }

    // 2. Fallback Supabase HANYA jika Backend offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        const supabaseUpdate = {};
        if (updatedFields.kode_odp !== undefined) supabaseUpdate.kode_odp = updatedFields.kode_odp;
        if (updatedFields.alamat !== undefined) supabaseUpdate.alamat = updatedFields.alamat;
        if (updatedFields.nama_lokasi !== undefined && !supabaseUpdate.alamat) supabaseUpdate.alamat = updatedFields.nama_lokasi;
        if (updatedFields.latitude !== undefined) supabaseUpdate.latitude = parseFloat(updatedFields.latitude);
        if (updatedFields.longitude !== undefined) supabaseUpdate.longitude = parseFloat(updatedFields.longitude);
        if (updatedFields.kapasitas_port !== undefined) supabaseUpdate.kapasitas_port = parseInt(updatedFields.kapasitas_port, 10);
        if (updatedFields.port_terpakai !== undefined) supabaseUpdate.port_terpakai = parseInt(updatedFields.port_terpakai, 10);
        if (updatedFields.status !== undefined) supabaseUpdate.status = updatedFields.status;

        await supabase.from('odp').update(supabaseUpdate).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase update ODP notice:', err);
      }
    }

    showToast("Data titik ODP berhasil diperbarui!", "success");
  }, [showToast]);

  const deleteOdp = useCallback(async (id) => {
    const parsedId = parseInt(id, 10);
    setOdp(prev => prev.filter(o => Number(o.id) !== parsedId));

    // 1. Sync ke Express Backend API (Single Source of Truth)
    let backendHandled = false;
    try {
      const res = await api.delete(`/odp/${parsedId}`);
      if (res.data?.success) {
        backendHandled = true;
      }
    } catch (apiErr) {
      console.warn('[deleteOdp] Backend API notice:', apiErr.message);
    }

    // 2. Fallback Supabase HANYA jika Backend offline (cegah dual-write)
    if (!backendHandled && isSupabaseConfigured()) {
      try {
        await supabase.from('odp').delete().eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase delete ODP notice:', err);
      }
    }

    showToast("Titik ODP berhasil dihapus dari WebGIS!", "info");
  }, [showToast]);

  // User Management & Verifikasi Registrasi Pegawai STO
  const addUser = useCallback(async (userData) => {
    const newId = users.length > 0 ? Math.max(...users.map(u => Number(u.id) || 0)) + 1 : 1;
    const isCodeValid = userData.auth_code?.trim() === STO_CORPORATE_TOKEN || userData.auth_code?.trim() === 'STO2026';
    const statusVerifikasi = userData.status_verifikasi || (isCodeValid ? 'Verified' : 'Pending Approval');

    const newUser = {
      id: newId,
      nama_lengkap: userData.nama_lengkap,
      email: userData.email.toLowerCase().trim(),
      password: userData.password || 'password123',
      role: userData.role || 'teknisi',
      status_verifikasi: statusVerifikasi,
      nik_pegawai: userData.nik_pegawai || `NIK-TA-${newId}`,
      jabatan: userData.role === 'pimpinan'
        ? 'Manager STO Wilayah'
        : userData.role === 'gudang'
        ? 'Staff Logistik & Inventaris'
        : 'Teknisi Lapangan'
    };

    setUsers(prev => [...prev, newUser]);

    // 1. Registrasi via Backend API STO agar password otomatis dienkripsi Bcrypt
    let registeredViaBackend = false;
    try {
      const res = await api.post('/auth/register', {
        nama_lengkap: newUser.nama_lengkap,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role
      });
      if (res.data?.success && res.data?.data?.user) {
        const backendUser = res.data.data.user;
        setUsers(prev => prev.map(u => u.id === newId ? { ...u, id: backendUser.id } : u));
        registeredViaBackend = true;
      }
    } catch (backendErr) {
      console.warn('Backend register fallback to Supabase:', backendErr.message);
    }

    // 2. Fallback insert langsung ke Supabase jika backend offline
    if (!registeredViaBackend && isSupabaseConfigured()) {
      try {
        const { data } = await supabase.from('users').insert([{
          nama_lengkap: newUser.nama_lengkap,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role
        }]).select();

        if (data && data.length > 0) {
          setUsers(prev => prev.map(u => u.id === newId ? { ...u, id: data[0].id } : u));
        }
      } catch (err) {
        console.warn('Supabase add user error:', err);
      }
    }

    if (statusVerifikasi === 'Verified') {
      showToast(`Akun ${newUser.nama_lengkap} (${newUser.role}) berhasil didaftarkan dan terverifikasi!`, 'success');
    } else {
      showToast(`Pendaftaran akun ${newUser.nama_lengkap} berhasil dikirim! Menunggu persetujuan Pimpinan STO.`, 'info');
    }

    return newUser;
  }, [users, showToast]);

  const approveUser = useCallback(async (userId) => {
    const parsedId = parseInt(userId, 10);
    const target = users.find(u => Number(u.id) === parsedId);
    
    // 1. Update State Lokal segera
    setUsers(prev => {
      const updated = prev.map(u => {
        if (Number(u.id) === parsedId) {
          return { ...u, status_verifikasi: 'Verified' };
        }
        return u;
      });
      try { localStorage.setItem('sto_users', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // 2. Update status ke Database Supabase Realtime
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('users').update({ status_verifikasi: 'Verified' }).eq('id', parsedId);
      } catch (err) {
        console.warn('[Supabase Approve User Notice]:', err.message);
      }
    }

    // 3. Sync via Backend API jika aktif
    try {
      await api.patch(`/users/${parsedId}`, { status_verifikasi: 'Verified' });
    } catch {}

    broadcastLiveSignal('user_updated', { id: parsedId, status_verifikasi: 'Verified' });
    showToast(`Akun ${target?.nama_lengkap || `#${parsedId}`} berhasil DISETUJUI & diverifikasi Pimpinan!`, 'success');
  }, [users, showToast, broadcastLiveSignal]);

  const rejectUser = useCallback(async (userId) => {
    const parsedId = parseInt(userId, 10);
    const target = users.find(u => Number(u.id) === parsedId);

    // 1. Update State Lokal segera (hapus dari memori & localStorage)
    setUsers(prev => {
      const updated = prev.filter(u => Number(u.id) !== parsedId);
      try { localStorage.setItem('sto_users', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // 2. Hapus Permanen dari Supabase Database (mencegah akun balik lagi saat sinkronisasi realtime)
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('users').delete().eq('id', parsedId);
      } catch (err) {
        console.warn('[Supabase Delete User Notice]:', err.message);
      }
    }

    // 3. Hapus via Backend API jika aktif
    try {
      await api.delete(`/users/${parsedId}`);
    } catch {}

    broadcastLiveSignal('user_deleted', { id: parsedId });
    showToast(`Akun ${target?.nama_lengkap || `#${parsedId}`} berhasil dihapus permanen dari sistem & database!`, 'info');
  }, [users, showToast, broadcastLiveSignal]);

  const removeGpsEntry = useCallback((teknisiId) => {
    const parsedId = parseInt(teknisiId, 10);
    setTrackingGps(prev => prev.filter(g => Number(g.teknisi_id) !== parsedId));
    showToast(`Teknisi #${parsedId} berhasil dihapus dari tim lapangan`, 'info');
  }, [showToast]);

  const resetGpsTracking = useCallback(() => {
    localStorage.removeItem('sto_trackingGps');
    setTrackingGps(initialTrackingGps);
    showToast('Seluruh data GPS armada berhasil di-reset dan dibersihkan dari duplikasi!', 'success');
  }, [showToast]);

  // Reset State to Default Factory
  const resetToFactoryDefault = useCallback(() => {
    localStorage.clear();
    setUsers(initialUsers);
    setBarang(initialBarang);
    setTugas(initialTugas);
    setPermohonan(initialPermohonan);
    setDetailPermohonan(initialDetailPermohonan);
    setTrackingGps(initialTrackingGps);
    setOdp(initialOdp);
    setCurrentUser(initialUsers[0]);
    setCurrentView('pimpinan');
    showToast("Semua data berhasil direset ke pengaturan awal pabrik!", "info");
  }, [showToast]);

  // =========================================================================
  // MEMOIZED HIGH-PERFORMANCE COMPUTATIONS (useMemo)
  // =========================================================================
  const openTasks = useMemo(() => {
    return tugas.filter(t => {
      const s = String(t.status || '').toLowerCase().trim();
      return s === 'open' || s === 'menunggu';
    });
  }, [tugas]);

  const myActiveTasks = useMemo(() => {
    if (!currentUser?.id) return [];
    return tugas.filter(t => {
      const isMyTask = Number(t.teknisi_id) === Number(currentUser.id);
      const s = String(t.status || '').toLowerCase().trim();
      return isMyTask && (s === 'progress' || s === 'in_progress' || s === 'assigned' || s === 'menunggu_material' || s === 'pengerjaan');
    });
  }, [tugas, currentUser?.id]);

  const doneTasks = useMemo(() => {
    return tugas.filter(t => {
      const s = String(t.status || '').toLowerCase().trim();
      return s === 'done' || s === 'closed' || s === 'selesai';
    });
  }, [tugas]);

  const stokKritis = useMemo(() => {
    return barang.filter(b => (Number(b.stok) || 0) <= 10);
  }, [barang]);

  const summaryKpi = useMemo(() => {
    const totalTugas = tugas.length;
    const totalDone = doneTasks.length;
    const totalOpen = openTasks.length;
    const totalProgress = tugas.filter(t => {
      const s = String(t.status || '').toLowerCase().trim();
      return s === 'progress' || s === 'in_progress';
    }).length;
    const totalPermohonanPending = permohonan.filter(p => p.status === 'Pending').length;
    const totalPermohonanApproved = permohonan.filter(p => p.status === 'Approved').length;
    const totalBarangKritis = stokKritis.length;

    return {
      totalTugas,
      totalDone,
      totalOpen,
      totalProgress,
      persentaseSelesai: totalTugas > 0 ? Math.round((totalDone / totalTugas) * 100) : 0,
      totalPermohonanPending,
      totalPermohonanApproved,
      totalBarangKritis
    };
  }, [tugas, doneTasks.length, openTasks.length, permohonan, stokKritis.length]);

  // =========================================================================
  // MEMOIZED CONTEXT VALUE OBJECT
  // =========================================================================
  const contextValue = useMemo(() => ({
    isOnline,
    syncStatus,
    lastSyncedAt,
    refreshData: fetchRealData,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    currentUser,
    setCurrentUser,
    currentView,
    setCurrentView,
    users,
    setUsers,
    addUser,
    approveUser,
    rejectUser,
    STO_CORPORATE_TOKEN,
    pelanggan,
    setPelanggan,
    saldoTeknisi,
    setSaldoTeknisi,
    barang,
    tugas,
    setTugas,
    claimTugas,
    checkInTugas,
    closeTugas,
    updateTugas,
    deleteTugas,
    permohonan,
    detailPermohonan,
    trackingGps,
    odp,
    setOdp,
    addOdp,
    updateOdp,
    deleteOdp,
    STO_COORDINATES,
    notification,
    setNotification,
    showToast,
    login,
    loginAsRole,
    logout,
    createTugas,
    requestMaterial,
    approveMaterial,
    rejectMaterial,
    releaseMaterial,
    updateGpsLocation,
    simulateTechnicianStep,
    removeGpsEntry,
    resetGpsTracking,
    finishTugas,
    addBarang,
    updateBarang,
    tambahStokBarang,
    deleteBarang,
    ontSerials,
    addOntSerials,
    deleteOntSerial,
    resetToFactoryDefault,
    // Memoized helpers for child components
    openTasks,
    myActiveTasks,
    doneTasks,
    stokKritis,
    summaryKpi
  }), [
    isOnline,
    syncStatus,
    lastSyncedAt,
    fetchRealData,
    sidebarCollapsed,
    toggleSidebar,
    currentUser,
    currentView,
    users,
    addUser,
    approveUser,
    rejectUser,
    pelanggan,
    saldoTeknisi,
    barang,
    tugas,
    setTugas,
    claimTugas,
    checkInTugas,
    closeTugas,
    updateTugas,
    deleteTugas,
    permohonan,
    detailPermohonan,
    trackingGps,
    odp,
    addOdp,
    updateOdp,
    deleteOdp,
    notification,
    showToast,
    login,
    loginAsRole,
    logout,
    createTugas,
    requestMaterial,
    approveMaterial,
    rejectMaterial,
    releaseMaterial,
    updateGpsLocation,
    simulateTechnicianStep,
    removeGpsEntry,
    resetGpsTracking,
    finishTugas,
    addBarang,
    updateBarang,
    tambahStokBarang,
    deleteBarang,
    ontSerials,
    addOntSerials,
    deleteOntSerial,
    resetToFactoryDefault,
    openTasks,
    myActiveTasks,
    doneTasks,
    stokKritis,
    summaryKpi
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
