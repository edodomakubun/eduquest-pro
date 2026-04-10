'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, Users, Settings, Image as ImageIcon, Upload, LogOut, 
  CheckCircle2, AlertCircle, Loader2, Plus, Save, Eye, EyeOff, Trash2, X,
  Clock, ChevronLeft, FileText, Zap, ShieldAlert, CreditCard, Globe, Database, Bot
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, updateDoc, increment, collection, getDoc } from 'firebase/firestore';

const appId = 'eduquest-pro';

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [adminTab, setAdminTab] = useState('transactions'); 
  const [allUsers, setAllUsers] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [bankDetails, setBankDetails] = useState({ bankName: '', accountName: '', accountNumber: '' });
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');

  // --- STATE MASTER DATA & AI (FITUR BARU) ---
  const [aiRole, setAiRole] = useState('');
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState('');
  const [bloomLevels, setBloomLevels] = useState([]);
  const [newBloomId, setNewBloomId] = useState('');
  const [newBloomLabel, setNewBloomLabel] = useState('');

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
    
    const usersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'profiles');
    const unsubUsers = onSnapshot(usersColRef, (snapshot) => { setAllUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); });

    const txColRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubAllTx = onSnapshot(txColRef, (snapshot) => { setAllTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))); });

    const pkgsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'packages');
    const unsubPkgs = onSnapshot(pkgsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPackages(data.items || []);
        if (data.bankDetails) setBankDetails(data.bankDetails);
      }
    });

    const domainsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'allowed_domains');
    const unsubDomains = onSnapshot(domainsRef, (docSnap) => {
      if (docSnap.exists()) setAllowedDomains(docSnap.data().list || []);
    });

    // --- FETCH DATA MASTER & AI DARI FIRESTORE ---
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'master_data');
    const unsubMaster = onSnapshot(masterRef, (docSnap) => {
      if (docSnap.exists()) {
        setSubjects(docSnap.data().subjects || []);
        setBloomLevels(docSnap.data().bloomLevels || []);
      } else {
        // Data Default Awal
        const defaultSubjects = ['Matematika', 'Ilmu Pengetahuan Alam (IPA)', 'Ilmu Pengetahuan Sosial (IPS)', 'Bahasa Indonesia'];
        const defaultBlooms = [
          { id: 'c1', label: 'C1 (Mengingat)' }, { id: 'c2', label: 'C2 (Memahami)' }, { id: 'c3', label: 'C3 (Penerapan)' },
          { id: 'c4', label: 'C4 (Analisis)' }, { id: 'c5', label: 'C5 (Evaluasi)' }, { id: 'c6', label: 'C6 (Mencipta)' }
        ];
        setDoc(masterRef, { subjects: defaultSubjects, bloomLevels: defaultBlooms });
      }
    });

    const aiRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'ai_role');
    const unsubAi = onSnapshot(aiRef, (docSnap) => {
      if (docSnap.exists()) {
        setAiRole(docSnap.data().instruction || '');
      } else {
        const defaultRole = "Anda adalah asisten pembuat soal ujian untuk Guru SD di Indonesia. Pastikan semua soal memiliki tingkat kesulitan yang sesuai dengan Taksonomi Bloom yang diminta. Buat bahasa yang mudah dipahami oleh anak usia Sekolah Dasar.";
        setDoc(aiRef, { instruction: defaultRole });
      }
    });

    return () => { unsubUsers(); unsubAllTx(); unsubPkgs(); unsubDomains(); unsubMaster(); unsubAi(); };
  }, [isAdmin]);

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

  const approveTransaction = async (tx) => {
    try {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', tx.uid);
      await updateDoc(userRef, { coins: increment(tx.coinsToAdd), isPremium: true });
      const txRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', tx.id);
      await updateDoc(txRef, { status: 'approved', approvedAt: new Date().toISOString() });
      showSuccess(`Berhasil menyetujui ${tx.packageName}`);
    } catch (error) { showError('Gagal menyetujui: ' + error.message); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); };
  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };

  // --- LOGIKA SIMPAN MASTER DATA (MATA PELAJARAN & BLOOM) ---
  const saveMasterData = async (newSubjects, newBlooms) => {
    try {
      const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'master_data');
      await setDoc(masterRef, { subjects: newSubjects, bloomLevels: newBlooms }, { merge: true });
      showSuccess('Master Data berhasil diperbarui!');
    } catch (e) { showError('Gagal menyimpan Master Data: ' + e.message); }
  };

  const handleAddSubject = () => {
    if (!newSubject.trim()) return;
    if (subjects.includes(newSubject.trim())) return showError('Mata pelajaran sudah ada.');
    const updated = [...subjects, newSubject.trim()];
    setSubjects(updated);
    setNewSubject('');
    saveMasterData(updated, bloomLevels);
  };

  const handleRemoveSubject = (sub) => {
    if(confirm(`Hapus ${sub}?`)){
      const updated = subjects.filter(s => s !== sub);
      setSubjects(updated);
      saveMasterData(updated, bloomLevels);
    }
  };

  const handleAddBloom = () => {
    if (!newBloomId.trim() || !newBloomLabel.trim()) return showError('ID dan Label Bloom harus diisi.');
    if (bloomLevels.some(b => b.id === newBloomId.trim().toLowerCase())) return showError('ID Bloom sudah digunakan.');
    const updated = [...bloomLevels, { id: newBloomId.trim().toLowerCase(), label: newBloomLabel.trim() }];
    setBloomLevels(updated);
    setNewBloomId(''); setNewBloomLabel('');
    saveMasterData(subjects, updated);
  };

  const handleRemoveBloom = (id) => {
    if(confirm(`Hapus tingkat Bloom ini?`)){
      const updated = bloomLevels.filter(b => b.id !== id);
      setBloomLevels(updated);
      saveMasterData(subjects, updated);
    }
  };

  // --- LOGIKA SIMPAN INSTRUKSI AI ---
  const handleSaveAiRole = async () => {
    setIsSavingAi(true);
    try {
      const aiRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'ai_role');
      await setDoc(aiRef, { instruction: aiRole });
      showSuccess('Role AI berhasil diperbarui! Perubahan langsung aktif.');
    } catch (e) {
      showError('Gagal menyimpan Role AI: ' + e.message);
    } finally {
      setIsSavingAi(false);
    }
  };

  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-20">
      {errorMsg && <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center z-50"><AlertCircle className="w-5 h-5 mr-2" />{errorMsg}</div>}
      {successMsg && <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center z-50"><CheckCircle2 className="w-5 h-5 mr-2" />{successMsg}</div>}

      <header className="bg-indigo-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-bold text-xl"><ShieldCheck className="w-6 h-6 mr-2 text-indigo-300" /> Admin EduQuest</div>
          <button onClick={handleLogout} className="flex items-center text-indigo-100 hover:text-white font-medium text-sm"><LogOut className="w-4 h-4 mr-2" /> Keluar</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* NAVIGASI TAB TERMASUK MASTER DATA */}
        <div className="flex space-x-2 border-b border-slate-300 mb-6 overflow-x-auto hide-scrollbar">
          {[
            { id: 'transactions', label: 'Verifikasi Pembayaran', icon: ShieldCheck }, 
            { id: 'users', label: 'Pemantauan Riwayat', icon: Users }, 
            { id: 'master', label: 'Master Data & AI', icon: Database },
            { id: 'domains', label: 'Whitelist Domain', icon: Globe },
            { id: 'settings', label: 'Pengaturan Paket', icon: Settings }
          ].map(tab => (
            <button key={tab.id} onClick={() => setAdminTab(tab.id)} className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center ${adminTab === tab.id ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <tab.icon className="w-4 h-4 mr-2" /> {tab.label}
              {tab.id === 'transactions' && allTransactions.filter(t => t.status === 'pending').length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{allTransactions.filter(t => t.status === 'pending').length}</span>
              )}
            </button>
          ))}
        </div>

        {/* --- TAB BARU: MASTER DATA & AI --- */}
        {adminTab === 'master' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Panel Role AI */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10"></div>
              <h3 className="font-bold text-lg text-slate-800 flex items-center mb-2">
                <Bot className="w-5 h-5 mr-2 text-indigo-600"/> Instruksi Dasar AI (System Role)
              </h3>
              <p className="text-sm text-slate-500 mb-4">Instruksi ini akan dikirim secara tersembunyi ke AI sebelum memproses soal guru. Gunakan untuk mengatur kepribadian, aturan, dan batasan AI.</p>
              
              <textarea 
                value={aiRole} 
                onChange={(e) => setAiRole(e.target.value)}
                className="w-full min-h-[150px] p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono text-slate-700 leading-relaxed bg-slate-50"
                placeholder="Contoh: Anda adalah seorang guru profesional..."
              ></textarea>
              <div className="mt-4 flex justify-end">
                <button onClick={handleSaveAiRole} disabled={isSavingAi} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-2.5 px-6 rounded-xl flex items-center shadow-sm transition-all">
                  {isSavingAi ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>} Simpan Instruksi AI
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Panel Mata Pelajaran */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
                <h3 className="font-bold text-lg text-slate-800 flex items-center mb-4"><FileText className="w-5 h-5 mr-2 text-blue-600"/> Master Mata Pelajaran</h3>
                <div className="flex gap-2 mb-6">
                  <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Mata Pelajaran Baru" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium" />
                  <button onClick={handleAddSubject} className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700 transition-colors"><Plus className="w-5 h-5"/></button>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex-grow max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <tbody>
                      {subjects.map((sub, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                          <td className="p-3 font-medium text-slate-700">{sub}</td>
                          <td className="p-3 text-right"><button onClick={() => handleRemoveSubject(sub)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Panel Taksonomi Bloom */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
                <h3 className="font-bold text-lg text-slate-800 flex items-center mb-4"><Zap className="w-5 h-5 mr-2 text-amber-500"/> Master Taksonomi Bloom</h3>
                <div className="flex gap-2 mb-6">
                  <input type="text" value={newBloomId} onChange={e => setNewBloomId(e.target.value)} placeholder="ID (cth: c7)" className="w-24 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-medium lowercase" />
                  <input type="text" value={newBloomLabel} onChange={e => setNewBloomLabel(e.target.value)} placeholder="Label (cth: C7 (Modifikasi))" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-medium" />
                  <button onClick={handleAddBloom} className="bg-amber-500 text-white px-4 rounded-lg font-bold hover:bg-amber-600 transition-colors"><Plus className="w-5 h-5"/></button>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex-grow max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <tbody>
                      {bloomLevels.map((bloom, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                          <td className="p-3 font-bold text-amber-700 w-16 uppercase">{bloom.id}</td>
                          <td className="p-3 font-medium text-slate-700">{bloom.label}</td>
                          <td className="p-3 text-right"><button onClick={() => handleRemoveBloom(bloom.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ... (SISA TAB LAINNYA TETAP SAMA SEPERTI SEBELUMNYA) ... */}
        {/* TAB TRANSAKSI */}
        {adminTab === 'transactions' && (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-50 border-b font-bold text-slate-700">Riwayat & Permintaan Pembayaran</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">User</th><th className="p-4">Paket & Metode</th><th className="p-4">Waktu</th><th className="p-4 text-center">Bukti</th><th className="p-4 text-right">Aksi</th></tr></thead>
                <tbody>
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

        {/* TAB USERS / RIWAYAT */}
        {adminTab === 'users' && (
          <div className="space-y-6 animate-in fade-in">
            {selectedUserHistory ? (
              viewingDetail ? (
                <div className="space-y-6">
                  <div className="flex justify-between bg-white p-4 rounded-xl border shadow-sm">
                    <span className="font-bold text-slate-700">Detail Log Aktivitas: {selectedUserHistory.name}</span>
                    <button onClick={() => setViewingDetail(null)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-bold flex items-center"><ChevronLeft className="w-4 h-4 mr-1"/> Kembali</button>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border p-8">
                    <h3 className="font-bold text-slate-800 text-lg mb-6 border-b pb-3">Hasil Soal</h3>
                    <div className="space-y-6">
                      {(viewingDetail.questions || []).map((q, i) => (
                        <div key={q.id} className="border-b border-slate-100 pb-4">
                          <p className="font-medium text-slate-800 text-sm">{i+1}. {q.text}</p>
                          {q.options && q.options.length > 0 && <div className="text-sm text-slate-600 pl-4 mt-2">{q.options.map((opt, j) => <div key={j} className={opt.includes(q.answer) ? 'font-bold text-green-600' : ''}>{opt}</div>)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b font-bold flex justify-between">Riwayat: {selectedUserHistory.name} <button onClick={() => setSelectedUserHistory(null)} className="text-sm bg-white px-3 py-1 rounded-md border"><ChevronLeft className="w-4 h-4 inline"/> Kembali</button></div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100"><tr><th className="p-4">Tanggal</th><th className="p-4">Mapel</th><th className="p-4 text-right">Aksi</th></tr></thead>
                    <tbody>
                      {userHistories.map(hist => (
                        <tr key={hist.id} className="border-b">
                          <td className="p-4">{new Date(hist.createdAt).toLocaleDateString('id-ID')}</td>
                          <td className="p-4">{hist.subject} (Kelas {hist.grade})</td>
                          <td className="p-4 text-right"><button onClick={() => setViewingDetail(hist)} className="text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-lg">Periksa</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b font-bold">Daftar Guru / Pengguna</div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100"><tr><th className="p-4">Nama</th><th className="p-4">Email</th><th className="p-4 text-right">Aksi</th></tr></thead>
                  <tbody>
                    {allUsers.map((u, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-4 font-medium">{u.name}</td>
                        <td className="p-4 text-slate-500">{u.email}</td>
                        <td className="p-4 text-right"><button onClick={() => setSelectedUserHistory(u)} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg font-bold text-xs">Pantau Aktivitas</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}