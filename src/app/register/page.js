'use client'; 

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Wand2, Mail, Lock, User, GraduationCap, 
  ArrowRight, Loader2, AlertCircle, CheckCircle2, 
  Sparkles, Zap, ShieldCheck
} from 'lucide-react';

import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const appId = 'eduquest-pro'; // Sesuaikan dengan ID App Anda di Firebase

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    schoolLevel: 'SD' // Default SD
  });

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      setErrorMsg("Semua kolom bertanda bintang (*) wajib diisi.");
      return;
    }
    
    setIsLoading(true); 
    setErrorMsg('');
    
    try {
      // 1. Buat akun di Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      // 2. Update Profil Auth (Nama)
      await updateProfile(user, { displayName: formData.name });
      
      // 3. Simpan data user ke Firestore (Ini otomatis membuat user dikenali oleh sistem Dasbor)
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid), {
        name: formData.name,
        email: formData.email,
        schoolLevel: formData.schoolLevel,
        coins: 20, // Saldo awal gratis
        isPremium: false,
        createdAt: new Date().toISOString()
      });
      
      // 4. Lanjut ke langkah Penawaran (Step 2)
      setStep(2);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg("Email ini sudah terdaftar. Silakan menuju halaman Login.");
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg("Kata sandi terlalu lemah, gunakan minimal 6 karakter.");
      } else {
        setErrorMsg("Gagal mendaftar: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/'); // Langsung ke Dasbor Utama
  };

  const handleUpgrade = () => {
    router.push('/payment'); // Arahkan ke halaman Top Up/Payment
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans relative overflow-hidden bg-slate-900 lg:bg-white">
      {/* Background Ornamen untuk Mobile */}
      <div className="absolute inset-0 lg:hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black z-0"></div>
      
      {/* Kolom Kiri: Branding (Hanya Desktop) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-12 flex-col justify-between overflow-hidden shadow-2xl z-10">
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
           <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] bg-blue-500/30 rounded-full mix-blend-overlay filter blur-3xl"></div>
           <div className="absolute top-1/2 -right-20 w-[25rem] h-[25rem] bg-indigo-400/30 rounded-full mix-blend-overlay filter blur-3xl"></div>
         </div>

         <div className="relative z-10">
           <div className="flex items-center space-x-3 text-white mb-16">
             <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-xl">
               <Wand2 className="w-8 h-8 text-blue-100" />
             </div>
             <span className="text-3xl font-extrabold tracking-tight">EduQuest<span className="text-blue-300 font-medium">.ai</span></span>
           </div>
           <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.15] mb-6">
             Bergabung dengan<br/>Revolusi Pendidikan
           </h1>
           <p className="text-blue-100/90 text-lg mb-12 max-w-md leading-relaxed font-medium">
             Otomatisasi penyusunan soal berstandar HOTS dan kisi-kisi lengkap hanya dalam hitungan detik.
           </p>

           <div className="space-y-6">
             <div className="flex items-start text-white group">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mr-4 backdrop-blur-md border border-white/10 shrink-0">
                 <CheckCircle2 className="w-6 h-6 text-blue-200" />
               </div>
               <div>
                 <h3 className="font-bold text-lg">Gratis 20 Koin Pertama</h3>
                 <p className="text-sm text-blue-200/80 mt-1 leading-relaxed">Daftar sekarang dan langsung coba buat soal pertama Anda secara gratis.</p>
               </div>
             </div>
           </div>
         </div>
      </div>

      {/* Kolom Kanan: Form / Penawaran */}
      <div className="w-full lg:w-[55%] xl:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 relative z-10 min-h-screen lg:min-h-0">
        
        {step === 1 ? (
          /* STEP 1: FORM REGISTER */
          <div className="w-full max-w-[420px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 sm:p-10 animate-in fade-in slide-in-from-bottom-8 relative z-20">
            <div className="text-center mb-8">
              <div className="lg:hidden flex items-center justify-center space-x-2 text-blue-600 mb-6">
                <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                  <Wand2 className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-2xl font-extrabold tracking-tight text-slate-800">EduQuest<span className="text-blue-600">.ai</span></span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Buat Akun Baru</h2>
              <p className="text-slate-500 text-sm font-medium">Lengkapi data diri Anda di bawah ini.</p>
            </div>

            {errorMsg && (
              <div className="mb-6 bg-red-50/80 border border-red-200 text-red-600 px-4 py-3.5 rounded-2xl flex items-start text-left text-sm font-medium animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4 mb-8">
              {/* Nama Lengkap */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 ml-1">Nama Lengkap*</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all group">
                  <User className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})}
                    placeholder="Budi Santoso, S.Pd" 
                    className="w-full bg-transparent outline-none ml-3 text-sm text-slate-800 placeholder-slate-400 font-medium"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 ml-1">Email*</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all group">
                  <Mail className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})}
                    placeholder="nama@institusi.com" 
                    className="w-full bg-transparent outline-none ml-3 text-sm text-slate-800 placeholder-slate-400 font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 ml-1">Kata Sandi*</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all group">
                  <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})}
                    placeholder="Minimal 6 karakter" 
                    className="w-full bg-transparent outline-none ml-3 text-sm text-slate-800 placeholder-slate-400 font-medium"
                  />
                </div>
              </div>

              {/* Jenjang Sekolah */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 ml-1">Jenjang Sekolah*</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all group">
                  <GraduationCap className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <select 
                    value={formData.schoolLevel} 
                    onChange={e=>setFormData({...formData, schoolLevel: e.target.value})}
                    className="w-full bg-transparent outline-none ml-3 text-sm text-slate-800 font-medium cursor-pointer appearance-none"
                  >
                    <option value="SD">Sekolah Dasar (SD)</option>
                    <option value="SMP">Sekolah Menengah Pertama (SMP)</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center group mt-4">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Daftar Sekarang <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </form>

            <p className="text-center text-sm font-medium text-slate-600">
              Sudah punya akun? <Link href="/login" className="text-blue-600 font-bold hover:underline">Masuk di sini</Link>
            </p>
          </div>
        ) : (
          /* STEP 2: PENAWARAN PAKET (ONBOARDING) */
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 relative z-20 text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border-4 border-green-50">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Akun Berhasil Dibuat!</h2>
            <p className="text-slate-500 text-sm font-medium mb-8">Halo {formData.name}, selamat datang di EduQuest Pro.</p>
            
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 mb-8 text-left relative overflow-hidden">
              <div className="absolute -right-6 -top-6 text-amber-100 opacity-50">
                <Sparkles className="w-32 h-32" />
              </div>
              <div className="flex items-center space-x-2 mb-4 relative z-10">
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h3 className="font-bold text-amber-900">Tawaran Spesial Pengguna Baru</h3>
              </div>
              <ul className="space-y-3 relative z-10">
                <li className="flex items-start text-sm text-amber-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 mr-2 shrink-0 mt-0.5" />
                  Buka semua tipe soal (Isian, Esai, Benar-Salah, dll)
                </li>
                <li className="flex items-start text-sm text-amber-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 mr-2 shrink-0 mt-0.5" />
                  Upload RPP/Materi dari format PDF
                </li>
                <li className="flex items-start text-sm text-amber-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 mr-2 shrink-0 mt-0.5" />
                  Sistem AI Generator Ilustrasi Gambar
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <button onClick={handleUpgrade} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02]">
                Lihat Paket Premium
              </button>
              <button onClick={handleSkip} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 px-4 rounded-xl transition-colors">
                Lewati untuk sekarang
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}