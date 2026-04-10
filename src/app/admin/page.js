'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, Users, Settings, Image as ImageIcon, Upload, LogOut, 
  CheckCircle2, AlertCircle, Loader2, Plus, Save, Eye, EyeOff, Trash2, X,
  Clock, ChevronLeft, FileText, Zap, ShieldAlert, CreditCard
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, updateDoc, increment, collection } from 'firebase/firestore';

const appId = 'eduquest-pro';

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [adminTab, setAdminTab] = useState('transactions'); 
  const [allUsers, setAllUsers] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [packages, setPackages] = useState([]);
  
  // State untuk Rekening Bank (Fitur Baru)
  const [bankDetails, setBankDetails] = useState({ bankName: '', accountName: '', accountNumber: '' });
  
  const [selectedUserHistory, setSelectedUserHistory] = useState(null); 
  const [userHistories, setUserHistories] = useState([]);
  const [viewingDetail, setViewingDetail] = useState(null);
  
  const [previewImage, setPreviewImage] = useState(null); 
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSavingPackages, setIsSavingPackages] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email === 'operator.sdinpresleling2023@gmail.com') {
        setIsAdmin(true);
      } else {
        router.push('/login'); 
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;
    
    // 1. Ambil Data User
    const usersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'profiles');
    const unsubUsers = onSnapshot(usersColRef, (snapshot) => {
      setAllUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Ambil Data Transaksi
    const txColRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubAllTx = onSnapshot(txColRef, (snapshot) => {
      setAllTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });

    // 3. Ambil Data Paket & Info Bank
    const pkgsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'packages');
    const unsubPkgs = onSnapshot(pkgsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPackages(data.items || []);
        if (data.bankDetails) setBankDetails(data.bankDetails);
      } else {
        const defaultPkgs = [
          { id: 'pkg_1', name: 'Paket Basic', coins: 100, generate: 10, price: 20000, color: 'blue', isActive: true, qrCode: '' },
          { id: 'pkg_2', name: 'Paket Basic+', coins: 150, generate: 15, price: 28000, color: 'indigo', isActive: true, qrCode: '' },
          { id: 'pkg_3', name: 'Paket Premium', coins: 200, generate: 20, price: 35000, color: 'purple', isActive: true, qrCode: '' }
        ];
        const defaultBank = { bankName: 'BCA', accountName: 'Admin EduQuest', accountNumber: '1234567890' };
        setDoc(pkgsRef, { items: defaultPkgs, bankDetails: defaultBank });
      }
    });

    return () => { unsubUsers(); unsubAllTx(); unsubPkgs(); };
  }, [isAdmin]);

  // --- LOGIKA MENGAMBIL RIWAYAT SATU USER ---
  useEffect(() => {
    if (!selectedUserHistory) return;
    const histRef = collection(db, 'artifacts', appId, 'public', 'data', 'history', selectedUserHistory.id, 'saved_exams');
    const unsub = onSnapshot(histRef, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUserHistories(docs);
    }, (error) => console.error("Gagal menarik riwayat user:", error));
    return () => unsub();
  }, [selectedUserHistory]);

  useEffect(() => {
    setSelectedUserHistory(null);
    setViewingDetail(null);
  }, [adminTab]);

  const handleImageToAPI = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let scaleSize = img.width > 800 ? 800 / img.width : 1;
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

  const approveTransaction = async (tx) => {
    try {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', tx.uid);
      await updateDoc(userRef, { coins: increment(tx.coinsToAdd), isPremium: true });
      
      const txRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', tx.id);
      await updateDoc(txRef, { status: 'approved', approvedAt: new Date().toISOString() });
      showSuccess(`Berhasil menyetujui ${tx.packageName} untuk ${tx.userName}`);
    } catch (error) { showError('Gagal menyetujui: ' + error.message); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); };
  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };

  const updatePackage = (index, field, value) => {
    const newPkgs = [...packages];
    newPkgs[index][field] = value;
    setPackages(newPkgs);
  };

  const handleUploadPackageQR = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;
    handleImageToAPI(file, (base64) => { updatePackage(index, 'qrCode', base64); });
  };

  const addNewPackage = () => {
    const newPkg = { id: 'pkg_' + Date.now(), name: 'Paket Baru', coins: 50, generate: 5, price: 10000, color: 'slate', isActive: false, qrCode: '' };
    setPackages([...packages, newPkg]);
  };

  const deletePackage = (index) => {
    if (confirm('Yakin ingin menghapus paket ini?')) {
      const newPkgs = packages.filter((_, i) => i !== index);
      setPackages(newPkgs);
    }
  };

  const savePackagesToDB = async () => {
    setIsSavingPackages(true);
    try {
      const pkgsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'packages');
      // Menyimpan detail paket DAN detail bank secara bersamaan
      await setDoc(pkgsRef, { items: packages, bankDetails: bankDetails });
      showSuccess('Semua pengaturan paket & Rekening Bank berhasil disimpan!');
    } catch (e) {
      showError('Gagal menyimpan paket: ' + e.message);
    } finally {
      setIsSavingPackages(false);
    }
  };

  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-20">
      {errorMsg && <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center"><AlertCircle className="w-5 h-5 mr-2" />{errorMsg}</div>}
      {successMsg && <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center"><CheckCircle2 className="w-5 h-5 mr-2" />{successMsg}</div>}

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Bukti Pembayaran" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      <header className="bg-indigo-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-bold text-xl"><ShieldCheck className="w-6 h-6 mr-2 text-indigo-300" /> Admin EduQuest</div>
          <button onClick={handleLogout} className="flex items-center text-indigo-100 hover:text-white font-medium text-sm"><LogOut className="w-4 h-4 mr-2" /> Keluar</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex space-x-2 border-b border-slate-300 mb-6 overflow-x-auto hide-scrollbar">
          {[{ id: 'transactions', label: 'Verifikasi Pembayaran', icon: ShieldCheck }, { id: 'users', label: 'Data User & Pemantauan', icon: Users }, { id: 'settings', label: 'Pengaturan Paket', icon: Settings }].map(tab => (
            <button key={tab.id} onClick={() => setAdminTab(tab.id)} className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center ${adminTab === tab.id ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <tab.icon className="w-4 h-4 mr-2" /> {tab.label}
              {tab.id === 'transactions' && allTransactions.filter(t => t.status === 'pending').length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{allTransactions.filter(t => t.status === 'pending').length}</span>
              )}
            </button>
          ))}
        </div>

        {/* TAB: VERIFIKASI TRANSAKSI */}
        {adminTab === 'transactions' && (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-50 border-b font-bold text-slate-700">Riwayat & Permintaan Pembayaran</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">User</th><th className="p-4">Paket & Metode</th><th className="p-4">Waktu</th><th className="p-4 text-center">Bukti</th><th className="p-4 text-right">Aksi</th></tr></thead>
                <tbody>
                  {allTransactions.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-500">Belum ada transaksi.</td></tr>}
                  {allTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-slate-50">
                      <td className="p-4"><div className="font-medium">{tx.userName}</div><div className="text-xs text-slate-500">{tx.userEmail}</div></td>
                      <td className="p-4">
                        <div className="font-bold text-indigo-700">{tx.packageName}</div>
                        <div className="text-xs font-medium text-slate-500 mt-1 flex items-center">
                          {tx.paymentMethod === 'Transfer_Bank' ? <><CreditCard className="w-3 h-3 mr-1" /> Transfer Bank</> : <><Zap className="w-3 h-3 mr-1" /> QRIS</>}
                        </div>
                      </td>
                      <td className="p-4 text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString('id-ID')}</td>
                      <td className="p-4 text-center"><button onClick={() => setPreviewImage(tx.proofImage)} className="text-blue-600 hover:underline flex flex-col items-center mx-auto"><ImageIcon className="w-5 h-5 mb-1" /> Lihat</button></td>
                      <td className="p-4 text-right">
                        {tx.status === 'pending' ? (
                          <button onClick={() => approveTransaction(tx)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs shadow-sm">Setujui (+{tx.coinsToAdd})</button>
                        ) : (<span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">Disetujui</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: DATA USER & PEMANTAUAN RIWAYAT */}
        {adminTab === 'users' && (
          <div className="space-y-6 animate-in fade-in">
            {selectedUserHistory ? (
              viewingDetail ? (
                /* --- MODE ADMIN: MELIHAT DETAIL SOAL + KONTEKS --- */
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-xl border shadow-sm gap-4">
                    <div className="flex items-center space-x-3 text-slate-700">
                      <div className="bg-indigo-100 p-2 rounded-lg"><FileText className="w-5 h-5 text-indigo-600" /></div>
                      <div>
                        <span className="font-bold block">Detail Log Aktivitas: {selectedUserHistory.name}</span>
                        <span className="text-xs text-slate-500">Mata Pelajaran: {viewingDetail.subject} (Kelas {viewingDetail.grade})</span>
                      </div>
                    </div>
                    <button onClick={() => setViewingDetail(null)} className="px-4 py-2 w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center justify-center transition-colors">
                      <ChevronLeft className="w-4 h-4 mr-1"/> Kembali ke Daftar Riwayat
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-1 md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="font-bold text-slate-800 flex items-center mb-3"><FileText className="w-5 h-5 mr-2 text-indigo-500"/> Materi Sumber</h3>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 flex-grow max-h-[250px] overflow-y-auto" style={{ whiteSpace: 'pre-wrap' }}>
                        {viewingDetail.formData?.rppText ? viewingDetail.formData.rppText : <span className="italic text-slate-400">Tidak ada materi sumber yang dicatat.</span>}
                      </div>
                    </div>

                    <div className="col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-800 flex items-center mb-4"><Settings className="w-5 h-5 mr-2 text-slate-500"/> Parameter Generate</h3>
                      <div className="space-y-4">
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Target Taksonomi Bloom</span>
                          <div className="flex flex-wrap gap-1.5">
                            {viewingDetail.formData?.bloomLevels?.filter(b => b.checked).length > 0 
                              ? viewingDetail.formData.bloomLevels.filter(b => b.checked).map(b => (
                                  <span key={b.id} className="bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-md">{b.id.toUpperCase()}</span>
                                ))
                              : <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">Default AI</span>
                            }
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Komposisi Jenis Soal</span>
                          <div className="flex flex-wrap gap-1.5">
                            {viewingDetail.formData?.questionTypes?.filter(t => t.checked && t.count > 0).map(t => (
                              <span key={t.id} className="bg-green-50 border border-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md">
                                {t.label} ({t.count})
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Snapshot Status Akun</span>
                          {viewingDetail.isPremiumSnapshot ? (
                            <div className="inline-flex items-center bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                              <Zap className="w-4 h-4 mr-1.5 fill-current"/> Premium (Pro) Tier
                            </div>
                          ) : (
                            <div className="inline-flex items-center bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg">
                              <ShieldAlert className="w-4 h-4 mr-1.5"/> Free / Trial Tier
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* HASIL SOAL YANG DI-GENERATE */}
                  <div className="bg-white rounded-2xl shadow-sm border p-8">
                    <h3 className="font-bold text-slate-800 text-lg mb-6 border-b pb-3">Hasil Soal yang Dibuat</h3>
                    <div className="space-y-10">
                      {(() => {
                        const grouped = (viewingDetail.questions || []).reduce((acc, q) => { const type = q.type || 'Lainnya'; if (!acc[type]) acc[type] = []; acc[type].push(q); return acc; }, {});
                        let globalIndex = 1;
                        return Object.keys(grouped).map(type => (
                          <div key={type} className="mb-10">
                            <div className="bg-slate-50 border-l-4 border-slate-400 px-4 py-2 mb-6 rounded-r-lg"><h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{type}</h4></div>
                            <div className="space-y-8">
                              {grouped[type].map((q) => {
                                const currentIndex = globalIndex++;
                                return (
                                  <div key={q.id} className="relative ml-2 sm:ml-4">
                                    <div className="absolute -left-8 top-0 hidden sm:flex h-6 w-6 bg-slate-100 text-slate-600 rounded-full items-center justify-center text-xs font-bold">{currentIndex}</div>
                                    <div className="flex flex-col sm:flex-row gap-6">
                                      <div className="flex-1">
                                        <div className="flex gap-2">
                                          <span className="font-bold text-slate-800 sm:hidden">{currentIndex}.</span>
                                          <div className="w-full text-sm font-medium text-slate-800">{q.text}</div>
                                        </div>
                                        {q.imageUrl && <div className="my-3"><img src={q.imageUrl} alt={`Ilustrasi`} className="w-48 h-auto rounded-lg border border-slate-200 shadow-sm" /></div>}
                                        {q.options && q.options.length > 0 && (
                                          <div className="mt-3 space-y-1.5 pl-4 sm:pl-0 text-sm">
                                            {q.options.map((opt, i) => (
                                              <div key={i} className={`flex items-start ${opt.includes(q.answer) ? 'text-green-600 font-bold' : 'text-slate-600'}`}>
                                                {opt.includes(q.answer) && <CheckCircle2 className="w-4 h-4 mr-1.5 shrink-0 mt-0.5"/>}
                                                <span>{opt}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        <div className="mt-3 inline-block bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded">Target: {q.bloomLevel.split('(')[0].trim()}</div>
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
              ) : (
                /* --- MODE ADMIN: MELIHAT DAFTAR RIWAYAT DARI SATU USER --- */
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center text-indigo-700">
                      <Clock className="w-5 h-5 mr-2" /> Riwayat Log Aktivitas: <span className="text-slate-800 ml-1">{selectedUserHistory.name}</span>
                    </div>
                    <button onClick={() => setSelectedUserHistory(null)} className="text-sm bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-100 flex items-center font-medium shadow-sm transition-colors">
                      <ChevronLeft className="w-4 h-4 mr-1"/> Kembali ke Daftar User
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    {userHistories.length === 0 ? (
                      <div className="p-12 text-center text-slate-500"><FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>Pengguna ini belum pernah meng-generate soal.</p></div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Waktu Generate</th><th className="p-4">Mata Pelajaran</th><th className="p-4">Jenis Ujian</th><th className="p-4 text-center">Status Akun</th><th className="p-4 text-right">Detail Log</th></tr></thead>
                        <tbody>
                          {userHistories.map(hist => (
                            <tr key={hist.id} className="border-b hover:bg-slate-50 transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-slate-700">{new Date(hist.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</div>
                                <div className="text-xs text-slate-500">{new Date(hist.createdAt).toLocaleTimeString('id-ID')}</div>
                              </td>
                              <td className="p-4 font-medium text-slate-800">{hist.subject} <span className="text-slate-500 font-normal">(Kelas {hist.grade})</span></td>
                              <td className="p-4 text-slate-600">{hist.examType}</td>
                              <td className="p-4 text-center">{hist.isPremiumSnapshot ? <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">Pro</span> : <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">Free</span>}</td>
                              <td className="p-4 text-right"><button onClick={() => setViewingDetail(hist)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg font-bold flex items-center justify-center ml-auto transition-colors"><Eye className="w-4 h-4 mr-1" /> Periksa</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )
            ) : (
              /* --- MODE ADMIN: NORMAL USER LIST (DEFAULT) --- */
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 flex justify-between items-center">
                  <span>Daftar Guru / Pengguna</span> 
                  <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs">Total: {allUsers.length} Akun</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Nama Lengkap</th><th className="p-4">Email</th><th className="p-4 text-center">Sisa Koin</th><th className="p-4 text-right">Aksi Audit</th></tr></thead>
                    <tbody>
                      {allUsers.map((u, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium text-slate-800">{u.name} {u.isPremium && <span className="ml-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Pro</span>}</td>
                          <td className="p-4 text-slate-500">{u.email}</td>
                          <td className="p-4 text-center font-bold text-amber-600 text-lg">{u.coins}</td>
                          <td className="p-4 text-right"><button onClick={() => setSelectedUserHistory(u)} className="bg-slate-800 text-white hover:bg-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center justify-center ml-auto shadow-sm transition-all"><Clock className="w-4 h-4 mr-1.5" /> Pantau Aktivitas</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: PENGATURAN PAKET, BANK & QR CODE */}
        {adminTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-xl border shadow-sm gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Manajemen Paket & Rekening</h3>
                <p className="text-xs text-slate-500">Atur info rekening Bank pusat, dan buat paket pembayaran spesifik.</p>
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button onClick={addNewPackage} className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center">
                  <Plus className="w-4 h-4 mr-2"/> Tambah Paket
                </button>
                <button onClick={savePackagesToDB} disabled={isSavingPackages} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center shadow-sm">
                  {isSavingPackages ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                  Simpan Semua
                </button>
              </div>
            </div>

            {/* --- PANEL PENGATURAN REKENING BANK --- */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm mb-8">
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><CreditCard className="w-5 h-5 mr-2 text-indigo-600" /> Pengaturan Rekening Bank (Transfer Manual)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nama Bank</label>
                  <input type="text" value={bankDetails.bankName} onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})} placeholder="Cth: BCA / Mandiri / BRI" className="w-full border border-slate-300 focus:border-indigo-500 rounded-lg px-3 py-2.5 outline-none text-sm font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nomor Rekening</label>
                  <input type="text" value={bankDetails.accountNumber} onChange={e => setBankDetails({...bankDetails, accountNumber: e.target.value})} placeholder="Cth: 1234567890" className="w-full border border-slate-300 focus:border-indigo-500 rounded-lg px-3 py-2.5 outline-none text-sm font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Atas Nama</label>
                  <input type="text" value={bankDetails.accountName} onChange={e => setBankDetails({...bankDetails, accountName: e.target.value})} placeholder="Cth: John Doe" className="w-full border border-slate-300 focus:border-indigo-500 rounded-lg px-3 py-2.5 outline-none text-sm font-medium" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg, index) => (
                <div key={pkg.id} className={`bg-white rounded-2xl border-2 shadow-sm flex flex-col overflow-hidden transition-all ${pkg.isActive ? 'border-indigo-200 hover:border-indigo-400' : 'border-slate-200 opacity-75 grayscale-[30%]'}`}>
                  <div className={`p-3 flex justify-between items-center ${pkg.isActive ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                    <button onClick={() => updatePackage(index, 'isActive', !pkg.isActive)} className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center transition-colors ${pkg.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                      {pkg.isActive ? <><Eye className="w-3 h-3 mr-1"/> Aktif</> : <><EyeOff className="w-3 h-3 mr-1"/> Nonaktif</>}
                    </button>
                    <button onClick={() => deletePackage(index)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4"/></button>
                  </div>
                  <div className="p-5 space-y-4 flex-grow">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nama Paket</label>
                      <input type="text" value={pkg.name} onChange={(e) => updatePackage(index, 'name', e.target.value)} className="w-full border-b-2 border-slate-200 focus:border-indigo-500 pb-1 outline-none font-bold text-lg text-slate-800 bg-transparent" placeholder="Cth: Paket Premium" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Harga (Rp)</label>
                        <input type="number" value={pkg.price} onChange={(e) => updatePackage(index, 'price', parseInt(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 outline-none text-sm font-medium" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Dapat Koin</label>
                        <input type="number" value={pkg.coins} onChange={(e) => updatePackage(index, 'coins', parseInt(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 outline-none text-sm font-medium text-amber-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Max Generate</label>
                        <input type="number" value={pkg.generate} onChange={(e) => updatePackage(index, 'generate', parseInt(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 outline-none text-sm font-medium" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Warna Label</label>
                        <select value={pkg.color} onChange={(e) => updatePackage(index, 'color', e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none text-sm font-medium">
                          <option value="blue">Biru</option><option value="indigo">Indigo</option><option value="purple">Ungu</option><option value="green">Hijau</option><option value="amber">Emas</option><option value="slate">Abu-abu</option>
                        </select>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">QR Code Pembayaran</label>
                      <div className="flex flex-col items-center">
                        {pkg.qrCode ? (
                          <div className="relative mb-3 group">
                            <img src={pkg.qrCode} alt="QR" className="w-24 h-24 object-cover rounded-lg border shadow-sm" />
                            <button onClick={() => updatePackage(index, 'qrCode', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                          </div>
                        ) : (
                          <div className="w-24 h-24 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg mb-3 flex items-center justify-center text-slate-400">Kosong</div>
                        )}
                        <label className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium py-1.5 px-3 rounded-lg cursor-pointer transition-colors text-center w-full">
                          {pkg.qrCode ? 'Ganti QR Code' : '+ Upload QR Code'}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadPackageQR(index, e)} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div onClick={addNewPackage} className="border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all min-h-[400px]">
                <Plus className="w-12 h-12 mb-2" />
                <span className="font-bold">Buat Paket Baru</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}