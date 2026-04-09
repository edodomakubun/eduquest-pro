'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Coins, Check, Download, Image as ImageIcon, Loader2, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, addDoc } from 'firebase/firestore';

const appId = 'eduquest-pro';

export default function PaymentPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [paymentProofBase64, setPaymentProofBase64] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [userPendingTx, setUserPendingTx] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Pastikan user login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email.endsWith('@guru.sd.belajar.id')) {
        setUser({ uid: currentUser.uid, name: currentUser.displayName, email: currentUser.email });
      } else {
        router.push('/'); // Lempar keluar jika belum login atau admin
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Ambil data Transaksi Tertunda & QR Code
  useEffect(() => {
    if (!user) return;
    
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) setQrCodeUrl(docSnap.data().qrCodeImage || '');
    });

    const txColRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubTxUser = onSnapshot(txColRef, (snapshot) => {
      const myPending = snapshot.docs.map(d => ({id: d.id, ...d.data()})).find(tx => tx.uid === user.uid && tx.status === 'pending');
      setUserPendingTx(myPending || null);
    });

    return () => { unsubSettings(); unsubTxUser(); };
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

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); };
  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
      {errorMsg && <div className="fixed top-4 right-4 z-50 bg-red-100 text-red-700 px-4 py-3 rounded shadow"><AlertCircle className="inline mr-2" size={20} />{errorMsg}</div>}
      {successMsg && <div className="fixed top-4 right-4 z-50 bg-green-100 text-green-700 px-4 py-3 rounded shadow"><CheckCircle2 className="inline mr-2" size={20} />{successMsg}</div>}

      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center"><CreditCard className="w-6 h-6 mr-2 text-blue-600" /> Beli Koin</h1>
          <button onClick={() => router.push('/')} className="flex items-center text-slate-500 hover:text-slate-800 text-sm bg-white px-4 py-2 border rounded-lg shadow-sm">
             <ChevronLeft className="w-4 h-4 mr-1"/> Kembali ke Aplikasi
          </button>
        </div>

        {userPendingTx ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center max-w-2xl mx-auto">
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
                  <li className="flex items-center"><Check className="w-4 h-4 mr-2 text-green-500"/> Biaya 10 Koin / generate</li>
                  <li className="flex items-center"><Check className="w-4 h-4 mr-2 text-green-500"/> Ilustrasi AI Kualitas Tinggi</li>
                </ul>
                <div className={`w-full text-center bg-${pkg.color}-50 text-${pkg.color}-700 font-bold py-3 rounded-xl`}>Rp {pkg.price.toLocaleString('id-ID')}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col md:flex-row gap-8 max-w-4xl mx-auto">
            <div className="flex-1 text-center md:text-left border-b md:border-b-0 md:border-r border-slate-200 pb-8 md:pb-0 md:pr-8">
              <h3 className="text-xl font-bold text-slate-800 mb-2">Selesaikan Pembayaran</h3>
              <p className="text-slate-600 text-sm mb-6">Paket: <b>{selectedPackage.name} ({selectedPackage.coins} Koin)</b><br/>Harga: <b>Rp {selectedPackage.price.toLocaleString('id-ID')}</b></p>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 inline-block mb-4 mx-auto md:mx-0">
                {qrCodeUrl ? <img src={qrCodeUrl} alt="QRIS" className="w-48 h-48 object-cover rounded shadow-sm" /> : <div className="w-48 h-48 bg-slate-200 flex items-center justify-center text-sm text-slate-500 rounded text-center p-4">Admin belum mengatur QR Code</div>}
              </div>
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
    </div>
  );
}