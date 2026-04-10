'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CreditCard, Coins, Check, Download, Image as ImageIcon, Loader2, AlertCircle, CheckCircle2, ChevronLeft, Building, Copy, Zap } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, addDoc } from 'firebase/firestore';

const appId = 'eduquest-pro';

export default function PaymentPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [packages, setPackages] = useState([]); 
  const [bankDetails, setBankDetails] = useState(null); // Menyimpan info bank dari Admin

  const [selectedPackage, setSelectedPackage] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('QR_Code'); // Tab: 'QR_Code' atau 'Transfer_Bank'
  
  const [paymentProofBase64, setPaymentProofBase64] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [userPendingTx, setUserPendingTx] = useState(null);

  // Pastikan user login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email.endsWith('@guru.sd.belajar.id')) {
        setUser({ uid: currentUser.uid, name: currentUser.displayName, email: currentUser.email });
      } else {
        router.push('/'); 
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Ambil Data Transaksi Tertunda & Data Paket + Bank Dinamis dari Admin
  useEffect(() => {
    if (!user) return;
    
    const pkgsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'packages');
    const unsubPkgs = onSnapshot(pkgsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const allPkgs = data.items || [];
        setPackages(allPkgs.filter(p => p.isActive));
        if (data.bankDetails) setBankDetails(data.bankDetails);
      }
    });

    const txColRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubTxUser = onSnapshot(txColRef, (snapshot) => {
      const myPending = snapshot.docs.map(d => ({id: d.id, ...d.data()})).find(tx => tx.uid === user.uid && tx.status === 'pending');
      setUserPendingTx(myPending || null);
    });

    return () => { unsubPkgs(); unsubTxUser(); };
  }, [user]);

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
        paymentMethod: paymentMethod, // Field tambahan untuk mencatat metode yang dipilih
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
    if (!selectedPackage || !selectedPackage.qrCode) return;
    const link = document.createElement('a');
    link.href = selectedPackage.qrCode;
    link.download = `QR_Pembayaran_${selectedPackage.name.replace(/\s+/g, '_')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showSuccess('Nomor rekening berhasil disalin!');
    } catch (err) {
      showError('Gagal menyalin text');
    }
  };

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); };
  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8 pb-20">
      {errorMsg && <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center animate-in fade-in"><AlertCircle className="w-5 h-5 mr-2" />{errorMsg}</div>}
      {successMsg && <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center animate-in fade-in"><CheckCircle2 className="w-5 h-5 mr-2" />{successMsg}</div>}

      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center"><CreditCard className="w-6 h-6 mr-2 text-blue-600" /> Beli Koin</h1>
          <Link href="/" className="flex items-center text-slate-500 hover:text-slate-800 text-sm bg-white px-4 py-2 border rounded-lg shadow-sm font-medium">
             <ChevronLeft className="w-4 h-4 mr-1"/> Kembali ke Aplikasi
          </Link>
        </div>

        {userPendingTx ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center max-w-2xl mx-auto shadow-sm">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-amber-800 mb-2">Pembayaran Sedang Diproses</h3>
            <p className="text-amber-700">Mohon tunggu sejenak, pembayaran paket <b>{userPendingTx.packageName}</b> melalui metode <b>{userPendingTx.paymentMethod === 'Transfer_Bank' ? 'Transfer Bank' : 'QRIS'}</b> sedang dalam verifikasi oleh Admin.</p>
          </div>
        ) : !selectedPackage ? (
          <>
            {packages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Belum ada paket koin yang tersedia saat ini.<br/>Harap hubungi Admin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map(pkg => (
                  <div key={pkg.id} className={`bg-white rounded-2xl p-6 border-2 border-${pkg.color}-100 hover:border-${pkg.color}-500 shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 flex flex-col`} onClick={() => setSelectedPackage(pkg)}>
                    <h3 className={`text-xl font-bold text-${pkg.color}-700 mb-1`}>{pkg.name}</h3>
                    <div className="text-3xl font-black text-slate-800 mb-4 flex items-center"><Coins className="w-6 h-6 mr-2 text-amber-500"/> {pkg.coins} <span className="text-sm font-medium text-slate-500 ml-2">Koin</span></div>
                    <ul className="text-sm text-slate-600 mb-6 flex-grow space-y-2">
                      <li className="flex items-start"><Check className="w-4 h-4 mr-2 text-green-500 shrink-0 mt-0.5"/> <span>Bisa untuk <b>{pkg.generate}x Generate</b> soal</span></li>
                      <li className="flex items-start"><Check className="w-4 h-4 mr-2 text-green-500 shrink-0 mt-0.5"/> <span>Biaya 10 Koin / generate</span></li>
                      <li className="flex items-start"><Check className="w-4 h-4 mr-2 text-green-500 shrink-0 mt-0.5"/> <span>Mendukung Ilustrasi AI & HOTS</span></li>
                    </ul>
                    <div className={`w-full text-center bg-${pkg.color}-50 text-${pkg.color}-700 font-bold py-3 rounded-xl`}>Rp {pkg.price.toLocaleString('id-ID')}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-4xl mx-auto relative overflow-hidden animate-in slide-in-from-bottom-4">
            <div className={`absolute top-0 left-0 w-full h-1.5 bg-${selectedPackage.color}-500`}></div>

            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Selesaikan Pembayaran</h3>
                <p className="text-slate-500 text-sm">Paket: <b className={`text-${selectedPackage.color}-700`}>{selectedPackage.name}</b> — Harga: <b>Rp {selectedPackage.price.toLocaleString('id-ID')}</b></p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
              {/* KOLOM KIRI: METODE PEMBAYARAN */}
              <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                
                {/* Toggles (Tabs) */}
                <div className="flex w-full bg-slate-50 border-b border-slate-200">
                  <button 
                    onClick={() => setPaymentMethod('QR_Code')} 
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center transition-colors ${paymentMethod === 'QR_Code' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Zap className="w-4 h-4 mr-2" /> QRIS
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('Transfer_Bank')} 
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center transition-colors ${paymentMethod === 'Transfer_Bank' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Building className="w-4 h-4 mr-2" /> Transfer Bank
                  </button>
                </div>

                <div className="p-6 text-center flex flex-col items-center justify-center min-h-[250px] bg-white">
                  
                  {/* TAMPILAN JIKA PILIH QR CODE */}
                  {paymentMethod === 'QR_Code' && (
                    <div className="animate-in fade-in">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 inline-block mb-4">
                        {selectedPackage.qrCode ? (
                          <img src={selectedPackage.qrCode} alt="QRIS Paket" className="w-48 h-48 object-cover rounded shadow-sm" />
                        ) : (
                          <div className="w-48 h-48 bg-slate-200 flex flex-col items-center justify-center text-sm text-slate-500 rounded p-4">
                            <AlertCircle className="w-6 h-6 mb-2 text-slate-400" />
                            Admin belum mengatur QR Code untuk paket ini
                          </div>
                        )}
                      </div>
                      {selectedPackage.qrCode && (
                        <button onClick={downloadQR} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg text-sm flex items-center justify-center mx-auto transition-colors">
                          <Download className="w-4 h-4 mr-2" /> Unduh QR Code
                        </button>
                      )}
                    </div>
                  )}

                  {/* TAMPILAN JIKA PILIH TRANSFER BANK */}
                  {paymentMethod === 'Transfer_Bank' && (
                    <div className="animate-in fade-in w-full text-left">
                      {!bankDetails || !bankDetails.accountNumber ? (
                        <div className="text-center text-slate-500 py-8">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p>Admin belum mengatur detail Rekening Bank.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 w-full">
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Nama Bank</p>
                            <p className="text-lg font-bold text-blue-900">{bankDetails.bankName}</p>
                          </div>
                          
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nomor Rekening</p>
                              <p className="text-xl font-bold text-slate-800 font-mono tracking-wider">{bankDetails.accountNumber}</p>
                            </div>
                            <button onClick={() => copyToClipboard(bankDetails.accountNumber)} className="bg-white border border-slate-300 p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors shadow-sm" title="Salin Rekening">
                              <Copy className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Atas Nama</p>
                            <p className="text-base font-bold text-slate-700">{bankDetails.accountName}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                </div>
              </div>
              
              {/* KOLOM KANAN: UNGGAH BUKTI TRANSFER */}
              <div className="flex-1 flex flex-col justify-center bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
                <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Konfirmasi Pembayaran</h3>
                <label className="border-2 border-dashed border-slate-300 bg-white rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-colors mb-4 min-h-[160px]">
                  <ImageIcon className={`w-8 h-8 mb-2 ${paymentProofBase64 ? 'text-green-500' : 'text-slate-400'}`} />
                  <span className="text-sm text-center font-medium">{paymentProofBase64 ? "Bukti Terlampir (Klik untuk mengganti)" : "Unggah Screenshot Bukti Transfer"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files[0]) handleImageToAPI(e.target.files[0], setPaymentProofBase64) }} />
                </label>
                
                {paymentProofBase64 && <img src={paymentProofBase64} alt="Preview" className="h-28 object-contain mb-4 rounded border border-slate-200 shadow-sm mx-auto bg-white p-1" />}
                
                <button onClick={submitPaymentProof} disabled={isSubmittingPayment || !paymentProofBase64} className={`w-full bg-${selectedPackage.color}-600 hover:bg-${selectedPackage.color}-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center transition-all`}>
                  {isSubmittingPayment ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : 'Kirim Bukti Pembayaran'}
                </button>
                <button onClick={() => setSelectedPackage(null)} className="w-full text-slate-500 hover:text-slate-800 text-sm mt-4 font-medium transition-colors text-center">← Batal & Pilih Paket Lain</button>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}