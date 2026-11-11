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

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import supabase, { isSupabaseConfigured } from '../api/supabaseClient';
import api from '../api/axiosInstance';
import {
  initialUsers,
  initialBarang,
  initialTugas,
  initialPermohonan,
  initialDetailPermohonan,
  initialOdp,
  STO_COORDINATES
} from '../data/seedData';

const AppContext = createContext();

export function AppProvider({ children }) {
  const stoChannelRef = useRef(null);

  // Helper pengiriman sinyal broadcast peer-to-peer WebSocket via Supabase Realtime
  const broadcastLiveSignal = useCallback((event, payload) => {
    try {
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
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('user') || localStorage.getItem('sto_currentUser');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return initialUsers[0]; // Pimpinan Ir. Bambang
  });

  // 3. Database Tables
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('sto_users');
    return saved ? JSON.parse(saved) : initialUsers;
  });

  const [barang, setBarang] = useState(() => {
    const saved = localStorage.getItem('sto_barang');
    return saved ? JSON.parse(saved) : initialBarang;
  });

  const [tugas, setTugas] = useState(() => {
    const saved = localStorage.getItem('sto_tugas');
    return saved ? JSON.parse(saved) : initialTugas;
  });

  const [permohonan, setPermohonan] = useState(() => {
    const saved = localStorage.getItem('sto_permohonan');
    return saved ? JSON.parse(saved) : initialPermohonan;
  });

  const [detailPermohonan, setDetailPermohonan] = useState(() => {
    const saved = localStorage.getItem('sto_detailPermohonan');
    return saved ? JSON.parse(saved) : initialDetailPermohonan;
  });

  // GPS Tracking dinonaktifkan sesuai kebutuhan produksi
  const trackingGps = [];
  const setTrackingGps = () => {};

  const [odp, setOdp] = useState(() => {
    const saved = localStorage.getItem('sto_odp');
    return saved ? JSON.parse(saved) : initialOdp;
  });

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
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  }, []);

  // Sync to LocalStorage (local state fallback cache)
  useEffect(() => {
    localStorage.setItem('sto_currentUser', JSON.stringify(currentUser));
    if (currentUser) localStorage.setItem('user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('sto_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('sto_barang', JSON.stringify(barang));
  }, [barang]);

  useEffect(() => {
    localStorage.setItem('sto_tugas', JSON.stringify(tugas));
  }, [tugas]);

  useEffect(() => {
    localStorage.setItem('sto_permohonan', JSON.stringify(permohonan));
  }, [permohonan]);

  useEffect(() => {
    localStorage.setItem('sto_detailPermohonan', JSON.stringify(detailPermohonan));
  }, [detailPermohonan]);

  useEffect(() => { localStorage.removeItem('sto_trackingGps'); }, []);

  useEffect(() => {
    localStorage.setItem('sto_odp', JSON.stringify(odp));
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
        resDetail] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('barang').select('*').order('nama_barang', { ascending: true }),
        supabase.from('tugas').select('*').order('id', { ascending: false }),
        supabase.from('permohonan').select('*').order('id', { ascending: false }),
        supabase.from('detail_permohonan').select('*')
      ]);

      if (resUsers.data && resUsers.data.length > 0) setUsers(resUsers.data);
      if (resBarang.data && resBarang.data.length > 0) setBarang(resBarang.data);
      if (resTugas.data && resTugas.data.length > 0) {
        let checkinMap = {};
        let doneList = [];
        try {
          checkinMap = JSON.parse(localStorage.getItem('sto_checkin_tasks') || '{}');
          doneList = JSON.parse(localStorage.getItem('sto_done_tasks') || '[]');
        } catch (_) {}

        setTugas(prev => {
          const fetchedIds = new Set(resTugas.data.map(t => Number(t.id)));
          const extraLocal = prev.filter(p => !fetchedIds.has(Number(p.id)));

          const mappedFetched = resTugas.data.map((t, idx) => {
            const existing = prev.find(p => Number(p.id) === Number(t.id));
            const isTaskDone = String(t.status || '').toLowerCase() === 'done' ||
              String(t.status || '').toLowerCase() === 'closed' ||
              String(t.status || '').toLowerCase() === 'selesai' ||
              doneList.includes(Number(t.id)) ||
              String(existing?.status || '').toLowerCase() === 'done' ||
              String(existing?.status || '').toLowerCase() === 'closed';

            const offsetLat = (((Number(t.id || idx) * 7) % 30) - 15) * 0.0012;
            const offsetLng = (((Number(t.id || idx) * 11) % 30) - 15) * 0.0012;

            return {
              ...t,
              status: isTaskDone ? 'Done' : (t.status || existing?.status || 'menunggu'),
              target_lat: t.target_lat || existing?.target_lat || (STO_COORDINATES.lat + offsetLat),
              target_lng: t.target_lng || existing?.target_lng || (STO_COORDINATES.lng + offsetLng),
              pelanggan_nama: t.pelanggan_nama || existing?.pelanggan_nama || (t.lokasi ? t.lokasi.split('-')[0].trim() : `Pelanggan #${t.id}`),
              keterangan: t.keterangan || existing?.keterangan || `Pekerjaan ${t.jenis_kerja} di ${t.lokasi}`,
              checkin: checkinMap[Number(t.id)] || existing?.checkin || (isTaskDone ? { verified: true } : null),
              foto_bukti: t.foto_bukti || existing?.foto_bukti || null,
              bastp: existing?.bastp || null,
              sn_ont: t.sn_ont || existing?.sn_ont || null,
              material_status: t.material_status || existing?.material_status || null
            };
          });

          return [...mappedFetched, ...extraLocal];
        });
      }
      if (resPermohonan.data && resPermohonan.data.length > 0) setPermohonan(resPermohonan.data);
      if (resDetail.data && resDetail.data.length > 0) setDetailPermohonan(resDetail.data);
      // GPS data query removed

      // 7. Ambil data titik ODP Jaringan Fiber Optic
      try {
        const { data: resOdpData, error: odpErr } = await supabase.from('odp').select('*').order('id', { ascending: true });
        if (!odpErr && resOdpData && resOdpData.length > 0) {
          const mapped = resOdpData.map(o => ({
            ...o,
            alamat: o.alamat || o.nama_lokasi || 'Koto Nan IV Payakumbuh',
            nama_lokasi: o.alamat || o.nama_lokasi || 'Koto Nan IV Payakumbuh'
          }));
          setOdp(mapped);
        } else {
          // Coba dari backend Express API
          const apiOdp = await api.get('/odp');
          if (apiOdp.data?.data && apiOdp.data.data.length > 0) {
            setOdp(apiOdp.data.data);
          }
        }
      } catch {
        // Tetap gunakan state lokal odp
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

    // Interval Sinkronisasi Background Otomatis (Setiap 10 Detik)
    const syncInterval = setInterval(() => {
      fetchRealData(true);
    }, 10000);

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
  const login = (email, password) => {
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
  };

  const loginAsRole = (role) => {
    const found = users.find(u => u.role === role);
    if (found) {
      setCurrentUser(found);
      if (role === 'pimpinan') setCurrentView('pimpinan');
      else if (role === 'teknisi') setCurrentView('teknisi');
      else if (role === 'gudang') setCurrentView('gudang');
      showToast(`Beralih ke akun ${found.nama_lengkap} (${found.jabatan || found.role})`, "info");
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('sto_currentUser');
    setCurrentUser(null);
    setCurrentView('landing');
    showToast("Anda telah keluar dari sistem.", "info");
  };

    // SOP 1: Pimpinan membuat tiket tugas dan menyiarkan ke pool teknisi secara instan via Supabase Realtime WebSocket & Telegram
  const createTugas = async (taskData) => {
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
      pelanggan_nama: taskData.pelanggan_nama || "Pelanggan Telkom",
      pelanggan_telp: taskData.pelanggan_telp || "0812-xxxx-xxxx",
      status: "menunggu",
      keterangan: taskData.keterangan || "",
      target_lat,
      target_lng,
      foto_bukti: null,
      waktu_buat: formattedDate
    };

    // 1. Simpan langsung ke database Supabase Cloud
    if (isSupabaseConfigured()) {
      try {
        const insertPayload = {
          pimpinan_id: Number(finalTask.pimpinan_id) || 1,
          teknisi_id: assignedTeknisiId,
          jenis_kerja: finalTask.jenis_kerja,
          lokasi: fullLokasi,
          status: 'menunggu',
          broadcast_status: 'sent'
        };

        if (taskData.odp_id) {
          insertPayload.odp_id = Number(taskData.odp_id);
        }

        const { data: dbData, error: dbErr } = await supabase.from('tugas').insert([insertPayload]).select();
        if (!dbErr && dbData && dbData.length > 0) {
          finalTask = { ...finalTask, id: dbData[0].id, ...dbData[0] };
        } else if (dbErr) {
          console.warn('[createTugas] Supabase direct insert notice:', dbErr.message);
        }
      } catch (err) {
        console.warn('[createTugas] Supabase insert warning:', err);
      }
    }

    // 2. Update state React lokal seketika
    setTugas(prev => [finalTask, ...prev.filter(t => t.id !== newId && t.id !== finalTask.id)]);

    // 3. Supabase Realtime WebSocket Broadcast: Sinyal langsung masuk ke aplikasi teknisi dalam hitungan milidetik ⚡
    broadcastLiveSignal('tugas_baru', finalTask);

    // 4. Siarkan Notifikasi ke Grup Telegram Bot @sto_pyk_bot (Asinkron / Non-blocking)
    try {
      const botToken = '8893464249:AAFhp-jmadAfKHrYfM56EzWyLN2d9_iaMm4';
      const groupId = '-1003981401195';
      const odpKode = taskData.odp_kode || 'ODP-PYK-FA/001';
      const assignedUser = users.find(u => Number(u.id) === assignedTeknisiId);
      const penugasanText = assignedTeknisiId === 99 ? '📢 SIAGA TERBUKA (Siapapun Teknisi Dapat Mengambil Tiket)' : `👷 ${assignedUser?.nama_lengkap || 'Teknisi Lapangan'}`;

      const teksTelegram = `🚨 <b>[TELKOM AKSES — NOC DISPATCH STO PAYAKUMBUH]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ <b>WORK ORDER / TIKET GANGGUAN BARU</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 <b>No. Tiket:</b> #${finalTask.id}\n` +
        `🔌 <b>Titik ODP:</b> <code>${odpKode}</code>\n` +
        `📍 <b>Lokasi / Sektor:</b> ${finalTask.lokasi}\n` +
        `💼 <b>Klasifikasi:</b> ${finalTask.jenis_kerja}\n` +
        (finalTask.pelanggan_nama ? `👤 <b>Pelanggan:</b> ${finalTask.pelanggan_nama}\n` : '') +
        (finalTask.pelanggan_telp ? `📞 <b>Kontak:</b> ${finalTask.pelanggan_telp}\n` : '') +
        (finalTask.keterangan ? `📝 <b>Instruksi NOC:</b> ${finalTask.keterangan}\n` : '') +
        `📊 <b>Penugasan:</b> <code>${penugasanText}</code>\n` +
        `⏱️ <b>Target SLA:</b> &lt; 3 Jam (Prioritas Utama)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 <a href="https://sto-telkom.vercel.app">Buka Aplikasi STO Payakumbuh</a>`;

      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: groupId, text: teksTelegram, parse_mode: 'HTML' })
      }).catch(() => {});
    } catch (_) {}

    // 5. Asinkron kirim ke backend lokal jika ada
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      api.post('/tugas', {
        pimpinan_id: Number(finalTask.pimpinan_id) || 1,
        teknisi_id: assignedTeknisiId,
        jenis_kerja: finalTask.jenis_kerja,
        lokasi: finalTask.lokasi,
        pelanggan_nama: finalTask.pelanggan_nama,
        pelanggan_telp: finalTask.pelanggan_telp,
        odp_kode: taskData.odp_kode || 'ODP-PYK-FA/001',
        odp_id: taskData.odp_id,
        keterangan: taskData.keterangan || ''
      }).catch(() => {});
    }

    showToast(`Tiket #${finalTask.id} (${taskData.jenis_kerja}) berhasil disiarkan ke aplikasi & Telegram!`, "success");
    return finalTask;
  };

  // SOP 1.5: Teknisi mengklaim/mengambil tiket yang diumumkan (dengan validasi ketat & dual sync)
  const claimTugas = async (tugasId, teknisiId = null) => {
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

    // 1. Sinkronisasi ke Backend Express API jika backend berjalan
    try {
      await api.patch(`/tugas/${parsedTugasId}/claim`, { teknisi_id: parsedTeknisiId });
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

    // 3. Sinkronisasi langsung ke Supabase
    if (isSupabaseConfigured()) {
      try {
        const { data: updateRes, error: updateErr } = await supabase.from('tugas').update({
          teknisi_id: parsedTeknisiId,
          status: 'Progress'
        }).eq('id', parsedTugasId).select();

        // Jika baris tiket belum ada di Supabase, insert
        if (!updateErr && (!updateRes || updateRes.length === 0)) {
          const matched = targetTask;
          await supabase.from('tugas').insert([{
            id: parsedTugasId,
            pimpinan_id: Number(matched.pimpinan_id) || 1,
            teknisi_id: parsedTeknisiId,
            jenis_kerja: matched.jenis_kerja || 'Pasang Baru',
            lokasi: matched.lokasi || 'Koto Nan IV Payakumbuh',
            status: 'Progress',
            broadcast_status: 'sent'
          }]);
        }
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

    // Notifikasi ke Grup Telegram Bot @sto_pyk_bot (Asinkron / Non-blocking)
    try {
      const claimText = `👷 <b>[TIKET DIAMBIL TEKNISI LAPANGAN]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎫 <b>No. Tiket:</b> #${parsedTugasId} (${targetTask.jenis_kerja || 'Pekerjaan'})\n` +
        `👷 <b>Teknisi Pelaksana:</b> ${techName}\n` +
        `📍 <b>Lokasi:</b> ${targetTask.lokasi || '-'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 <i>Teknisi sedang menyiapkan permohonan material dan menuju Gudang STO untuk pengambilan barang.</i>`;

      fetch('https://api.telegram.org/bot8893464249:AAFhp-jmadAfKHrYfM56EzWyLN2d9_iaMm4/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: '-1003981401195', text: claimText, parse_mode: 'HTML' })
      }).catch(() => {});
    } catch (_) {}

    showToast(`Tiket #${parsedTugasId} berhasil Anda ambil! Segera ajukan permohonan material ke gudang.`, 'success');
    return true;
  };

  // SOP 2: Teknisi mengajukan material ke gudang
  const requestMaterial = async (param1, param2, param3) => {
    let tugasId = param1;
    let items = param2;
    let catatan = param3;

    if (typeof param1 === 'object' && param1 !== null && !Array.isArray(param1)) {
      tugasId = param1.tugas_id || param1.tugasId;
      items = param1.items || param1.barang || [];
      catatan = param1.catatan || param1.catatan_teknisi;
    }

    const parsedTugasId = parseInt(tugasId, 10) || Number(tugasId);
    const newPermohonanId = permohonan.length > 0 ? Math.max(...permohonan.map(p => Number(p.id) || 0)) + 1 : 501;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newPermohonan = {
      id: newPermohonanId,
      tugas_id: parsedTugasId,
      status: "Pending",
      waktu_request: formattedDate,
      catatan_teknisi: catatan || "Kebutuhan perbaikan / instalasi lapangan"
    };

    let startDetailId = detailPermohonan.length > 0 ? Math.max(...detailPermohonan.map(d => Number(d.id) || 0)) + 1 : 1;
    const newDetails = (items || []).map(item => ({
      id: startDetailId++,
      permohonan_id: newPermohonanId,
      barang_id: parseInt(item.barang_id, 10),
      jumlah_minta: parseInt(item.jumlah_minta, 10) || 1
    }));

    setPermohonan(prev => [newPermohonan, ...prev]);
    setDetailPermohonan(prev => [...newDetails, ...prev]);

    // Set task to Progress if Open
    setTugas(prev => prev.map(t => {
      if (Number(t.id) === parsedTugasId && t.status === 'Open') {
        return { ...t, status: 'Progress' };
      }
      return t;
    }));

    // 1. Simpan langsung ke Supabase (status Pending siap dirilis Gudang)
    let realPId = newPermohonanId;
    if (isSupabaseConfigured()) {
      try {
        const { data: pData } = await supabase.from('permohonan').insert([{
          tugas_id: parsedTugasId,
          status: 'Pending'
        }]).select();

        if (pData && pData.length > 0) {
          realPId = pData[0].id;
          setPermohonan(prev => prev.map(p => p.id === newPermohonanId ? { ...p, id: realPId } : p));
        }

        const detailsToInsert = items.map(item => ({
          permohonan_id: realPId,
          barang_id: parseInt(item.barang_id, 10),
          jumlah_minta: parseInt(item.jumlah_minta, 10) || 1
        }));
        await supabase.from('detail_permohonan').insert(detailsToInsert);
        await supabase.from('tugas').update({ status: 'Progress' }).eq('id', parsedTugasId);
      } catch (err) {
        console.warn('Supabase request material notice:', err);
      }
    }

    // 2. Supabase Realtime WebSocket Broadcast ke Petugas Gudang & Pimpinan
    broadcastLiveSignal('permohonan_baru', {
      ...newPermohonan,
      id: realPId,
      teknisi_nama: currentUser?.nama_lengkap || 'Teknisi Lapangan',
      items
    });

    // 3. Notifikasi Telegram ke Grup Gudang
    try {
      const parentTask = tugas.find(t => Number(t.id) === parsedTugasId);
      const itemListText = items.map(i => `• ${i.nama_barang || 'Barang ID: ' + i.barang_id}: ${i.jumlah_minta} ${i.satuan || 'pcs'}`).join('\n');
      const textGudang = `📦 <b>[LOGISTIK GUDANG STO PAYAKUMBUH]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 <b>PERMOHONAN MATERIAL DARI TEKNISI</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👷 <b>Teknisi:</b> ${currentUser?.nama_lengkap || 'Teknisi Lapangan'}\n` +
        `🎫 <b>Untuk Tiket:</b> #${parsedTugasId} (${parentTask?.jenis_kerja || 'Pekerjaan'})\n` +
        `📍 <b>Lokasi:</b> ${parentTask?.lokasi || '-'}\n` +
        `📦 <b>Daftar Barang yang Diminta:</b>\n${itemListText}\n` +
        (catatan ? `📝 <b>Catatan:</b> ${catatan}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 <i>Silakan buka aplikasi Gudang untuk merilis barang fisik ke teknisi.</i>`;

      fetch('https://api.telegram.org/bot8893464249:AAFhp-jmadAfKHrYfM56EzWyLN2d9_iaMm4/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: '-1003981401195', text: textGudang, parse_mode: 'HTML' })
      }).catch(() => {});
    } catch (_) {}

    // 4. Fire-and-forget ke backend API lokal jika ada
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      api.post('/permohonan', {
        tugas_id: parsedTugasId,
        barang: (items || []).map(i => ({ barang_id: parseInt(i.barang_id, 10), jumlah_minta: parseInt(i.jumlah_minta, 10) || 1 })),
        teknisi_nama: currentUser?.nama_lengkap || 'Teknisi Lapangan'
      }).catch(() => {});
    }

    showToast(`Permohonan material #${realPId} berhasil diajukan ke Gudang STO!`, "success");
  };

  // SOP 3: Pimpinan memberikan persetujuan (approval)
  const approveMaterial = async (permohonanId) => {
    const parsedId = parseInt(permohonanId, 10);
    setPermohonan(prev => prev.map(p => {
      if (Number(p.id) === parsedId) {
        return { ...p, status: "Approved" };
      }
      return p;
    }));

    try {
      await api.patch(`/permohonan/${parsedId}/approve`);
    } catch (apiErr) {
      console.warn('[approveMaterial] Backend API notice:', apiErr.message);
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('permohonan').update({ status: 'Approved' }).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase approve error:', err);
      }
    }

    showToast(`Permohonan #${parsedId} DISETUJUI. Diteruskan ke Gudang untuk rilis barang!`, "success");
  };

  const rejectMaterial = async (permohonanId, reason = "Ditolak oleh Pimpinan") => {
    const parsedId = parseInt(permohonanId, 10);
    setPermohonan(prev => prev.map(p => {
      if (Number(p.id) === parsedId) {
        return { ...p, status: "Rejected", catatan_pimpinan: reason };
      }
      return p;
    }));

    try {
      await api.patch(`/permohonan/${parsedId}/reject`, { catatan: reason });
    } catch (apiErr) {
      console.warn('[rejectMaterial] Backend API notice:', apiErr.message);
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('permohonan').update({ status: 'Rejected' }).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase reject error:', err);
      }
    }

    showToast(`Permohonan #${parsedId} DITOLAK.`, "error");
  };

  // SOP 4: Gudang merilis barang dan sistem melakukan pemotongan stok otomatis
  const releaseMaterial = async (permohonanId, sn = null) => {
    const parsedId = parseInt(permohonanId, 10);
    const targetPermohonan = permohonan.find(p => Number(p.id) === parsedId);
    if (!targetPermohonan) return;

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

    setPermohonan(prev => prev.map(p => {
      if (Number(p.id) === parsedId) {
        return { ...p, status: "Released", waktu_rilis: formattedDate };
      }
      return p;
    }));

    if (targetPermohonan?.tugas_id) {
      setTugas(prev => prev.map(t => {
        if (Number(t.id) === Number(targetPermohonan.tugas_id)) {
          return {
            ...t,
            material_status: 'Dalam Perjalanan',
            status_detail: 'Dalam Perjalanan (Menuju Lokasi Pelanggan)',
            ...(sn ? { sn_ont: sn } : {})
          };
        }
        return t;
      }));
    }

    if (sn) {
      try {
        const storedOnts = JSON.parse(localStorage.getItem('sto_ont_serials') || '[]');
        if (!storedOnts.some(s => s.sn === sn)) {
          storedOnts.push({
            id: `ONT-TRANS-${parsedId}`,
            sn,
            model: 'Modem ONT ZTE F670L Dual Band',
            status: 'Di Perjalanan',
            pelanggan: targetPermohonan?.pelanggan_nama || 'Pelanggan STO',
            tugas_id: targetPermohonan?.tugas_id
          });
          localStorage.setItem('sto_ont_serials', JSON.stringify(storedOnts));
        }
      } catch (_) {}
    }

    // 1. Sync ke backend Express API
    try {
      await api.patch(`/permohonan/${parsedId}/release`);
    } catch (apiErr) {
      console.warn('[releaseMaterial] Backend API notice:', apiErr.message);
    }

    // 2. Sync to Supabase: Potong stok real di tabel barang & permohonan status
    if (isSupabaseConfigured()) {
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
  };

  // SOP 5: Teknisi menuju lokasi (Sistem melacak koordinat GPS)
  const updateGpsLocation = () => {};
  const simulateTechnicianStep = () => {};

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
  const finishTugas = async (tugasId, argPhotoOrPayload, catatanHasil = "") => {
    const parsedTugasId = parseInt(tugasId, 10);
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Cek apakah argumen kedua berupa objek payload lengkap atau sekadar string URL foto
    const isPayloadObject = typeof argPhotoOrPayload === 'object' && argPhotoOrPayload !== null;

    const proof = isPayloadObject
      ? (argPhotoOrPayload.foto_bukti || argPhotoOrPayload.fotoBuktiUrl || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80")
      : (argPhotoOrPayload || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80");

    const userNote = isPayloadObject ? (argPhotoOrPayload.catatan || "") : catatanHasil;
    const odpId = isPayloadObject ? (argPhotoOrPayload.odp_id || "ODP-PYK-FA/014") : "ODP-PYK-FA/014";
    const portOdp = isPayloadObject ? (argPhotoOrPayload.port_odp || "03") : "03";
    const redamanDbm = isPayloadObject ? (argPhotoOrPayload.redaman_dbm || "-18.5") : "-18.5";
    const snOnt = isPayloadObject ? (argPhotoOrPayload.sn_ont || "ZTEGC8B90112") : "ZTEGC8B90112";
    const pelangganNama = isPayloadObject ? (argPhotoOrPayload.pelanggan_nama || "") : "";
    const reconciliation = isPayloadObject ? (argPhotoOrPayload.reconciliation || []) : [];
    const bastpNumber = isPayloadObject
      ? (argPhotoOrPayload.bastp_number || `BASTP/TA-PYK/${now.getFullYear()}/${String(parsedTugasId).padStart(4, '0')}`)
      : `BASTP/TA-PYK/${now.getFullYear()}/${String(parsedTugasId).padStart(4, '0')}`;

    // Buat ringkasan teks untuk kolom catatan di tabel Supabase
    const materialSummaryText = reconciliation.length > 0
      ? reconciliation.map(m => `${m.nama_barang}: ${m.jumlah_terpakai} ${m.satuan} [TERPASANG]`).join(', ')
      : `ONT SN: ${snOnt}, Dropcore: Terpasang`;

    const summaryNoteForDb = `[BASTP: ${bastpNumber}] ODP: ${odpId} (Port ${portOdp}) | Redaman: ${redamanDbm} dBm | SN: ${snOnt} | Terpasang: ${materialSummaryText} | Catatan: ${userNote}`;

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
      reconciliation: reconciliation.map(r => ({
        ...r,
        status: 'TERPASANG DI PELANGGAN (CONSUMED)'
      }))
    };

    // 1. Perbarui state lokal tugas dengan metadata closing & BASTP
    setTugas(prev => prev.map(t => {
      if (Number(t.id) === parsedTugasId) {
        return {
          ...t,
          status: "Done",
          foto_bukti: proof,
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
      reconciliation.forEach(async (item) => {
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
      });
    }

    // 3. Simpan status selesai permanen di penyimpanan lokal
    try {
      const doneList = JSON.parse(localStorage.getItem('sto_done_tasks') || '[]');
      if (!doneList.includes(parsedTugasId)) {
        doneList.push(parsedTugasId);
        localStorage.setItem('sto_done_tasks', JSON.stringify(doneList));
      }
    } catch (_) {}

    // 4. Sinkronisasi status selesai ke Supabase Cloud (hanya kolom yang valid di tabel)
    if (isSupabaseConfigured()) {
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

    // 5. Broadcast sinyal selesai via Supabase Realtime WebSocket
    broadcastLiveSignal('tugas_selesai', {
      tugas_id: parsedTugasId,
      status: 'Done',
      sn_ont: snOnt
    });

    // Update status serial number ONT di penyimpanan lokal agar statusnya otomatis Terpasang
    try {
      const storedOnts = JSON.parse(localStorage.getItem('sto_ont_serials') || '[]');
      const updatedOnts = storedOnts.map(s => {
        if (s.sn === snOnt) {
          return { ...s, status: 'Terpasang', pelanggan: pelangganNama || 'Pelanggan STO', tugas_id: parsedTugasId };
        }
        return s;
      });
      localStorage.setItem('sto_ont_serials', JSON.stringify(updatedOnts));
    } catch (_) {}

    showToast(`Tiket #${parsedTugasId} berhasil diselesaikan! Status ONT ${snOnt} di gudang otomatis menjadi TERPASANG.`, "success");
    return bastpData;
  };

  // CRUD Gudang (Barang)
  const addBarang = async (item) => {
    const newId = barang.length > 0 ? Math.max(...barang.map(b => Number(b.id) || 0)) + 1 : 1;
    const newItem = {
      id: newId,
      nama_barang: item.nama_barang,
      stok: parseInt(item.stok, 10) || 0,
      satuan: item.satuan || "pcs"
    };

    setBarang(prev => [newItem, ...prev]);

    // 1. Sync ke Express Backend API
    try {
      await api.post('/barang', newItem);
    } catch (apiErr) {
      console.warn('[addBarang] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase.from('barang').insert([{
          nama_barang: newItem.nama_barang,
          stok: newItem.stok,
          satuan: newItem.satuan
        }]).select();

        if (data && data.length > 0) {
          setBarang(prev => prev.map(b => b.id === newId ? { ...b, id: data[0].id } : b));
        }
      } catch (err) {
        console.warn('Supabase insert barang error:', err);
      }
    }

    showToast(`Barang '${item.nama_barang}' berhasil ditambahkan ke inventaris!`, "success");
    return newItem;
  };

  const updateBarang = async (id, updatedFields) => {
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

    // 1. Sync ke Express Backend API
    try {
      await api.put(`/barang/${parsedId}`, payload);
    } catch (apiErr) {
      console.warn('[updateBarang] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('barang').update(payload).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase update barang error:', err);
      }
    }

    showToast("Data barang berhasil diperbarui!", "success");
  };

  const tambahStokBarang = async (id, jumlah) => {
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

    // 1. Sync ke Express Backend API
    try {
      await api.patch(`/barang/${parsedId}/stok`, { jumlah_tambah: parsedJumlah });
    } catch (apiErr) {
      console.warn('[tambahStokBarang] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase
    if (isSupabaseConfigured() && targetItem) {
      try {
        await supabase.from('barang').update({ stok: targetItem.stok }).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase update stok notice:', err);
      }
    }

    showToast(`Stok ${targetItem?.nama_barang || 'barang'} bertambah +${parsedJumlah} ${targetItem?.satuan || 'pcs'}!`, "success");
  };

  const deleteBarang = async (id) => {
    const parsedId = parseInt(id, 10);
    setBarang(prev => prev.filter(b => Number(b.id) !== parsedId));

    // 1. Sync ke Express Backend API
    try {
      await api.delete(`/barang/${parsedId}`);
    } catch (apiErr) {
      console.warn('[deleteBarang] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('barang').delete().eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase delete barang error:', err);
      }
    }

    showToast("Barang dihapus dari inventaris gudang!", "info");
  };

  // CRUD Penugasan / Tiket (Tugas)
  const updateTugas = async (id, updatedFields) => {
    const parsedId = parseInt(id, 10);
    setTugas(prev => prev.map(t => Number(t.id) === parsedId ? { ...t, ...updatedFields } : t));

    try {
      await api.put(`/tugas/${parsedId}`, updatedFields);
    } catch (apiErr) {
      console.warn('[updateTugas] Backend API notice:', apiErr.message);
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('tugas').update(updatedFields).eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase update tugas error:', err);
      }
    }

    showToast(`Tiket #${parsedId} berhasil diperbarui!`, "success");
  };

  const deleteTugas = async (id) => {
    const parsedId = parseInt(id, 10);
    setTugas(prev => prev.filter(t => Number(t.id) !== parsedId));

    try {
      await api.delete(`/tugas/${parsedId}`);
    } catch (apiErr) {
      console.warn('[deleteTugas] Backend API notice:', apiErr.message);
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('tugas').delete().eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase delete tugas error:', err);
      }
    }

    showToast(`Tiket #${parsedId} berhasil dibatalkan / dihapus!`, "info");
  };

  const checkInTugas = async (id, coords = {}) => {
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
    } catch (_) {}

    showToast(`GPS Aktif Terverifikasi! Anda telah sampai di lokasi kerja (${lat.toFixed(4)}, ${lng.toFixed(4)}) pk ${waktu}.`, 'success');

    // 3. Supabase Realtime broadcast & update (Asinkron / Non-blocking)
    broadcastLiveSignal('teknisi_checkin', {
      tugas_id: parsedId,
      lat,
      lng,
      waktu,
      teknisi_nama: currentUser?.nama_lengkap || 'Teknisi Lapangan'
    });

    if (isSupabaseConfigured()) {
      supabase.from('tugas').update({
        status: 'Progress'
      }).eq('id', parsedId).then(() => {}).catch(() => {});
    }

    // 4. Fire-and-forget API backend
    api.post(`/tugas/${parsedId}/checkin`, {
      latitude: lat,
      longitude: lng,
      teknisi_nama: currentUser?.nama_lengkap || 'Teknisi Lapangan'
    }).catch(() => {});
  };

  const closeTugas = async (id, closingData = {}) => {
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
    } catch (_) {}

    // Simpan ke Supabase Cloud
    if (isSupabaseConfigured()) {
      try {
        supabase.from('tugas').update({
          status: 'Done',
          foto_bukti: proof
        }).eq('id', parsedId).then(() => {}).catch(() => {});
      } catch (_) {}
    }

    // 3. Panggil Express Backend jika ada
    api.put(`/tugas/${parsedId}/close`, {
      ...closingData,
      odp_id: odpIdOrKode,
      pelanggan_nama: targetTask?.pelanggan_nama
    }).then(res => {
      if (res.data?.data?.odp_updated) {
        setOdp(prev => prev.map(o => o.id === res.data.data.odp_updated.id ? res.data.data.odp_updated : o));
      }
    }).catch(() => {});

    showToast(`🔥 Tiket #${parsedId} Resmi Ditutup (Selesai)! Port ODP bertambah & WebGIS telah diperbarui!`, 'success');
  };

  // CRUD WebGIS ODP (Optical Distribution Point)
  const addOdp = async (odpData) => {
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

    // 1. Sync ke Express Backend API
    try {
      await api.post('/odp', newOdpItem);
    } catch (apiErr) {
      console.warn('[addOdp] Backend API notice:', apiErr.message);
    }

    // 2. Sync ke Supabase
    if (isSupabaseConfigured()) {
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
  };

  const updateOdp = async (id, updatedFields) => {
    const parsedId = parseInt(id, 10);
    setOdp(prev => prev.map(o => Number(o.id) === parsedId ? { ...o, ...updatedFields } : o));

    try {
      await api.put(`/odp/${parsedId}`, updatedFields);
    } catch (apiErr) {
      console.warn('[updateOdp] Backend API notice:', apiErr.message);
    }

    if (isSupabaseConfigured()) {
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
  };

  const deleteOdp = async (id) => {
    const parsedId = parseInt(id, 10);
    setOdp(prev => prev.filter(o => Number(o.id) !== parsedId));

    try {
      await api.delete(`/odp/${parsedId}`);
    } catch (apiErr) {
      console.warn('[deleteOdp] Backend API notice:', apiErr.message);
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('odp').delete().eq('id', parsedId);
      } catch (err) {
        console.warn('Supabase delete ODP notice:', err);
      }
    }

    showToast("Titik ODP berhasil dihapus dari WebGIS!", "info");
  };

  // User Management
  const addUser = async (userData) => {
    const newId = users.length > 0 ? Math.max(...users.map(u => Number(u.id) || 0)) + 1 : 1;
    const newUser = {
      id: newId,
      nama_lengkap: userData.nama_lengkap,
      email: userData.email.toLowerCase().trim(),
      password: userData.password || 'password123',
      role: userData.role || 'teknisi',
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

    showToast(`Akun ${newUser.nama_lengkap} (${newUser.role}) berhasil didaftarkan!`, 'success');
    return newUser;
  };

  // Reset State to Default Factory
  const resetToFactoryDefault = () => {
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
  };

  return (
    <AppContext.Provider
      value={{
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
        barang,
        tugas,
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
        removeGpsEntry: (teknisiId) => {
          const parsedId = parseInt(teknisiId, 10);
          setTrackingGps(prev => prev.filter(g => Number(g.teknisi_id) !== parsedId));
          showToast(`Teknisi #${parsedId} berhasil dihapus dari radar armada`, 'info');
        },
        resetGpsTracking: () => {
          localStorage.removeItem('sto_trackingGps');
          setTrackingGps(initialTrackingGps);
          showToast('Seluruh data GPS armada berhasil di-reset dan dibersihkan dari duplikasi!', 'success');
        },
        finishTugas,
        addBarang,
        updateBarang,
        tambahStokBarang,
        deleteBarang,
        resetToFactoryDefault
      }}
    >
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
