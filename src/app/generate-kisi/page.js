'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  BookOpen, Settings, Wand2, Download, ChevronLeft, 
  FileText, CheckCircle2, AlertCircle, Loader2, LogOut, 
  Coins, Lock, ShieldAlert, LayoutGrid
} from 'lucide-react';

import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc, increment, collection, addDoc } from 'firebase/firestore';
import { callGeminiKisiKisiAPI } from '../../lib/ai';
import { exportToWordKisiKisi } from '../../lib/exportwordkisikisi';

const appId = 'eduquest-pro';

export default function GenerateKisiPage() {
  const router = useRouter(); 
  const [appState, setAppState] = useState('FORM');
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [isPremium, setIsPremium] = useState(false); 
  const [errorMsg, setErrorMsg] = useState('');

  const [masterSubjects, setMasterSubjects] = useState(['Matematika']); 
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);
  const [schoolLevel, setSchoolLevel] = useState('SD');
  
  const [formData, setFormData] = useState({
    schoolLevel: 'SD',
    subject: 'Pendidikan Agama Kristen', 
    grade: '1 (Fase A)', 
    curriculum: 'Kurikulum Merdeka',
    teacherName: '',
    cpText: '',
    materiText: '',
    pgCount: 5,
    esaiCount: 5,
    bsCount: 0,
    jodohCount: 0,
    ceritaCount: 0
  });

  const [kisiData, setKisiData] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState('');

  // --- CEK AKSES DOMAIN ---
  const checkAccess = async (userEmail) => {
    if (userEmail === 'operator.sdinpresleling2023@gmail.com') return 'admin';
    try {
      const domainsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'allowed_domains');
      const docSnap = await getDoc(domainsRef);
      const domains = docSnap.exists() ? docSnap.data().list || [] : ['@guru.sd.belajar.id', '@guru.smp.belajar.id'];
      
      const isAllowed = domains.some(domain => userEmail.toLowerCase().endsWith(domain.toLowerCase()));
      return isAllowed ? 'user' : 'denied';
    } catch (error) { return 'denied'; }
  };

  useEffect(() => {
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'master_data');
    const unsubMaster = onSnapshot(masterRef, (docSnap) => {
      let fetchedSubjects = [];
      if (docSnap.exists()) fetchedSubjects = docSnap.data().subjects || [];
      const requiredSubjects = ['Pendidikan Agama Kristen', 'Pendidikan Agama Islam'];
      requiredSubjects.forEach(req => { if (!fetchedSubjects.includes(req)) fetchedSubjects.push(req); });

      setMasterSubjects(fetchedSubjects);
      setFormData(prev => ({ ...prev, subject: fetchedSubjects.includes(prev.subject) ? prev.subject : fetchedSubjects[0] }));
      setIsLoadingMaster(false);
    });
    return () => unsubMaster();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email || '';
        const access = await checkAccess(email);
        
        if (access === 'admin') {
          router.push('/admin');
        } else if (access === 'user') {
          const level = email.toLowerCase().includes('@guru.smp.belajar.id') ? 'SMP' : 'SD';
          setSchoolLevel(level);
          setUser({ uid: currentUser.uid, name: currentUser.displayName || 'Guru', email: email });
          setFormData(prev => ({
             ...prev, 
             teacherName: prev.teacherName || currentUser.displayName || '',
             schoolLevel: level,
             grade: level === 'SMP' ? '7 (Fase D)' : '1 (Fase A)'
          }));
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
        setCoins(docSnap.data().coins);
        setIsPremium(docSnap.data().isPremium || false); 
      }
    });
    return () => unsubUser();
  }, [user]);

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); };

  const generateKisiKisi = async () => {
    const totalSoal = parseInt(formData.pgCount||0) + parseInt(formData.esaiCount||0) + parseInt(formData.bsCount||0) + parseInt(formData.jodohCount||0) + parseInt(formData.ceritaCount||0);
    if (!formData.cpText.trim()) return showError('Capaian Pembelajaran (CP) wajib diisi.');
    if (!formData.materiText.trim()) return showError('Lingkup Materi wajib diisi.');
    if (!formData.teacherName.trim()) return showError('Nama Penyusun wajib diisi.');
    if (totalSoal <= 0) return showError('Jumlah total soal tidak boleh 0.');
    if (!isPremium && totalSoal > 10) return showError('Akun Free maksimal menghasilkan 10 soal kisi-kisi. Silakan Upgrade Pro.');
    if (coins < 10) { router.push('/payment'); return; }

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid), { coins: increment(-10) });
    } catch (e) { return showError('Gagal memproses transaksi koin.'); }

    setAppState('LOADING');
    setLoadingStatus(`Merancang dan memetakan indikator untuk ${totalSoal} soal...`);

    try {
      const generatedKisi = await callGeminiKisiKisiAPI(formData, isPremium);
      
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'history', user.uid, 'saved_exams'), {
          type: 'kisi_kisi',
          subject: formData.subject,
          grade: formData.grade,
          examType: 'Kisi-Kisi Ujian',
          createdAt: new Date().toISOString(),
          kisiData: generatedKisi,
          formData: formData,
          isPremiumSnapshot: isPremium
        });
      } catch (e) { console.error("Gagal menyimpan riwayat:", e); }

      setKisiData(generatedKisi);
      setAppState('PREVIEW');
    } catch (err) {
      showError('Gagal membuat kisi-kisi: ' + err.message);
      setAppState('FORM'); 
    }
  };

  const totalSoalCount = parseInt(formData.pgCount||0) + parseInt(formData.esaiCount||0) + parseInt(formData.bsCount||0) + parseInt(formData.jodohCount||0) + parseInt(formData.ceritaCount||0);
  const gradeOptions = schoolLevel === 'SMP' ? ['7 (Fase D)', '8 (Fase D)', '9 (Fase D)'] : ['1 (Fase A)', '2 (Fase A)', '3 (Fase B)', '4 (Fase B)', '5 (Fase C)', '6 (Fase C)'];

  if (!user || isLoadingMaster) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {errorMsg && <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center z-50"><AlertCircle size={20} className="mr-2" /> <span className="font-medium text-sm">{errorMsg}</span></div>}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></Link>
            <div className="flex items-center space-x-2 text-indigo-600"><LayoutGrid className="w-6 h-6" /><span className="text-xl font-bold tracking-tight hidden sm:block">Buat Kisi-Kisi {schoolLevel}</span></div>
          </div>
          <div className="flex items-center space-x-3 sm:space-x-6">
            <div className="flex items-center bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full"><Coins className="w-4 h-4 text-amber-500 mr-2" /><span className="text-sm font-bold text-amber-700 mr-2">{coins}</span><Link href="/payment" className="ml-3 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded transition-colors">+ Top Up</Link></div>
            <span className="text-sm font-medium text-slate-600 hidden md:inline-block">{user.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!isPremium && appState === 'FORM' && (
          <div className="bg-gradient-to-r from-amber-100 to-orange-50 border border-amber-200 p-4 rounded-2xl mb-8 flex justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center"><ShieldAlert className="w-8 h-8 text-amber-600 mr-3" /><div><p className="font-bold text-amber-900">Versi Free</p><p className="text-amber-700 text-sm">Akun Free dibatasi maksimal 10 soal. Upgrade Pro untuk tanpa batas!</p></div></div>
            <Link href="/payment" className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-transform hover:scale-105">Upgrade Pro</Link>
          </div>
        )}

        {appState === 'FORM' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Settings className="w-5 h-5 mr-2 text-indigo-500" /> Identitas Kisi-Kisi</h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mata Pelajaran</label>
                    <select value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      {masterSubjects.map((sub, idx) => <option key={idx} value={sub}>{sub}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Kelas/Fase</label>
                      <select value={formData.grade} onChange={(e) => setFormData({...formData, grade: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        {gradeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Kurikulum</label>
                      <select value={formData.curriculum} onChange={(e) => setFormData({...formData, curriculum: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option>Kurikulum Merdeka</option><option>Kurikulum 2013</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Penyusun (Guru)</label>
                    <input type="text" value={formData.teacherName} onChange={(e) => setFormData({...formData, teacherName: e.target.value})} placeholder="Masukkan nama Anda" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
                  </div>
                  <div className="border-t border-slate-200 pt-4 mt-2">
                    <label className="flex items-center justify-between text-sm font-medium text-slate-700 mb-3"><span>Komposisi Jumlah Soal</span>{!isPremium && <Lock className="w-3 h-3 text-slate-400" />}</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mb-1 text-center">Pil. Ganda</span>
                        <input type="number" min="0" max={!isPremium ? 10 : 50} value={formData.pgCount} onChange={(e) => setFormData({...formData, pgCount: parseInt(e.target.value)||0})} className="w-14 border border-slate-300 rounded px-1 py-1 outline-none text-center font-bold text-slate-700" />
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mb-1 text-center">Esai</span>
                        <input type="number" min="0" max={!isPremium ? 10 : 50} value={formData.esaiCount} onChange={(e) => setFormData({...formData, esaiCount: parseInt(e.target.value)||0})} className="w-14 border border-slate-300 rounded px-1 py-1 outline-none text-center font-bold text-slate-700" />
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mb-1 text-center">Benar/Salah</span>
                        <input type="number" min="0" max={!isPremium ? 10 : 50} value={formData.bsCount} onChange={(e) => setFormData({...formData, bsCount: parseInt(e.target.value)||0})} className="w-14 border border-slate-300 rounded px-1 py-1 outline-none text-center font-bold text-slate-700" />
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mb-1 text-center">Jodohkan</span>
                        <input type="number" min="0" max={!isPremium ? 10 : 50} value={formData.jodohCount} onChange={(e) => setFormData({...formData, jodohCount: parseInt(e.target.value)||0})} className="w-14 border border-slate-300 rounded px-1 py-1 outline-none text-center font-bold text-slate-700" />
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mb-1 text-center">Soal Cerita</span>
                        <input type="number" min="0" max={!isPremium ? 10 : 50} value={formData.ceritaCount} onChange={(e) => setFormData({...formData, ceritaCount: parseInt(e.target.value)||0})} className="w-14 border border-slate-300 rounded px-1 py-1 outline-none text-center font-bold text-slate-700" />
                      </div>
                    </div>
                    {!isPremium && (totalSoalCount > 10) && <p className="text-xs text-red-500 mt-3 font-medium flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Free maks 10 soal total.</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><FileText className="w-5 h-5 mr-2 text-indigo-500" /> Basis Kurikulum & Materi</h2>
                <div className="space-y-4 flex-grow flex flex-col">
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Capaian Pembelajaran (CP) / Kompetensi Dasar (KD)</label>
                    <textarea value={formData.cpText} onChange={(e) => setFormData({...formData, cpText: e.target.value})} className="w-full flex-grow min-h-[120px] p-4 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Ketikan CP atau KD utama..."></textarea>
                  </div>
                  <div className="flex-1 flex flex-col pt-4">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Lingkup Materi Pokok</label>
                    <textarea value={formData.materiText} onChange={(e) => setFormData({...formData, materiText: e.target.value})} className="w-full flex-grow min-h-[150px] p-4 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Ringkasan materi pokok..."></textarea>
                  </div>
                </div>
                <div className="mt-6 flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <div className="flex items-center text-sm font-medium text-indigo-800"><Wand2 className="w-5 h-5 mr-2" /> AI akan meracik Indikator & Level Kognitif</div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-bold text-amber-700 hidden sm:block">10 Koin / Gen</span>
                    <button onClick={generateKisiKisi} disabled={(!isPremium && (totalSoalCount > 10))} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 px-8 rounded-xl flex items-center shadow-sm">
                      <LayoutGrid className="w-5 h-5 mr-2" /> Generate Kisi-Kisi
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {appState === 'LOADING' && (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-slate-800">Menyusun Kisi-Kisi...</h2>
            <p className="mt-2 text-slate-500">{loadingStatus}</p>
          </div>
        )}

        {appState === 'PREVIEW' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-sm border p-4 flex justify-between items-center sticky top-20 z-30">
              <div className="flex items-center space-x-3 text-slate-700"><CheckCircle2 className="w-6 h-6 text-green-500" /><span className="font-medium">Selesai! {kisiData.length} baris kisi-kisi dibuat.</span></div>
              <div className="flex space-x-3">
                <button onClick={() => setAppState('FORM')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold">Ubah Form</button>
                <button onClick={() => exportToWordKisiKisi(formData, kisiData, coins, showError)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center shadow-sm"><Download className="w-4 h-4 mr-2" /> Unduh .doc</button>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border p-6 sm:p-8 overflow-hidden">
              <div className="text-center mb-8 text-slate-800 border-b pb-6">
                <h1 className="text-2xl font-bold uppercase mb-4 tracking-wider">KISI-KISI PENYUSUNAN SOAL UJIAN</h1>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 text-sm text-left max-w-3xl mx-auto font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div><span className="text-slate-500">Jenjang:</span> <br/>{schoolLevel}</div>
                  <div><span className="text-slate-500">Mata Pelajaran:</span> <br/>{formData.subject}</div>
                  <div><span className="text-slate-500">Kelas / Fase:</span> <br/>{formData.grade}</div>
                  <div><span className="text-slate-500">Kurikulum:</span> <br/>{formData.curriculum}</div>
                  <div><span className="text-slate-500">Penyusun:</span> <br/>{formData.teacherName}</div>
                  <div><span className="text-slate-500">Jumlah Soal:</span> <br/>{totalSoalCount} Soal</div>
                </div>
              </div>
              <div className="overflow-x-auto w-full border border-slate-200 rounded-xl">
                <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                  <thead className="bg-emerald-100 text-emerald-900 border-b-2 border-emerald-200">
                    <tr>
                      <th className="p-3 border-r border-emerald-200 text-center w-12">No</th>
                      <th className="p-3 border-r border-emerald-200 w-1/5">CP / KD</th>
                      <th className="p-3 border-r border-emerald-200 w-1/5">Lingkup Materi</th>
                      <th className="p-3 border-r border-emerald-200">Indikator Soal</th>
                      <th className="p-3 border-r border-emerald-200 text-center w-24">Level Kognitif</th>
                      <th className="p-3 border-r border-emerald-200 text-center w-24">Bentuk Soal</th>
                      <th className="p-3 text-center w-16">No. Soal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kisiData.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 border-r border-slate-200 text-center font-bold text-slate-600">{idx + 1}</td>
                        <td className="p-3 border-r border-slate-200"><div contentEditable suppressContentEditableWarning className="outline-none focus:bg-white">{row.cp}</div></td>
                        <td className="p-3 border-r border-slate-200"><div contentEditable suppressContentEditableWarning className="outline-none focus:bg-white">{row.materi}</div></td>
                        <td className="p-3 border-r border-slate-200"><div contentEditable suppressContentEditableWarning className="outline-none focus:bg-white">{row.indikator}</div></td>
                        <td className="p-3 border-r border-slate-200 text-center font-medium"><div contentEditable suppressContentEditableWarning className="outline-none focus:bg-white">{row.level_kognitif}</div></td>
                        <td className="p-3 border-r border-slate-200 text-center font-medium"><div contentEditable suppressContentEditableWarning className="outline-none focus:bg-white">{row.bentuk_soal}</div></td>
                        <td className="p-3 text-center font-bold"><div contentEditable suppressContentEditableWarning className="outline-none focus:bg-white">{row.no_soal}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}