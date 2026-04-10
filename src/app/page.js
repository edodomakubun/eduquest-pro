'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  BookOpen, Wand2, Download, LogOut, 
  Coins, ShieldAlert, Clock, Eye, FileText, 
  CheckCircle2, AlertCircle, Loader2, ChevronLeft, Settings, Zap,
  LayoutGrid // <-- Import icon baru untuk Kisi-Kisi
} from 'lucide-react';

import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { exportToWord } from '../lib/exportWord';
import { exportToWordKisiKisi } from '../lib/exportwordkisikisi'; // <-- Pastikan fungsi ini bisa dipanggil jika user melihat riwayat kisi-kisi

const appId = 'eduquest-pro';

export default function Dashboard() {
  const router = useRouter(); 
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [isPremium, setIsPremium] = useState(false); 
  const [errorMsg, setErrorMsg] = useState('');
  
  const [historyData, setHistoryData] = useState([]);
  const [viewingHistory, setViewingHistory] = useState(null); 

  const checkAccess = async (userEmail) => {
    if (userEmail === 'operator.sdinpresleling2023@gmail.com') return 'admin';
    try {
      const domainsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'allowed_domains');
      const docSnap = await getDoc(domainsRef);
      const domains = docSnap.exists() ? docSnap.data().list || [] : ['@guru.sd.belajar.id'];
      
      const isAllowed = domains.some(domain => userEmail.toLowerCase().endsWith(domain.toLowerCase()));
      return isAllowed ? 'user' : 'denied';
    } catch (error) { return 'denied'; }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email || '';
        const access = await checkAccess(email);
        
        if (access === 'admin') {
          router.push('/admin');
        } else if (access === 'user') {
          setUser({ uid: currentUser.uid, name: currentUser.displayName || 'Guru', email: email });
        } else {
          await signOut(auth);
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCoins(data.coins);
        setIsPremium(data.isPremium || false); 
      } else {
        setDoc(userDocRef, { name: user.name, email: user.email, coins: 20, isPremium: false, createdAt: new Date().toISOString() });
        setCoins(20);
        setIsPremium(false);
      }
    }, (error) => console.error(error));
    return () => unsubUser();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const historyColRef = collection(db, 'artifacts', appId, 'public', 'data', 'history', user.uid, 'saved_exams');
    const unsubHistory = onSnapshot(historyColRef, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistoryData(docs);
    }, (error) => console.error("Gagal memuat riwayat:", error));
    
    return () => unsubHistory();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); };

  // Fungsi helper untuk mengunduh ulang berdasarkan tipe riwayat
  const handleReDownload = () => {
    if (!viewingHistory) return;
    if (viewingHistory.type === 'kisi_kisi') {
      exportToWordKisiKisi(viewingHistory.formData, viewingHistory.kisiData, coins, showError);
    } else {
      exportToWord(viewingHistory.formData, viewingHistory.questions, coins, showError);
    }
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-in fade-in z-50">
          <AlertCircle size={20} /> <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" onClick={() => setViewingHistory(null)} className="flex items-center space-x-2 text-blue-600 cursor-pointer">
            <Wand2 className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight hidden sm:block">EduQuest<span className="text-slate-800">.ai</span></span>
            {isPremium && <span className="ml-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider hidden md:block">Pro</span>}
          </Link>
          <div className="flex items-center space-x-3 sm:space-x-6">
            <div className="flex items-center bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
              <Coins className="w-4 h-4 text-amber-500 mr-2" />
              <span className="text-sm font-bold text-amber-700 mr-2">{coins}</span>
              <span className="text-xs text-amber-600 hidden sm:inline-block">Koin</span>
              <Link href="/payment" className="ml-3 text-xs flex items-center bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded transition-colors">+ Top Up</Link>
            </div>
            
            <Link href="/panduan" className="text-slate-500 hover:text-blue-600 flex items-center text-sm font-medium transition-colors">
              <BookOpen className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline-block">Panduan</span>
            </Link>
            
            <span className="text-sm font-medium text-slate-600 hidden md:inline-block">{user.name}</span>
            <button onClick={handleLogout} className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium transition-colors">
              <LogOut className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline-block">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!isPremium && !viewingHistory && (
          <div className="bg-gradient-to-r from-amber-100 to-orange-50 border border-amber-200 p-4 sm:p-5 rounded-2xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-start sm:items-center mb-4 sm:mb-0">
              <ShieldAlert className="w-8 h-8 text-amber-600 mr-3 shrink-0" />
              <div>
                <p className="font-bold text-amber-900 text-base">Anda sedang menggunakan versi Free</p>
                <p className="text-amber-700 text-sm mt-0.5">Upgrade paket untuk membuka Upload PDF, Analisis Bloom, semua jenis soal lengkap, dan AI Generator Foto!</p>
              </div>
            </div>
            <Link href="/payment" className="w-full sm:w-auto flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-sm transition-transform hover:scale-105 shrink-0">
              Upgrade Pro Sekarang
            </Link>
          </div>
        )}

        {viewingHistory ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-2xl shadow-sm border p-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-30">
              <div className="flex items-center space-x-3 text-slate-700">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <span className="font-medium">Melihat Riwayat: {viewingHistory.examType === 'Kisi-Kisi Ujian' ? 'Kisi-Kisi' : 'Soal'} {viewingHistory.subject}</span>
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button onClick={() => setViewingHistory(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center transition-colors"><ChevronLeft className="w-4 h-4 mr-1"/> Kembali</button>
                <button onClick={handleReDownload} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center shadow-sm"><Download className="w-4 h-4 mr-2" /> Unduh Ulang .doc</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1 md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <h3 className="font-bold text-slate-800 flex items-center mb-3"><FileText className="w-5 h-5 mr-2 text-indigo-500"/> Materi Sumber / Referensi</h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 flex-grow max-h-[180px] overflow-y-auto" style={{ whiteSpace: 'pre-wrap' }}>
                  {viewingHistory.type === 'kisi_kisi' 
                    ? `CP/KD:\n${viewingHistory.formData?.cpText || ''}\n\nMateri:\n${viewingHistory.formData?.materiText || ''}` 
                    : (viewingHistory.formData?.rppText || <span className="italic text-slate-400">Tidak ada materi sumber yang dicatat.</span>)}
                </div>
              </div>

              <div className="col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 flex items-center mb-4"><Settings className="w-5 h-5 mr-2 text-slate-500"/> Parameter Pembuatan</h3>
                <div className="space-y-4">
                  {viewingHistory.type !== 'kisi_kisi' && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Target Taksonomi Bloom</span>
                      <div className="flex flex-wrap gap-1.5">
                        {viewingHistory.formData?.bloomLevels?.filter(b => b.checked).length > 0 
                          ? viewingHistory.formData.bloomLevels.filter(b => b.checked).map(b => (
                              <span key={b.id} className="bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-md">{b.id.toUpperCase()}</span>
                            ))
                          : <span className="text-xs text-slate-500 italic">Default AI</span>
                        }
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Komposisi {viewingHistory.type === 'kisi_kisi' ? 'Kisi-Kisi' : 'Soal'}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {viewingHistory.type === 'kisi_kisi' ? (
                        <>
                          <span className="bg-green-50 border border-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md">PG ({viewingHistory.formData?.pgCount || 0})</span>
                          <span className="bg-green-50 border border-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md">Esai ({viewingHistory.formData?.esaiCount || 0})</span>
                        </>
                      ) : (
                        viewingHistory.formData?.questionTypes?.filter(t => t.checked && t.count > 0).map(t => (
                          <span key={t.id} className="bg-green-50 border border-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md">
                            {t.label} ({t.count})
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Status Akun Saat Dibuat</span>
                    {viewingHistory.isPremiumSnapshot ? (
                      <div className="inline-flex items-center bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                        <Zap className="w-4 h-4 mr-1.5 fill-current"/> Premium (Pro)
                      </div>
                    ) : (
                      <div className="inline-flex items-center bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg">
                        <ShieldAlert className="w-4 h-4 mr-1.5"/> Free / Trial
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Render Hasil Sesuai Tipe Riwayat (Soal vs Kisi-kisi) */}
            <div className="bg-white rounded-2xl shadow-sm border p-8 sm:p-12 mt-6 overflow-hidden">
              <div id="printable-doc-area">
                <div className="text-center mb-10 text-slate-800">
                  <h1 className="text-xl font-bold uppercase mb-1">{viewingHistory.examType === 'Kisi-Kisi Ujian' ? 'KISI-KISI PENYUSUNAN SOAL UJIAN' : `SOAL ${viewingHistory.examType} SD`}</h1>
                  <p className="text-md mb-0 font-medium">Mata Pelajaran: {viewingHistory.subject} | Kelas: {viewingHistory.grade}</p>
                </div>
                
                {viewingHistory.type === 'kisi_kisi' ? (
                  /* --- PREVIEW KISI-KISI --- */
                  <div className="overflow-x-auto w-full border border-slate-200 rounded-xl">
                    <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                      <thead className="bg-emerald-100 text-emerald-900 border-b-2 border-emerald-200">
                        <tr>
                          <th className="p-3 border-r border-emerald-200 text-center w-12">No</th>
                          <th className="p-3 border-r border-emerald-200 w-1/5">Capaian Pembelajaran (CP)</th>
                          <th className="p-3 border-r border-emerald-200 w-1/5">Lingkup Materi</th>
                          <th className="p-3 border-r border-emerald-200">Indikator Soal</th>
                          <th className="p-3 border-r border-emerald-200 text-center w-24">Level Kognitif</th>
                          <th className="p-3 border-r border-emerald-200 text-center w-24">Bentuk Soal</th>
                          <th className="p-3 text-center w-16">No. Soal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingHistory.kisiData?.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3 border-r border-slate-200 text-center font-bold text-slate-600">{idx + 1}</td>
                            <td className="p-3 border-r border-slate-200">{row.cp}</td>
                            <td className="p-3 border-r border-slate-200">{row.materi}</td>
                            <td className="p-3 border-r border-slate-200">{row.indikator}</td>
                            <td className="p-3 border-r border-slate-200 text-center font-medium">{row.level_kognitif}</td>
                            <td className="p-3 border-r border-slate-200 text-center font-medium">{row.bentuk_soal}</td>
                            <td className="p-3 text-center font-bold">{row.no_soal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* --- PREVIEW SOAL BIASA --- */
                  <div className="space-y-10">
                    {(() => {
                      const grouped = viewingHistory.questions?.reduce((acc, q) => { const type = q.type || 'Lainnya'; if (!acc[type]) acc[type] = []; acc[type].push(q); return acc; }, {}) || {};
                      let globalIndex = 1;
                      return Object.keys(grouped).map(type => (
                        <div key={type} className="mb-10">
                          <div className="bg-blue-50 border-l-4 border-blue-500 px-4 py-2 mb-6 rounded-r-lg"><h3 className="font-bold text-blue-800 text-lg uppercase tracking-wide">Bagian: {type}</h3></div>
                          <div className="space-y-8">
                            {grouped[type].map((q) => {
                              const currentIndex = globalIndex++;
                              return (
                                <div key={q.id} className="soal-container relative group ml-2 sm:ml-4">
                                  <div className="absolute -left-10 top-0 hidden sm:flex h-8 w-8 bg-blue-100 text-blue-700 rounded-full items-center justify-center text-xs font-bold font-mono shadow-sm">{currentIndex}</div>
                                  <div className="flex flex-col sm:flex-row gap-6">
                                    <div className="flex-1">
                                      <div className="flex gap-2">
                                        <span className="font-bold text-slate-800">{currentIndex}.</span>
                                        <div className="w-full text-base font-medium text-slate-800 outline-none min-h-[1.5em]" contentEditable suppressContentEditableWarning>{q.text}</div>
                                      </div>
                                      {q.imageUrl && <div className="my-4"><img src={q.imageUrl} alt={`Ilustrasi`} width="200" style={{ width: '200px', height: 'auto', borderRadius: '8px' }} className="border border-slate-200 shadow-sm object-cover" /></div>}
                                      {q.options && q.options.length > 0 && <div className="options mt-3 space-y-2 pl-4 sm:pl-0">{q.options.map((opt, i) => <div key={i} className="text-slate-700 option-item flex items-start"><span>{opt}</span></div>)}</div>}
                                      {(type.includes('Isian') || type.includes('Esai') || type.includes('Uraian') || type.includes('Cerita')) && <div className="mt-4 border-b border-dashed border-slate-300 h-6 w-full max-w-lg" />}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* --- KARTU WELCOME & TOMBOL AKSI UTAMA --- */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
              <div className="text-center md:text-left">
                <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Halo, {user.name}! 👋</h1>
                <p className="text-slate-600 text-lg">Selamat datang di Dasbor EduQuest. Apa yang ingin Anda buat hari ini?</p>
              </div>
              
              {/* TOMBOL BERJEJER UNTUK SOAL & KISI-KISI */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                <Link href="/generate" className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center">
                  <Wand2 className="w-5 h-5 mr-2" /> Buat Soal
                </Link>
                <Link href="/generate-kisi" className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5 mr-2" /> Buat Kisi-Kisi
                </Link>
              </div>
            </div>

            {/* Tabel Riwayat (History) */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                 <h2 className="text-lg font-bold text-slate-800 flex items-center">
                   <Clock className="w-5 h-5 mr-2 text-blue-500"/> Riwayat Pembuatan Anda
                 </h2>
               </div>
               <div className="p-0 overflow-x-auto">
                 {historyData.length === 0 ? (
                    <div className="p-16 text-center text-slate-500">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                      <p className="text-lg font-medium text-slate-600">Belum ada riwayat.</p>
                      <p className="text-sm mt-1">Buat soal atau kisi-kisi pertama Anda dan semuanya akan tersimpan di sini!</p>
                    </div>
                 ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                        <tr>
                          <th className="p-4 font-bold">Waktu Dibuat</th>
                          <th className="p-4 font-bold">Tipe</th>
                          <th className="p-4 font-bold">Mata Pelajaran</th>
                          <th className="p-4 font-bold">Kelas</th>
                          <th className="p-4 text-center font-bold">Jml Item</th>
                          <th className="p-4 text-right font-bold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map(item => (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                            <td className="p-4 text-slate-600">
                              {new Date(item.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})} <br/>
                              <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</span>
                            </td>
                            <td className="p-4 font-bold">
                              {item.type === 'kisi_kisi' 
                                ? <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-xs">Kisi-Kisi</span> 
                                : <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-xs">Soal Ujian</span>}
                            </td>
                            <td className="p-4 font-bold text-slate-800">{item.subject}</td>
                            <td className="p-4 text-slate-600 font-medium">Kelas {item.grade}</td>
                            <td className="p-4 text-center text-slate-600">
                              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold">
                                {item.type === 'kisi_kisi' ? item.kisiData?.length || 0 : item.questions?.length || 0}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => setViewingHistory(item)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors inline-flex items-center"
                              >
                                <Eye className="w-4 h-4 mr-2"/> Lihat Detail
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}