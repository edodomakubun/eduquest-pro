'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, Upload, Settings, Wand2, Download, ChevronRight, 
  FileText, CheckCircle2, AlertCircle, Loader2, LogOut, 
  Coins, CreditCard, X, ShieldCheck, Image as ImageIcon, Users, Check
} from 'lucide-react';

// --- Impor Fungsi Eksternal (Modular) ---
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { analyzeBloomWithAI, callGeminiTextAPI, callImagenAPI } from '../lib/ai';
import { exportToWord } from '../lib/exportWord';

const appId = 'eduquest-pro';

export default function Home() {
  const router = useRouter(); 
  const [appState, setAppState] = useState('FORM'); // FORM, LOADING, PREVIEW
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State Form Generate
  const [formData, setFormData] = useState({
    subject: 'Matematika', grade: '1', examType: 'Ulangan Harian',
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

  // --- LOGIKA DATABASE REALTIME ---
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCoins(docSnap.data().coins);
      } else {
        setDoc(userDocRef, { name: user.name, email: user.email, coins: 20, createdAt: new Date().toISOString() });
        setCoins(20);
      }
    }, (error) => console.error(error));
    return () => unsubUser();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); };

  // --- LOGIKA GENERATE SOAL ---
  const generateQuestions = async () => {
    if (!formData.rppText.trim()) return showError('Isi materi RPP terlebih dahulu.');
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
    setLoadingStatus('Menganalisis RPP dan merancang soal...');

    try {
      const generatedQuestions = await callGeminiTextAPI(formData);
      setQuestions(generatedQuestions);
      setLoadingStatus('Menggambar ilustrasi kartun...');
      
      const questionsWithImages = [];
      for (const q of generatedQuestions) {
        if (q.imagePrompt && q.imagePrompt.toLowerCase() !== 'none') {
          setLoadingStatus(`Menggambar ilustrasi untuk Soal ${q.id}...`);
          const imageUrl = await callImagenAPI(q.imagePrompt);
          questionsWithImages.push({ ...q, imageUrl });
        } else {
          questionsWithImages.push(q);
        }
      }

      setQuestions(questionsWithImages);
      setAppState('PREVIEW');
    } catch (err) {
      showError('Gagal membuat soal: ' + err.message);
      setAppState('FORM'); 
    }
  };

  // --- FILE UPLOAD RPP (PDF/TXT) & BLOOM AI ---
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
      } catch (err) { showError('Gagal membaca PDF.'); } finally { setIsExtracting(false); }
    } else if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => setFormData(prev => ({ ...prev, rppText: event.target.result }));
      reader.readAsText(file);
    } else { showError('Format file tidak didukung.'); }
    e.target.value = null;
  };

  useEffect(() => {
    if (appState !== 'FORM') return;
    const activeBlooms = formData.bloomLevels.filter(b => b.checked).map(b => b.label);
    if (activeBlooms.length === 0) return setBloomAnalysis('Pilih minimal satu tingkat Taksonomi Bloom.');
    setIsAnalyzingBloom(true);
    const timeoutId = setTimeout(async () => {
      try { setBloomAnalysis(await analyzeBloomWithAI(activeBlooms, formData)); } 
      catch (e) { setBloomAnalysis('Gagal memuat analisis.'); } 
      finally { setIsAnalyzingBloom(false); }
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [JSON.stringify(formData.bloomLevels), formData.grade, formData.subject, formData.examType, formData.rppText, appState]);

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg flex items-center space-x-2 animate-in fade-in">
          <AlertCircle size={20} /> <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-blue-600 cursor-pointer" onClick={() => { if(user) setAppState('FORM') }}>
            <Wand2 className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight hidden sm:block">EduQuest<span className="text-slate-800">.ai</span></span>
          </div>
          {user && (
            <div className="flex items-center space-x-3 sm:space-x-6">
              <div className="flex items-center bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                <Coins className="w-4 h-4 text-amber-500 mr-2" />
                <span className="text-sm font-bold text-amber-700 mr-2">{coins}</span>
                <span className="text-xs text-amber-600 hidden sm:inline-block">Koin</span>
                <button onClick={() => router.push('/payment')} className="ml-3 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded transition-colors">+ Top Up</button>
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
        
        {/* MAIN FORM GENERATE (USER) */}
        {appState === 'FORM' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Settings className="w-5 h-5 mr-2 text-blue-500" /> Parameter Soal</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mata Pelajaran</label>
                    <select value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none">
                      <option>Matematika</option><option>Ilmu Pengetahuan Alam (IPA)</option><option>Ilmu Pengetahuan Sosial (IPS)</option><option>Bahasa Indonesia</option><option>Pendidikan Agama</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Kelas (SD)</label>
                      <select value={formData.grade} onChange={(e) => setFormData({...formData, grade: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none">
                        {[1,2,3,4,5,6].map(num => <option key={num} value={num}>Kelas {num}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Ujian</label>
                      <select value={formData.examType} onChange={(e) => setFormData({...formData, examType: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none">
                        <option>Ulangan Harian</option><option>Ujian Tengah Semester (UTS)</option><option>Ujian Akhir Semester (UAS)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Jenis Soal & Jumlah</label>
                    <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
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
                        <label key={level.id} className="flex items-center space-x-2 cursor-pointer bg-white p-2 rounded border shadow-sm">
                          <input type="checkbox" checked={level.checked} onChange={(e) => { const newLevels = [...formData.bloomLevels]; newLevels[index].checked = e.target.checked; setFormData({...formData, bloomLevels: newLevels}); }} className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-medium text-slate-700">{level.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg shadow-inner">
                      <div className="flex items-center mb-2 text-indigo-700 font-semibold text-xs"><Wand2 className="w-3 h-3 mr-1" /> Analisis AI</div>
                      <div className="text-xs text-indigo-900 leading-relaxed min-h-[40px]">{isAnalyzingBloom ? <span className="flex items-center animate-pulse"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengevaluasi...</span> : bloomAnalysis}</div>
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
                <textarea value={formData.rppText} onChange={(e) => setFormData({...formData, rppText: e.target.value})} className="w-full flex-grow min-h-[250px] p-4 border rounded-xl bg-slate-50 outline-none resize-y text-sm"></textarea>
                
                <div className="mt-6 flex justify-end items-center space-x-4">
                  <span className="text-sm text-slate-500 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">Biaya Generate: <b className="text-amber-700">10 Koin</b></span>
                  <button onClick={generateQuestions} disabled={!formData.rppText.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-3 px-6 rounded-xl flex items-center transition-all shadow-sm">
                    <Wand2 className="w-5 h-5 mr-2" /> Generate Soal & Gambar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOADING & PREVIEW STATES */}
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
                <span className="font-medium">Selesai! {questions.length} soal dibuat. (Sisa Koin: {coins})</span>
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button onClick={() => setAppState('FORM')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium">Buat Soal Baru</button>
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
                                  <div className="w-full text-base font-medium outline-none min-h-[1.5em]" contentEditable suppressContentEditableWarning>{q.text}</div>
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
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}