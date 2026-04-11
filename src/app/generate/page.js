'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  BookOpen, Upload, Settings, Wand2, Download, ChevronLeft, 
  FileText, CheckCircle2, AlertCircle, Loader2, LogOut, 
  Coins, Lock, ShieldAlert, Image as ImageIcon, X, LayoutGrid
} from 'lucide-react';

import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc, increment, collection, addDoc } from 'firebase/firestore';
import { analyzeBloomWithAI, callGeminiTextAPI, callImagenAPI } from '../../lib/ai';
import { exportToWord } from '../../lib/exportWord';

const appId = 'eduquest-pro';

export default function GeneratePage() {
  const router = useRouter(); 
  const [appState, setAppState] = useState('FORM');
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [isPremium, setIsPremium] = useState(false); 
  const [errorMsg, setErrorMsg] = useState('');

  const [masterSubjects, setMasterSubjects] = useState(['Matematika']); 
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);
  
  const [kisiPdfUrl, setKisiPdfUrl] = useState(null);
  const [isExtractingKisi, setIsExtractingKisi] = useState(false);

  const [schoolLevel, setSchoolLevel] = useState('SD');

  const [formData, setFormData] = useState({
    schoolLevel: 'SD',
    subject: 'Matematika', grade: '1 (Fase A)', examType: 'Asesmen Formatif',
    bloomLevels: [], 
    questionTypes: [
      { id: 'pg', label: 'Pilihan Ganda', checked: true, count: 5 },
      { id: 'isian', label: 'Isian Singkat', checked: false, count: 5 },
      { id: 'esai', label: 'Uraian (Esai)', checked: false, count: 5 },
      { id: 'menjodohkan', label: 'Menjodohkan', checked: false, count: 5 },
      { id: 'bs', label: 'Benar atau Salah', checked: false, count: 5 },
      { id: 'cerita', label: 'Soal Cerita', checked: false, count: 5 },
    ],
    rppText: '',
    kisiText: ''
  });

  const [questions, setQuestions] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [bloomAnalysis, setBloomAnalysis] = useState('');
  const [isAnalyzingBloom, setIsAnalyzingBloom] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false); 

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
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMasterSubjects(data.subjects || []);
        
        const dynamicBlooms = (data.bloomLevels || []).map((b, i) => ({
          id: b.id, label: b.label, checked: i < 2 
        }));
        
        setFormData(prev => ({ 
          ...prev, 
          subject: data.subjects && data.subjects.length > 0 ? data.subjects[0] : 'Matematika',
          bloomLevels: dynamicBlooms 
        }));
      }
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
          const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', currentUser.uid);
          const profileSnap = await getDoc(profileRef);
          const profileData = profileSnap.exists() ? profileSnap.data() : null;
          const level = profileData?.schoolLevel || (email.toLowerCase().includes('@guru.smp.belajar.id') ? 'SMP' : 'SD');
          setSchoolLevel(level);
          setFormData(prev => ({
             ...prev,
             schoolLevel: level,
             grade: level === 'SMP' ? '7 (Fase D)' : '1 (Fase A)'
          }));
          setUser({ uid: currentUser.uid, name: currentUser.displayName || profileData?.name || 'Guru', email: email });
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
        if (data.schoolLevel) {
          setSchoolLevel(data.schoolLevel);
          setFormData(prev => ({
            ...prev,
            schoolLevel: data.schoolLevel,
            grade: data.schoolLevel === 'SMP' ? '7 (Fase D)' : '1 (Fase A)'
          }));
        }
      }
    });
    return () => unsubUser();
  }, [user]);

  useEffect(() => {
    if (!isPremium && !isLoadingMaster && formData.bloomLevels.length > 0) {
      setFormData(prev => ({
        ...prev,
        questionTypes: prev.questionTypes.map(t => t.id === 'pg' ? { ...t, checked: true } : { ...t, checked: false }),
        bloomLevels: prev.bloomLevels.map(b => ({ ...b, checked: false }))
      }));
    }
  }, [isPremium, isLoadingMaster]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); };

  const generateQuestions = async () => {
    if (!formData.rppText.trim() && !formData.kisiText.trim()) return showError('Isi materi RPP atau unggah Kisi-Kisi terlebih dahulu.');
    if (formData.questionTypes.filter(t => t.checked && t.count > 0).length === 0) return showError('Pilih setidaknya satu jenis soal.');
    
    if (coins < 10) {
      router.push('/payment'); 
      return;
    }

    try {
      const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
      await updateDoc(userDocRef, { coins: increment(-10) });
    } catch (e) {
      return showError('Gagal memproses transaksi koin.');
    }

    setAppState('LOADING');
    setLoadingStatus('Menganalisis Referensi dan merancang soal...');

    try {
      const generatedQuestions = await callGeminiTextAPI(formData, isPremium);
      setQuestions(generatedQuestions);
      
      const questionsWithImages = [];
      if (isPremium) {
        setLoadingStatus('Menggambar ilustrasi kartun...');
        for (const q of generatedQuestions) {
          if (q.imagePrompt && q.imagePrompt.toLowerCase() !== 'none') {
            setLoadingStatus(`Menggambar ilustrasi untuk Soal ${q.id}...`);
            const imageUrl = await callImagenAPI(q.imagePrompt);
            questionsWithImages.push({ ...q, imageUrl });
          } else {
            questionsWithImages.push(q);
          }
        }
      } else {
        generatedQuestions.forEach(q => questionsWithImages.push(q));
      }

      try {
        const historyColRef = collection(db, 'artifacts', appId, 'public', 'data', 'history', user.uid, 'saved_exams');
        await addDoc(historyColRef, {
          type: 'soal',
          subject: formData.subject,
          grade: formData.grade,
          examType: formData.examType,
          createdAt: new Date().toISOString(),
          questions: questionsWithImages,
          formData: formData,
          isPremiumSnapshot: isPremium
        });
      } catch (e) { console.error("Gagal menyimpan ke riwayat:", e); }

      setQuestions(questionsWithImages);
      setAppState('PREVIEW');
    } catch (err) {
      showError('Gagal membuat soal: ' + err.message);
      setAppState('FORM'); 
    }
  };

  useEffect(() => {
    if (!document.getElementById('pdfjs-script')) {
      const script = document.createElement('script');
      script.id = 'pdfjs-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      document.head.appendChild(script);
      script.onload = () => window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type === 'application/pdf' && !isPremium) {
      showError("Versi Free tidak dapat mengunggah PDF. Harap salin-tempel teks secara manual.");
      e.target.value = null; return;
    }

    if (file.type === 'application/pdf') {
      if (!window.pdfjsLib) return showError('Sistem pembaca PDF disiapkan, coba lagi.');
      setIsExtracting(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        setFormData(prev => ({ ...prev, rppText: fullText }));
      } catch (err) { showError('Gagal membaca PDF RPP.'); } finally { setIsExtracting(false); }
    } else if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => setFormData(prev => ({ ...prev, rppText: event.target.result }));
      reader.readAsText(file);
    } else { showError('Format file tidak didukung.'); }
    e.target.value = null;
  };

  const handleKisiUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isPremium) { showError("Versi Free tidak dapat mengunggah Kisi-Kisi PDF."); e.target.value = null; return; }

    if (file.type === 'application/pdf') {
      if (!window.pdfjsLib) return showError('Sistem pembaca PDF belum siap.');
      
      if (kisiPdfUrl) URL.revokeObjectURL(kisiPdfUrl);
      const fileUrl = URL.createObjectURL(file);
      setKisiPdfUrl(fileUrl);
      
      setIsExtractingKisi(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) { 
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        setFormData(prev => ({ ...prev, kisiText: fullText }));
      } catch (err) { showError('Gagal mengekstrak teks PDF Kisi-Kisi.'); } finally { setIsExtractingKisi(false); }
    } else { showError('Format file Kisi-Kisi harus .pdf'); }
    e.target.value = null;
  };

  useEffect(() => {
    if (appState !== 'FORM' || !isPremium) return;
    const activeBlooms = formData.bloomLevels.filter(b => b.checked).map(b => b.label);
    if (activeBlooms.length === 0) return setBloomAnalysis('Pilih minimal satu tingkat Taksonomi Bloom.');
    setIsAnalyzingBloom(true);
    const timeoutId = setTimeout(async () => {
      try { setBloomAnalysis(await analyzeBloomWithAI(activeBlooms, formData, isPremium)); } 
      catch (e) { setBloomAnalysis('Gagal memuat analisis.'); } 
      finally { setIsAnalyzingBloom(false); }
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [JSON.stringify(formData.bloomLevels), formData.grade, formData.subject, formData.examType, formData.rppText, formData.kisiText, appState, isPremium]);

  const gradeOptions = schoolLevel === 'SMP' 
    ? ['7 (Fase D)', '8 (Fase D)', '9 (Fase D)'] 
    : ['1 (Fase A)', '2 (Fase A)', '3 (Fase B)', '4 (Fase B)', '5 (Fase C)', '6 (Fase C)'];

  if (!user || isLoadingMaster) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {errorMsg && <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center z-50"><AlertCircle size={20} className="mr-2" /> <span className="font-medium text-sm">{errorMsg}</span></div>}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></Link>
            <div className="flex items-center space-x-2 text-blue-600"><Wand2 className="w-6 h-6" /><span className="text-xl font-bold tracking-tight hidden sm:block">Buat Soal {schoolLevel}</span></div>
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
            <div className="flex items-center"><ShieldAlert className="w-8 h-8 text-amber-600 mr-3" /><div><p className="font-bold text-amber-900">Versi Free</p><p className="text-amber-700 text-sm">Upgrade paket untuk membuka upload PDF Kisi-Kisi, Analisis Bloom, dan AI Gambar!</p></div></div>
            <Link href="/payment" className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-transform hover:scale-105">Upgrade Pro</Link>
          </div>
        )}

        {appState === 'FORM' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Settings className="w-5 h-5 mr-2 text-blue-500" /> Parameter Soal</h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mata Pelajaran</label>
                    <select value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {masterSubjects.map((sub, idx) => <option key={idx} value={sub}>{sub}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Kelas/Fase</label>
                      <select value={formData.grade} onChange={(e) => setFormData({...formData, grade: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {gradeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Ujian</label>
                      <select value={formData.examType} onChange={(e) => setFormData({...formData, examType: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option>Asesmen Formatif</option><option>Asesmen Sumatif</option><option>Sumatif Tengah Semester (STS)</option><option>Sumatif Akhir Semester (SAS)</option><option>Sumatif Akhir Tahun (SAT)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-sm font-medium text-slate-700 mb-2"><span>Jenis Soal & Jumlah</span>{!isPremium && <Lock className="w-3 h-3 text-slate-400" />}</label>
                    <div className={`space-y-2 border rounded-xl p-3 ${!isPremium ? 'bg-slate-100/50' : 'bg-slate-50'}`}>
                      {formData.questionTypes.map((type, index) => {
                        const isLocked = !isPremium && type.id !== 'pg';
                        return (
                          <div key={type.id} className="flex items-center justify-between p-2 bg-white rounded-lg border shadow-sm">
                            <label className={`flex items-center space-x-3 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input type="checkbox" checked={type.checked} disabled={isLocked} onChange={(e) => { const newTypes = [...formData.questionTypes]; newTypes[index].checked = e.target.checked; setFormData({...formData, questionTypes: newTypes}); }} className="w-4 h-4 rounded text-blue-600" />
                              <span className="text-sm font-medium text-slate-700">{type.label}</span>
                            </label>
                            {type.checked && !isLocked && (
                              <div className="flex items-center space-x-2"><input type="number" min="1" max="20" value={type.count} onChange={(e) => { const newTypes = [...formData.questionTypes]; newTypes[index].count = parseInt(e.target.value) || 1; setFormData({...formData, questionTypes: newTypes}); }} className="w-14 border rounded px-2 py-1 text-sm outline-none text-center" /></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="relative">
                    <label className="flex items-center justify-between text-sm font-medium text-slate-700 mb-2"><span>Target Taksonomi Bloom</span>{!isPremium && <Lock className="w-3 h-3 text-slate-400" />}</label>
                    <div className={`grid grid-cols-2 gap-2 border rounded-xl p-3 ${!isPremium ? 'bg-slate-100/50 opacity-60 pointer-events-none' : 'bg-slate-50'}`}>
                      {formData.bloomLevels.map((level, index) => (
                        <label key={level.id} className="flex items-center space-x-2 cursor-pointer bg-white p-2 rounded-lg border shadow-sm">
                          <input type="checkbox" checked={level.checked} onChange={(e) => { const newLevels = [...formData.bloomLevels]; newLevels[index].checked = e.target.checked; setFormData({...formData, bloomLevels: newLevels}); }} className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-medium text-slate-700 truncate">{level.label}</span>
                        </label>
                      ))}
                    </div>
                    {isPremium ? (
                      <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl shadow-inner">
                        <div className="flex items-center mb-2 text-indigo-700 font-semibold text-xs"><Wand2 className="w-3 h-3 mr-1" /> Analisis AI</div>
                        <div className="text-xs text-indigo-900 leading-relaxed min-h-[40px]">{isAnalyzingBloom ? <span className="flex items-center animate-pulse"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengevaluasi...</span> : bloomAnalysis}</div>
                      </div>
                    ) : (<div className="absolute inset-0 z-10 flex items-center justify-center pt-8"><span className="bg-slate-800/80 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">Pro Feature</span></div>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                
                {/* MATERI POKOK / RPP */}
                <h2 className="text-lg font-bold text-slate-800 mb-2 flex justify-between">
                  <span className="flex items-center"><FileText className="w-5 h-5 mr-2 text-green-500" /> Materi Sumber</span>
                  <label className={`cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 py-2 px-4 rounded-xl text-sm font-bold flex items-center transition-colors`}>
                    <Upload className="w-4 h-4 mr-2" /> Unggah File (.pdf)
                    <input type="file" accept=".txt,.pdf" className="hidden" onChange={handleFileUpload} disabled={!isPremium} />
                  </label>
                </h2>
                <textarea value={formData.rppText} onChange={(e) => setFormData({...formData, rppText: e.target.value})} className="w-full min-h-[200px] p-5 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm" placeholder="Ketik atau tempel materi ajaran di sini..."></textarea>
                
                {/* FITUR BARU: UPLOAD KISI-KISI PDF */}
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <h2 className="text-lg font-bold text-slate-800 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <span className="flex items-center"><LayoutGrid className="w-5 h-5 mr-2 text-indigo-500" /> Referensi Kisi-Kisi (Opsional)</span>
                    <label className={`cursor-pointer ${isExtractingKisi || !isPremium ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'} py-2 px-4 rounded-xl text-sm font-bold flex items-center transition-colors w-full sm:w-auto justify-center`}>
                      {isExtractingKisi ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (!isPremium ? <Lock className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />)}
                      {isExtractingKisi ? 'Membaca PDF...' : (!isPremium ? 'Upload Kisi-Kisi (Pro)' : 'Unggah Kisi-Kisi (.pdf)')}
                      <input type="file" accept=".pdf" className="hidden" onChange={handleKisiUpload} disabled={isExtractingKisi || !isPremium} />
                    </label>
                  </h2>
                  <p className="text-sm text-slate-500 mb-4">Unggah file PDF Kisi-Kisi agar AI membuat soal yang persis sesuai dengan indikator pada kisi-kisi tersebut.</p>
                  
                  {kisiPdfUrl && (
                    <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-slate-100 h-[450px] shadow-inner animate-in fade-in slide-in-from-bottom-2">
                      <button onClick={() => { setKisiPdfUrl(null); setFormData(p => ({...p, kisiText: ''})) }} className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-lg shadow-md hover:bg-red-600 transition-colors z-10 flex items-center">
                        <X className="w-4 h-4 mr-1"/> Hapus Kisi-Kisi
                      </button>
                      <iframe src={kisiPdfUrl} className="w-full h-full border-0 bg-white" title="Preview Kisi-Kisi" />
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center text-sm font-medium text-slate-600">
                    <ImageIcon className={`w-5 h-5 mr-2 ${isPremium ? 'text-blue-500' : 'text-slate-400'}`} />
                    {isPremium ? 'AI Gambar otomatis di-generate' : <span className="flex items-center text-slate-400">AI Gambar Dinonaktifkan <Lock className="w-3 h-3 ml-2"/></span>}
                  </div>
                  <button onClick={generateQuestions} disabled={!formData.rppText.trim() && !formData.kisiText.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold py-3 px-8 rounded-xl flex items-center shadow-sm transition-colors">
                    <Wand2 className="w-5 h-5 mr-2" /> Generate Soal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {appState === 'LOADING' && (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-slate-800">Sedang Memproses...</h2>
            <p className="mt-2 text-slate-500 animate-pulse">{loadingStatus}</p>
          </div>
        )}

        {appState === 'PREVIEW' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-sm border p-4 flex justify-between items-center sticky top-20 z-30">
              <div className="flex items-center space-x-3 text-slate-700"><CheckCircle2 className="w-6 h-6 text-green-500" /><span className="font-medium">Selesai! {questions.length} soal dibuat.</span></div>
              <div className="flex space-x-3">
                <button onClick={() => setAppState('FORM')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold">Ubah Form</button>
                <button onClick={() => exportToWord(formData, questions, coins, showError)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center shadow-sm"><Download className="w-4 h-4 mr-2" /> Unduh .doc</button>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border p-8 sm:p-12">
              <div id="printable-doc-area">
                <div className="text-center mb-10 text-slate-800">
                  <h1 className="text-xl font-bold uppercase mb-1">SOAL {formData.examType} {schoolLevel}</h1>
                  <p className="text-md mb-0 font-medium">Mata Pelajaran: {formData.subject} | Kelas: {formData.grade}</p>
                </div>
                <div className="space-y-10">
                  {(() => {
                    const grouped = questions.reduce((acc, q) => { const type = q.type || 'Lainnya'; if (!acc[type]) acc[type] = []; acc[type].push(q); return acc; }, {});
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
                                    <div className="flex gap-2"><span className="font-bold text-slate-800">{currentIndex}.</span><div className="w-full text-base font-medium text-slate-800 outline-none min-h-[1.5em]" contentEditable suppressContentEditableWarning>{q.text}</div></div>
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
        )}
      </main>
    </div>
  );
}