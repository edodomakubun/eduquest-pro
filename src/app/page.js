'use client'; 

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Upload, Settings, Wand2, Download, ChevronRight, 
  FileText, CheckCircle2, AlertCircle, Loader2, LogOut, 
  Coins, CreditCard, X, ShieldCheck, Image as ImageIcon, Users, Check
} from 'lucide-react';

// --- Impor Fungsi Eksternal (Modular) ---
import { auth, db, googleProvider } from '../lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, updateDoc, increment, collection, addDoc, query, orderBy } from 'firebase/firestore';
import { analyzeBloomWithAI, callGeminiTextAPI, callImagenAPI } from '../lib/ai';
import { exportToWord } from '../lib/exportWord';

const appId = 'eduquest-pro';

export default function Home() {
  const [appState, setAppState] = useState('LOGIN'); // LOGIN, FORM, LOADING, PREVIEW, PAYMENT, ADMIN
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [coins, setCoins] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
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
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // State Payment (User)
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [paymentProofBase64, setPaymentProofBase64] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [userPendingTx, setUserPendingTx] = useState(null);

  // State Admin
  const [adminTab, setAdminTab] = useState('users'); // users, transactions, settings
  const [allUsers, setAllUsers] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [previewImage, setPreviewImage] = useState(null); // Modal bukti transfer

  // --- LOGIKA AUTHENTICATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email || '';
        
        // Mengecek apakah yang login adalah Admin yang ditentukan
        const isUserAdmin = email === 'operator.sdinpresleling2023@gmail.com';
        
        if (email.endsWith('@guru.sd.belajar.id') || isUserAdmin) {
          setUser({ uid: currentUser.uid, name: currentUser.displayName || 'Guru', email: email });
          setIsAdmin(isUserAdmin);
          if (isUserAdmin && appState === 'LOGIN') setAppState('ADMIN');
          else if (appState === 'LOGIN') setAppState('FORM');
        } else {
          await signOut(auth);
          setUser(null);
          showError("Akses Ditolak! Hanya untuk akun @guru.sd.belajar.id atau Admin.");
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, [appState]);

  // --- LOGIKA DATABASE REALTIME ---
  useEffect(() => {
    if (!user) return;

    // 1. Data User Pribadi (Koin)
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCoins(docSnap.data().coins);
      } else {
        setDoc(userDocRef, { name: user.name, email: user.email, coins: 20, createdAt: new Date().toISOString() });
        setCoins(20);
      }
    }, (error) => console.error(error));

    // 2. Data QR Code Global
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) setQrCodeUrl(docSnap.data().qrCodeImage || '');
    });

    // 3. Data Transaksi User Pribadi (Cek apakah ada yang pending)
    const txColRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubTxUser = onSnapshot(txColRef, (snapshot) => {
      const myPending = snapshot.docs.map(d => ({id: d.id, ...d.data()})).find(tx => tx.uid === user.uid && tx.status === 'pending');
      setUserPendingTx(myPending || null);
    });

    return () => { unsubUser(); unsubSettings(); unsubTxUser(); };
  }, [user]);

  // --- LOGIKA DATABASE ADMIN (Realtime Semua User & Transaksi) ---
  useEffect(() => {
    if (!isAdmin) return;
    
    const usersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'profiles');
    const unsubUsers = onSnapshot(usersColRef, (snapshot) => {
      setAllUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const txColRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubAllTx = onSnapshot(txColRef, (snapshot) => {
      setAllTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });

    return () => { unsubUsers(); unsubAllTx(); };
  }, [isAdmin]);

  // --- HELPER COMPRESSION GAMBAR (Base64 Aman untuk Firebase) ---
  const handleImageToAPI = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let scaleSize = 1;
        if (img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // --- HANDLER LOGIN & LOGOUT ---
  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email || '';
      
      // Validasi saat popup Google selesai
      if (email.endsWith('@guru.sd.belajar.id') || email === 'operator.sdinpresleling2023@gmail.com') {
        setAppState('FORM');
      } else {
        await signOut(auth);
        showError("Akses Ditolak! Gunakan akun Belajar.id atau email Admin.");
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') showError("Terjadi kesalahan: " + err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAppState('LOGIN');
  };

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); };
  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };

  // --- LOGIKA PEMBAYARAN (USER) ---
  const submitPaymentProof = async () => {
    if (!paymentProofBase64) return showError('Harap unggah bukti transfer!');
    setIsSubmittingPayment(true);
    try {
      const txRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
      await addDoc(txRef, {
        uid: user.uid,
        userName: user.name,
        userEmail: user.email,
        packageName: selectedPackage.name,
        coinsToAdd: selectedPackage.coins,
        price: selectedPackage.price,
        proofImage: paymentProofBase64,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setSelectedPackage(null);
      setPaymentProofBase64('');
      showSuccess('Bukti terkirim! Menunggu verifikasi admin.');
    } catch (error) {
      showError('Gagal mengirim bukti: ' + error.message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const downloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = 'QR_Pembayaran_EduQuest.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- LOGIKA ADMIN ---
  const handleUploadAdminQR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    handleImageToAPI(file, async (base64) => {
      try {
        const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
        await setDoc(settingsRef, { qrCodeImage: base64 }, { merge: true });
        showSuccess('QR Code berhasil diperbarui!');
      } catch (err) {
        showError('Gagal update QR Code.');
      }
    });
  };

  const approveTransaction = async (tx) => {
    try {
      // 1. Tambah Koin User
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', tx.uid);
      await updateDoc(userRef, { coins: increment(tx.coinsToAdd) });
      // 2. Ubah Status Transaksi
      const txRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', tx.id);
      await updateDoc(txRef, { status: 'approved', approvedAt: new Date().toISOString() });
      showSuccess(`Berhasil menyetujui ${tx.packageName} untuk ${tx.userName}`);
    } catch (error) {
      showError('Gagal menyetujui: ' + error.message);
    }
  };

  // --- LOGIKA GENERATE SOAL (DEDUCT KOIN FINAL) ---
  const generateQuestions = async () => {
    if (!formData.rppText.trim()) return showError('Isi materi RPP terlebih dahulu.');
    if (formData.questionTypes.filter(t => t.checked && t.count > 0).length === 0) return showError('Pilih setidaknya satu jenis soal.');
    
    // ATURAN: 10 Koin per Generate
    if (coins < 10) {
      setAppState('PAYMENT');
      return;
    }

    // ATURAN: POTONG KOIN DI AWAL
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
      // Jika error, koin tetap terpotong sesuai aturan finalitas.
      showError('Gagal membuat soal: ' + err.message);
      setAppState('FORM'); 
    }
  };

  // --- FILE UPLOAD RPP (PDF/TXT) & BLOOM AI ---
  // (Sama seperti versi sebelumnya)
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* Toast Messages */}
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg flex items-center space-x-2 animate-in fade-in">
          <AlertCircle size={20} /> <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 size={20} /> <span className="font-medium text-sm">{successMsg}</span>
        </div>
      )}

      {/* Modal Image Preview (Admin) */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Bukti Pembayaran" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-blue-600 cursor-pointer" onClick={() => { if(user && !isAdmin) setAppState('FORM') }}>
            <Wand2 className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight hidden sm:block">EduQuest<span className="text-slate-800">.ai</span></span>
          </div>
          {user && (
            <div className="flex items-center space-x-3 sm:space-x-6">
              {isAdmin ? (
                <div className="flex items-center text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4 mr-2" /> Mode Admin Aktif
                </div>
              ) : (
                <div className="flex items-center bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                  <Coins className="w-4 h-4 text-amber-500 mr-2" />
                  <span className="text-sm font-bold text-amber-700 mr-2">{coins}</span>
                  <span className="text-xs text-amber-600 hidden sm:inline-block">Koin</span>
                  <button onClick={() => setAppState('PAYMENT')} className="ml-3 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded">+ Top Up</button>
                </div>
              )}
              <span className="text-sm font-medium text-slate-600 hidden md:inline-block">{user.name}</span>
              <button onClick={handleLogout} className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium transition-colors">
                <LogOut className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline-block">Keluar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* LOGIN STATE */}
        {appState === 'LOGIN' && (
          <div className="max-w-md mx-auto mt-16 bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><BookOpen className="w-8 h-8" /></div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">EduQuest Pro</h1>
            <p className="text-sm text-slate-500 mb-6">Platform AI pembuat soal ujian otomatis Guru SD.</p>
            <div className="bg-blue-50 border border-blue-100 text-blue-800 text-xs p-3 rounded-lg mb-6 text-center">Gunakan akun <b>@guru.sd.belajar.id</b> atau <b>Email Admin</b></div>
            <button onClick={handleGoogleLogin} disabled={isAuthLoading} className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium py-3 px-4 rounded-xl flex items-center justify-center shadow-sm">
              {isAuthLoading ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : <><img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="G" className="w-5 h-5 mr-3"/> Masuk dengan Google</>}
            </button>
          </div>
        )}

        {/* PAYMENT & TOPUP STATE (USER) */}
        {appState === 'PAYMENT' && !isAdmin && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-slate-800 flex items-center"><CreditCard className="w-6 h-6 mr-2 text-blue-600" /> Beli Koin</h1>
              <button onClick={() => setAppState('FORM')} className="text-slate-500 hover:text-slate-800 text-sm">Kembali ke Beranda</button>
            </div>

            {userPendingTx ? (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center">
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-bold text-amber-800 mb-2">Pembayaran Sedang Diproses</h3>
                <p className="text-amber-700">Mohon tunggu sejenak, pembayaran paket <b>{userPendingTx.packageName}</b> Anda sedang dalam proses verifikasi oleh Admin.</p>
              </div>
            ) : !selectedPackage ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { name: 'Paket Basic', coins: 100, generate: 10, price: 20000, color: 'blue' },
                  { name: 'Paket Basic+', coins: 150, generate: 15, price: 28000, color: 'indigo' },
                  { name: 'Paket Premium', coins: 200, generate: 20, price: 35000, color: 'purple' }
                ].map(pkg => (
                  <div key={pkg.name} className={`bg-white rounded-2xl p-6 border-2 border-${pkg.color}-100 hover:border-${pkg.color}-500 shadow-sm cursor-pointer transition-all hover:shadow-md flex flex-col`} onClick={() => setSelectedPackage(pkg)}>
                    <h3 className={`text-xl font-bold text-${pkg.color}-700 mb-1`}>{pkg.name}</h3>
                    <div className="text-3xl font-black text-slate-800 mb-4 flex items-center"><Coins className="w-6 h-6 mr-2 text-amber-500"/> {pkg.coins} <span className="text-sm font-medium text-slate-500 ml-2">Koin</span></div>
                    <ul className="text-sm text-slate-600 mb-6 flex-grow space-y-2">
                      <li className="flex items-center"><Check className="w-4 h-4 mr-2 text-green-500"/> Bisa untuk {pkg.generate}x Generate</li>
                      <li className="flex items-center"><Check className="w-4 h-4 mr-2 text-green-500"/> (Biaya 10 Koin / generate)</li>
                      <li className="flex items-center"><Check className="w-4 h-4 mr-2 text-green-500"/> Ilustrasi AI Kualitas Tinggi</li>
                    </ul>
                    <div className={`w-full text-center bg-${pkg.color}-50 text-${pkg.color}-700 font-bold py-3 rounded-xl`}>Rp {pkg.price.toLocaleString('id-ID')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col md:flex-row gap-8">
                <div className="flex-1 text-center md:text-left border-b md:border-b-0 md:border-r border-slate-200 pb-8 md:pb-0 md:pr-8">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Selesaikan Pembayaran</h3>
                  <p className="text-slate-600 text-sm mb-6">Anda memilih <b>{selectedPackage.name} ({selectedPackage.coins} Koin)</b> seharga <b>Rp {selectedPackage.price.toLocaleString('id-ID')}</b>. Silakan scan QRIS di bawah ini.</p>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 inline-block mb-4 mx-auto md:mx-0">
                    {qrCodeUrl ? <img src={qrCodeUrl} alt="QRIS" className="w-48 h-48 object-cover rounded shadow-sm" /> : <div className="w-48 h-48 bg-slate-200 flex items-center justify-center text-sm text-slate-500 rounded">Belum ada QR Code dari Admin</div>}
                  </div>
                  <br />
                  <button onClick={downloadQR} disabled={!qrCodeUrl} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg text-sm flex items-center justify-center mx-auto md:mx-0 transition-colors">
                    <Download className="w-4 h-4 mr-2" /> Unduh QR Code
                  </button>
                </div>
                
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Konfirmasi Transfer</h3>
                  <label className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors mb-4">
                    <ImageIcon className="w-8 h-8 mb-2 text-slate-400" />
                    <span className="text-sm text-center">{paymentProofBase64 ? "Bukti Terlampir (Klik untuk mengganti)" : "Unggah Screenshot Bukti Transfer"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files[0]) handleImageToAPI(e.target.files[0], setPaymentProofBase64) }} />
                  </label>
                  {paymentProofBase64 && <img src={paymentProofBase64} alt="Preview" className="h-20 object-contain mb-4 rounded border" />}
                  
                  <button onClick={submitPaymentProof} disabled={isSubmittingPayment || !paymentProofBase64} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl shadow-sm flex items-center justify-center transition-all">
                    {isSubmittingPayment ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : 'Kirim Bukti Pembayaran'}
                  </button>
                  <button onClick={() => setSelectedPackage(null)} className="w-full text-slate-500 hover:text-slate-700 text-sm mt-3 font-medium">Batal & Pilih Paket Lain</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DASHBOARD ADMIN */}
        {appState === 'ADMIN' && isAdmin && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex space-x-2 border-b border-slate-200">
              {[{ id: 'users', label: 'Data User', icon: Users }, { id: 'transactions', label: 'Verifikasi Pembayaran', icon: ShieldCheck }, { id: 'settings', label: 'Pengaturan QR', icon: Settings }].map(tab => (
                <button key={tab.id} onClick={() => setAdminTab(tab.id)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${adminTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  <tab.icon className="w-4 h-4 mr-2" /> {tab.label}
                </button>
              ))}
            </div>

            {/* TAB: DATA USER */}
            {adminTab === 'users' && (
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 flex justify-between"><span>Daftar Guru / Pengguna</span> <span>Total: {allUsers.length}</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Nama</th><th className="p-4">Email</th><th className="p-4">Sisa Koin</th><th className="p-4">Mendaftar</th></tr></thead>
                    <tbody>
                      {allUsers.map((u, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="p-4 font-medium">{u.name}</td><td className="p-4 text-slate-500">{u.email}</td>
                          <td className="p-4 font-bold text-amber-600">{u.coins}</td>
                          <td className="p-4 text-slate-400 text-xs">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: VERIFIKASI TRANSAKSI */}
            {adminTab === 'transactions' && (
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b font-bold text-slate-700">Riwayat & Permintaan Pembayaran</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">User</th><th className="p-4">Paket</th><th className="p-4">Waktu</th><th className="p-4 text-center">Bukti</th><th className="p-4 text-right">Aksi</th></tr></thead>
                    <tbody>
                      {allTransactions.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-500">Belum ada transaksi.</td></tr>}
                      {allTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b hover:bg-slate-50">
                          <td className="p-4">
                            <div className="font-medium">{tx.userName}</div>
                            <div className="text-xs text-slate-500">{tx.userEmail}</div>
                          </td>
                          <td className="p-4 font-bold text-blue-700">{tx.packageName}</td>
                          <td className="p-4 text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString('id-ID')}</td>
                          <td className="p-4 text-center">
                            <button onClick={() => setPreviewImage(tx.proofImage)} className="text-blue-600 hover:underline flex flex-col items-center mx-auto"><ImageIcon className="w-5 h-5 mb-1" /> Lihat</button>
                          </td>
                          <td className="p-4 text-right">
                            {tx.status === 'pending' ? (
                              <button onClick={() => approveTransaction(tx)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs shadow-sm">Setujui (+{tx.coinsToAdd})</button>
                            ) : (
                              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Selesai</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: PENGATURAN QR CODE */}
            {adminTab === 'settings' && (
              <div className="max-w-md bg-white border rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">Ubah QR Code Pembayaran (User)</h3>
                <div className="bg-slate-50 p-4 border rounded-xl flex justify-center mb-4">
                  {qrCodeUrl ? <img src={qrCodeUrl} alt="QR Aktif" className="max-w-full h-48 object-cover rounded" /> : <span className="text-slate-400">Belum ada QR Code</span>}
                </div>
                <label className="bg-blue-50 border border-blue-200 text-blue-700 font-medium py-2 px-4 rounded-lg flex justify-center cursor-pointer hover:bg-blue-100 transition-colors">
                  <Upload className="w-4 h-4 mr-2" /> Unggah Gambar QR Baru
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadAdminQR} />
                </label>
              </div>
            )}
          </div>
        )}

        {/* MAIN FORM GENERATE (USER) */}
        {appState === 'FORM' && !isAdmin && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* PARAMETER SOAL */}
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

            {/* AREA RPP & GENERATE */}
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