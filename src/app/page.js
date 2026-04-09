'use client'; 

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Upload, Settings, Wand2, Download, ChevronRight, 
  FileText, CheckCircle2, AlertCircle, Loader2, LogOut, 
  Coins, CreditCard, X 
} from 'lucide-react';

// --- Impor Fungsi Eksternal (Modular) ---
import { auth, db, googleProvider } from '../lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { analyzeBloomWithAI, callGeminiTextAPI, callImagenAPI } from '../lib/ai';
import { exportToWord } from '../lib/exportWord';

const appId = 'eduquest-pro';

export default function Home() {
  const [appState, setAppState] = useState('LOGIN'); 
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State Monetisasi
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    subject: 'Matematika',
    grade: '1',
    examType: 'Ulangan Harian',
    bloomLevels: [
      { id: 'c1', label: 'C1 (Mengingat)', checked: true },
      { id: 'c2', label: 'C2 (Memahami)', checked: true },
      { id: 'c3', label: 'C3 (Penerapan)', checked: false },
      { id: 'c4', label: 'C4 (Analisis)', checked: false },
      { id: 'c5', label: 'C5 (Evaluasi)', checked: false },
      { id: 'c6', label: 'C6 (Mencipta)', checked: false },
    ],
    questionTypes: [
      { id: 'pg', label: 'Pilihan Ganda', checked: true, count: 5 },
      { id: 'isian', label: 'Isian Singkat', checked: false, count: 5 },
      { id: 'esai', label: 'Uraian (Esai)', checked: false, count: 5 },
      { id: 'menjodohkan', label: 'Menjodohkan', checked: false, count: 5 },
      { id: 'bs', label: 'Benar/Salah', checked: false, count: 5 },
      { id: 'cerita', label: 'Soal Cerita', checked: false, count: 5 },
    ],
    rppText: ''
  });

  const [questions, setQuestions] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [bloomAnalysis, setBloomAnalysis] = useState('');
  const [isAnalyzingBloom, setIsAnalyzingBloom] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false); 

  // --- LOGIKA AUTHENTICATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email || '';
        // Cek ketat domain Belajar.id
        if (email.endsWith('@guru.sd.belajar.id') || email.endsWith('@admin.sd.belajar.id')) {
          setUser({ 
            uid: currentUser.uid, 
            name: currentUser.displayName || 'Guru Belajar.id', 
            email: email
          });
        } else {
          // Tolak Gmail biasa
          await signOut(auth);
          setUser(null);
          showError("Akses Ditolak! Hanya untuk akun @guru.sd.belajar.id atau @admin.sd.belajar.id");
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- LOGIKA DATABASE KOIN ---
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCoins(docSnap.data().coins);
      } else {
        // Pengguna baru: 5 koin gratis
        setDoc(userDocRef, { coins: 5, createdAt: new Date().toISOString() });
        setCoins(5);
      }
    }, (error) => console.error("Gagal mengambil data koin:", error));
    return () => unsubscribe();
  }, [user]);

  // --- HANDLER LOGIN & LOGOUT ---
  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email || '';
      if (email.endsWith('@guru.sd.belajar.id') || email.endsWith('@admin.sd.belajar.id')) {
        setAppState('FORM');
      } else {
        await signOut(auth);
        showError("Akses Ditolak! Gunakan akun Belajar.id");
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        showError("Terjadi kesalahan: " + err.message);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAppState('LOGIN');
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  // --- SIMULASI TOP UP ---
  const handleConfirmPayment = () => {
    setIsVerifying(true);
    setTimeout(async () => {
      try {
        if (user) {
          const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
          await updateDoc(userDocRef, { coins: increment(50) });
          showError("Pembayaran Terverifikasi! 50 Koin ditambahkan.");
          setIsTopUpOpen(false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsVerifying(false);
      }
    }, 3000);
  };

  // --- FILE UPLOAD (PDF/TXT) ---
  useEffect(() => {
    if (!document.getElementById('pdfjs-script')) {
      const script = document.createElement('script');
      script.id = 'pdfjs-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      document.head.appendChild(script);
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      };
    }
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type === 'application/pdf') {
      if (!window.pdfjsLib) {
        showError('Sistem pembaca PDF disiapkan, coba lagi dalam 1 detik.');
        return;
      }
      setIsExtracting(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 15); 
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        setFormData(prev => ({ ...prev, rppText: fullText }));
      } catch (err) {
        showError('Gagal membaca PDF.');
      } finally {
        setIsExtracting(false);
      }
    } else if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => setFormData(prev => ({ ...prev, rppText: event.target.result }));
      reader.readAsText(file);
    } else {
      showError('Format file tidak didukung (.pdf / .txt)');
    }
    e.target.value = null;
  };

  // --- ANALISIS BLOOM ---
  useEffect(() => {
    if (appState !== 'FORM') return;
    const activeBlooms = formData.bloomLevels.filter(b => b.checked).map(b => b.label);
    if (activeBlooms.length === 0) {
      setBloomAnalysis('Pilih minimal satu tingkat Taksonomi Bloom.');
      return;
    }
    setIsAnalyzingBloom(true);
    const timeoutId = setTimeout(async () => {
      try {
        const text = await analyzeBloomWithAI(activeBlooms, formData);
        setBloomAnalysis(text);
      } catch (e) {
        setBloomAnalysis('Gagal memuat analisis.');
      } finally {
        setIsAnalyzingBloom(false);
      }
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [JSON.stringify(formData.bloomLevels), formData.grade, formData.subject, formData.examType, formData.rppText, appState]);

  // --- GENERATE SOAL ---
  const generateQuestions = async () => {
    if (!formData.rppText.trim()) return showError('Isi materi RPP terlebih dahulu.');
    if (formData.questionTypes.filter(t => t.checked && t.count > 0).length === 0) {
      return showError('Pilih setidaknya satu jenis soal.');
    }
    if (coins < 1) return setIsTopUpOpen(true);

    setAppState('LOADING');
    setLoadingStatus('Menganalisis RPP dan merancang soal...');

    try {
      const generatedQuestions = await callGeminiTextAPI(formData);
      setQuestions(generatedQuestions);
      setLoadingStatus('Menggambar ilustrasi kartun...');
      
      const questionsWithImages = [];
      for (const q of generatedQuestions) {
        if (q.imagePrompt && q.imagePrompt.toLowerCase() !== 'none' && q.imagePrompt.trim() !== '') {
          setLoadingStatus(`Menggambar ilustrasi untuk Soal ${q.id}...`);
          const imageUrl = await callImagenAPI(q.imagePrompt);
          questionsWithImages.push({ ...q, imageUrl });
        } else {
          questionsWithImages.push(q);
        }
      }

      if (user) {
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
        await updateDoc(userDocRef, { coins: increment(-1) });
      }

      setQuestions(questionsWithImages);
      setAppState('PREVIEW');
    } catch (err) {
      showError('Gagal: ' + err.message);
      setAppState('FORM');
    }
  };

  const updateQuestionText = (id, newText) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, text: newText } : q));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-5">
          <AlertCircle size={20} />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center relative animate-in zoom-in-95">
            <button onClick={() => setIsTopUpOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <X className="w-6 h-6" />
            </button>
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Isi Ulang Koin</h3>
            <p className="text-sm text-slate-600 mb-6">Dapatkan <b>50 Koin</b> hanya dengan <b>Rp 20.000</b>.</p>
            
            <div className="bg-white p-3 rounded-xl mb-4 border-2 border-dashed border-blue-200 flex justify-center shadow-inner">
               <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg" alt="QRIS" className="w-48 h-48 rounded" />
            </div>
            <p className="text-xs text-slate-500 mb-6">Scan QRIS BCA, Mandiri, GoPay, OVO, Dana.</p>
            
            <button onClick={handleConfirmPayment} disabled={isVerifying} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-medium py-3 rounded-xl shadow-sm flex items-center justify-center">
              {isVerifying ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifikasi...</> : 'Saya Sudah Transfer'}
            </button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-blue-600">
            <Wand2 className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight hidden sm:block">EduQuest<span className="text-slate-800">.ai</span></span>
          </div>
          {user && (
            <div className="flex items-center space-x-3 sm:space-x-6">
              <div className="flex items-center bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                <Coins className="w-4 h-4 text-amber-500 mr-2" />
                <span className="text-sm font-bold text-amber-700 mr-2">{coins}</span>
                <span className="text-xs text-amber-600 hidden sm:inline-block">Koin Tersedia</span>
                <button onClick={() => setIsTopUpOpen(true)} className="ml-3 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded transition-colors">+ Beli</button>
              </div>
              <span className="text-sm font-medium text-slate-600 hidden md:inline-block">{user.name}</span>
              <button onClick={handleLogout} className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium transition-colors">
                <LogOut className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline-block">Keluar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {appState === 'LOGIN' && (
          <div className="max-w-md mx-auto mt-16 bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><BookOpen className="w-8 h-8" /></div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">EduQuest Pro</h1>
            <p className="text-sm text-slate-500 mb-6">Platform AI pembuat soal ujian otomatis Guru SD.</p>
            <div className="bg-blue-50 border border-blue-100 text-blue-800 text-xs p-3 rounded-lg mb-6 text-center">Akses terbatas. Gunakan akun <b>Belajar.id</b> Anda.</div>
            <button onClick={handleGoogleLogin} disabled={isAuthLoading} className="w-full bg-white hover:bg-slate-50 border border-slate-300 disabled:bg-slate-100 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center">
              {isAuthLoading ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : <><svg className="w-5 h-5 mr-3" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>Masuk dengan Akun Belajar.id</>}
            </button>
            <p className="text-xs font-semibold text-amber-600 mt-5 bg-amber-50 py-2 rounded-lg border border-amber-100">🎁 Pengguna Baru Gratis 5 Koin</p>
          </div>
        )}

        {appState === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Settings className="w-5 h-5 mr-2 text-blue-500" /> Parameter Soal</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mata Pelajaran</label>
                    <select value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option>Matematika</option><option>Ilmu Pengetahuan Alam (IPA)</option><option>Ilmu Pengetahuan Sosial (IPS)</option><option>Bahasa Indonesia</option><option>Pendidikan Agama</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Kelas (SD)</label>
                      <select value={formData.grade} onChange={(e) => setFormData({...formData, grade: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                        {[1,2,3,4,5,6].map(num => <option key={num} value={num}>Kelas {num}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Ujian</label>
                      <select value={formData.examType} onChange={(e) => setFormData({...formData, examType: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                        <option>Ulangan Harian</option><option>Ujian Tengah Semester (UTS)</option><option>Ujian Akhir Semester (UAS)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Jenis Soal & Jumlah</label>
                    <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                      {formData.questionTypes.map((type, index) => (
                        <div key={type.id} className="flex items-center justify-between bg-white p-2 rounded border shadow-sm">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" checked={type.checked} onChange={(e) => { const newTypes = [...formData.questionTypes]; newTypes[index].checked = e.target.checked; setFormData({...formData, questionTypes: newTypes}); }} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm font-medium text-slate-700">{type.label}</span>
                          </label>
                          {type.checked && (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-500">Jml:</span>
                              <input type="number" min="1" max="20" value={type.count} onChange={(e) => { const newTypes = [...formData.questionTypes]; newTypes[index].count = parseInt(e.target.value) || 1; setFormData({...formData, questionTypes: newTypes}); }} className="w-16 border rounded px-2 py-1 text-sm outline-none" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Target Taksonomi Bloom</label>
                    <div className="grid grid-cols-2 gap-2 border rounded-lg p-3 bg-slate-50">
                      {formData.bloomLevels.map((level, index) => (
                        <label key={level.id} className="flex items-center space-x-2 cursor-pointer bg-white p-2 rounded border shadow-sm hover:bg-slate-50">
                          <input type="checkbox" checked={level.checked} onChange={(e) => { const newLevels = [...formData.bloomLevels]; newLevels[index].checked = e.target.checked; setFormData({...formData, bloomLevels: newLevels}); }} className="w-4 h-4 text-blue-600 rounded" />
                          <span className="text-xs font-medium text-slate-700">{level.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg shadow-inner">
                      <div className="flex items-center mb-2 text-indigo-700 font-semibold text-xs"><Wand2 className="w-3 h-3 mr-1" /> Analisis AI</div>
                      <div className="text-xs text-indigo-900 leading-relaxed min-h-[40px] whitespace-pre-wrap">{isAnalyzingBloom ? <span className="flex items-center animate-pulse"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengevaluasi...</span> : bloomAnalysis}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span className="flex items-center"><FileText className="w-5 h-5 mr-2 text-green-500" /> Materi / Modul Ajar</span>
                  <label className={`cursor-pointer ${isExtracting ? 'bg-slate-200' : 'bg-slate-100 hover:bg-slate-200'} text-slate-700 py-1.5 px-3 rounded-lg text-sm font-medium flex items-center`}>
                    {isExtracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {isExtracting ? 'Membaca PDF...' : 'Unggah (.txt/.pdf)'}
                    <input type="file" accept=".txt, .pdf" className="hidden" onChange={handleFileUpload} disabled={isExtracting} />
                  </label>
                </h2>
                <p className="text-sm text-slate-500 mb-4">Tempelkan teks materi ajaran atau unggah file RPP.</p>
                <textarea value={formData.rppText} onChange={(e) => setFormData({...formData, rppText: e.target.value})} placeholder="Contoh: Pada bab ini, siswa mempelajari tentang bagian tumbuhan..." className="w-full flex-grow min-h-[250px] p-4 border rounded-xl bg-slate-50 outline-none resize-y text-sm"></textarea>
                
                <div className="mt-6 flex justify-end items-center space-x-4">
                  <span className="text-sm text-slate-500">Biaya: <b className="text-amber-600">1 Koin</b></span>
                  <button onClick={generateQuestions} disabled={!formData.rppText.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-3 px-6 rounded-xl flex items-center">
                    <Wand2 className="w-5 h-5 mr-2" /> Generate Soal & Gambar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {appState === 'LOADING' && (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-blue-100 rounded-full animate-spin border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center"><Wand2 className="w-8 h-8 text-blue-600 animate-pulse" /></div>
            </div>
            <h2 className="mt-8 text-2xl font-bold text-slate-800">Sedang Memproses...</h2>
            <p className="mt-2 text-slate-500 animate-pulse">{loadingStatus}</p>
          </div>
        )}

        {appState === 'PREVIEW' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-2xl shadow-sm border p-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-30">
              <div className="flex items-center space-x-3 text-slate-700">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <span className="font-medium">Selesai! {questions.length} soal dibuat.</span>
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button onClick={() => setAppState('FORM')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium">Edit Pengaturan</button>
                <button onClick={() => exportToWord(formData, questions, coins, showError)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center"><Download className="w-4 h-4 mr-2" /> Unduh .doc</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-8 sm:p-12">
              <div id="printable-doc-area">
                <div className="kop-surat mb-6 pb-4 border-b-4 border-double border-slate-800 flex items-center justify-between" style={{ fontFamily: 'Arial, sans-serif' }}>
                  <div className="w-24 shrink-0"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Logo_of_the_Ministry_of_Education_and_Culture_of_the_Republic_of_Indonesia.svg/400px-Logo_of_the_Ministry_of_Education_and_Culture_of_the_Republic_of_Indonesia.svg.png" alt="Logo" className="w-20 h-auto" /></div>
                  <div className="flex-1 text-center">
                    <div style={{ fontSize: '14pt', lineHeight: 1.15 }}>PEMERINTAH KABUPATEN KEPULAUAN TANIMBAR</div>
                    <div style={{ fontSize: '16pt', fontWeight: 'bold' }}>DINAS PENDIDIKAN DAN KEBUDAYAAN</div>
                    <div style={{ fontSize: '16pt' }}>SD INPRES LELINGLUAN</div>
                    <div style={{ fontSize: '10pt', marginTop: '4px' }}>Jln. Wearnusmurin Lelingluan – Kec. Tanut – Kepulauan Tanimbar</div>
                    <div style={{ fontSize: '10pt' }}>Telepon. (-) , e-mail:sdinpresleling@gmail.com</div>
                  </div>
                  <div className="w-24 shrink-0"></div>
                </div>

                <div className="text-center mb-10"><h1 className="text-xl font-bold uppercase mb-1">SOAL {formData.examType} SD</h1><p className="font-medium">Mata Pelajaran: {formData.subject} | Kelas: {formData.grade}</p></div>

                <div className="space-y-10">
                  {(() => {
                    const grouped = questions.reduce((acc, q) => { const type = q.type || 'Lainnya'; if (!acc[type]) acc[type] = []; acc[type].push(q); return acc; }, {});
                    let globalIndex = 1;
                    return Object.keys(grouped).map(type => (
                      <div key={type} className="mb-10">
                        <div className="bg-blue-50 border-l-4 border-blue-500 px-4 py-2 mb-6 rounded-r-lg"><h3 className="font-bold text-blue-800 text-lg uppercase">Bagian: {type}</h3></div>
                        <div className="space-y-8">
                          {grouped[type].map((q) => {
                            const currentIndex = globalIndex++;
                            return (
                              <div key={q.id} className="soal-container relative ml-2 sm:ml-4">
                                <div className="absolute -left-10 top-0 hidden sm:flex h-8 w-8 bg-blue-100 text-blue-700 rounded-full items-center justify-center text-xs font-bold font-mono">{currentIndex}</div>
                                <div className="flex gap-2">
                                  <span className="font-bold text-slate-800">{currentIndex}.</span>
                                  <div className="w-full text-base font-medium outline-none min-h-[1.5em]" contentEditable suppressContentEditableWarning onBlur={(e) => updateQuestionText(q.id, e.target.innerText)}>{q.text}</div>
                                </div>
                                {q.imageUrl && <div className="my-4"><img src={q.imageUrl} alt={`Ilustrasi`} className="w-[200px] rounded-lg shadow-sm" /></div>}
                                {q.options && q.options.length > 0 && <div className="mt-3 space-y-2 pl-4 sm:pl-0">{q.options.map((opt, i) => <div key={i}><span>{opt}</span></div>)}</div>}
                                {(type.includes('Isian') || type.includes('Esai') || type.includes('Uraian')) && <div className="mt-4 border-b border-dashed border-slate-300 h-6 w-full max-w-lg" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="mt-16 pt-8 border-t-2 border-slate-300">
                  <div className="mb-6 text-center"><h2 className="text-xl font-bold uppercase">Kunci Jawaban</h2></div>
                  <table className="w-full text-sm text-left border rounded-lg shadow-sm">
                    <thead className="bg-slate-100 uppercase text-xs"><tr><th className="px-4 py-3 border w-16 text-center">No</th><th className="px-4 py-3 border">Jawaban Benar</th><th className="px-4 py-3 border text-center">Taksonomi</th></tr></thead>
                    <tbody>
                      {(() => {
                        const grouped = questions.reduce((acc, q) => { const type = q.type || 'Lainnya'; if (!acc[type]) acc[type] = []; acc[type].push(q); return acc; }, {});
                        let answerIndex = 1; let rows = [];
                        Object.keys(grouped).forEach(type => {
                          rows.push(<tr key={`header-${type}`} className="bg-slate-50"><td colSpan="3" className="px-4 py-2 text-center font-bold text-slate-600 text-xs uppercase border">{type}</td></tr>);
                          grouped[type].forEach(q => { rows.push(<tr key={`ans-${q.id}`} className="bg-white"><td className="px-4 py-3 border font-bold text-center">{answerIndex++}</td><td className="px-4 py-3 border font-medium text-green-700">{q.answer}</td><td className="px-4 py-3 border text-center"><span className="text-blue-700 font-bold text-xs px-2 py-1 bg-blue-100 rounded-md">{q.bloomLevel.split('(')[0].trim()}</span></td></tr>); });
                        }); return rows;
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}