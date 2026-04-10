'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  BookOpen, Wand2, Download, LogOut, 
  Coins, ShieldAlert, Clock, Eye, FileText, 
  CheckCircle2, AlertCircle, Loader2, ChevronLeft
} from 'lucide-react';

import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { exportToWord } from '../lib/exportWord';

const appId = 'eduquest-pro';

export default function Dashboard() {
  const router = useRouter(); 
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [isPremium, setIsPremium] = useState(false); 
  const [errorMsg, setErrorMsg] = useState('');
  
  const [historyData, setHistoryData] = useState([]);
  const [viewingHistory, setViewingHistory] = useState(null); // State untuk melihat detail soal dari riwayat

  // --- LOGIKA AUTHENTICATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email || '';
        if (email === 'operator.sdinpresleling2023@gmail.com') {
          router.push('/admin');
        } else if (email.endsWith('@guru.sd.belajar.id')) {
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

  // --- LOGIKA DATABASE REALTIME & PREMIUM CHECK ---
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

  // --- LOGIKA MENGAMBIL RIWAYAT GENERATE SOAL (HISTORY) ---
  useEffect(() => {
    if (!user) return;
    const historyColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'history');
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
          <Link href="/" className="flex items-center space-x-2 text-blue-600 cursor-pointer">
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
        
        {/* BANNER FREE USER */}
        {!isPremium && (
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

        {/* --- STATE: MELIHAT DETAIL RIWAYAT SOAL --- */}
        {viewingHistory ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-2xl shadow-sm border p-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-30">
              <div className="flex items-center space-x-3 text-slate-700">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <span className="font-medium">Melihat Riwayat Soal: {viewingHistory.subject} (Kelas {viewingHistory.grade})</span>
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button onClick={() => setViewingHistory(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center transition-colors"><ChevronLeft className="w-4 h-4 mr-1"/> Kembali</button>
                <button onClick={() => exportToWord(viewingHistory.formData, viewingHistory.questions, coins, showError)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center shadow-sm"><Download className="w-4 h-4 mr-2" /> Unduh Ulang .doc</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-8 sm:p-12">
              <div id="printable-doc-area">
                <div className="text-center mb-10 text-slate-800">
                  <h1 className="text-xl font-bold uppercase mb-1">SOAL {viewingHistory.examType} SD</h1>
                  <p className="text-md mb-0 font-medium">Mata Pelajaran: {viewingHistory.subject} | Kelas: {viewingHistory.grade}</p>
                </div>

                <div className="space-y-10">
                  {(() => {
                    const grouped = viewingHistory.questions.reduce((acc, q) => { const type = q.type || 'Lainnya'; if (!acc[type]) acc[type] = []; acc[type].push(q); return acc; }, {});
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
              </div>
            </div>
          </div>
        ) : (
          /* --- STATE: DASHBOARD UTAMA --- */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Kartu Welcome & Quick Action */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Halo, {user.name}! 👋</h1>
                <p className="text-slate-600 text-lg">Selamat datang di Dasbor EduQuest. Apa yang ingin Anda buat hari ini?</p>
              </div>
              {/* TOMBOL MENGARAH KE HALAMAN GENERATE SOAL */}
              <Link href="/generate" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center shrink-0">
                <Wand2 className="w-5 h-5 mr-2" /> Buat Soal Baru
              </Link>
            </div>

            {/* Tabel Riwayat (History) */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                 <h2 className="text-lg font-bold text-slate-800 flex items-center">
                   <Clock className="w-5 h-5 mr-2 text-blue-500"/> Riwayat Pembuatan Soal
                 </h2>
               </div>
               <div className="p-0 overflow-x-auto">
                 {historyData.length === 0 ? (
                    <div className="p-16 text-center text-slate-500">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                      <p className="text-lg font-medium text-slate-600">Belum ada riwayat soal.</p>
                      <p className="text-sm mt-1">Buat soal pertama Anda dan semuanya akan tersimpan otomatis di sini!</p>
                    </div>
                 ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                        <tr>
                          <th className="p-4 font-bold">Waktu Dibuat</th>
                          <th className="p-4 font-bold">Mata Pelajaran</th>
                          <th className="p-4 font-bold">Kelas</th>
                          <th className="p-4 font-bold">Jenis Ujian</th>
                          <th className="p-4 text-center font-bold">Jml Soal</th>
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
                            <td className="p-4 font-bold text-slate-800">{item.subject}</td>
                            <td className="p-4 text-slate-600 font-medium">Kelas {item.grade}</td>
                            <td className="p-4 text-slate-600">{item.examType}</td>
                            <td className="p-4 text-center text-slate-600">
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold">{item.questions?.length || 0}</span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => setViewingHistory(item)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors inline-flex items-center"
                              >
                                <Eye className="w-4 h-4 mr-2"/> Lihat Soal
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