'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles, Clock, ShieldCheck, Loader2, AlertCircle, Wand2, Mail, Lock, Eye, EyeOff, ArrowRight, Globe } from 'lucide-react';
import { auth, googleProvider } from '../../lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true); 
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State untuk form UI Email & Password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Pengecekan sesi saat halaman dimuat
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userEmail = currentUser.email || '';
        if (userEmail === 'operator.sdinpresleling2023@gmail.com') {
          router.push('/admin');
        } else if (userEmail.endsWith('@guru.sd.belajar.id')) {
          router.push('/'); 
        } else {
          await signOut(auth);
          setErrorMsg("Akses Ditolak! Hanya untuk akun @guru.sd.belajar.id");
          setIsAuthLoading(false);
        }
      } else {
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userEmail = result.user.email || '';
      
      if (userEmail === 'operator.sdinpresleling2023@gmail.com') {
        router.push('/admin');
      } else if (userEmail.endsWith('@guru.sd.belajar.id')) {
        router.push('/');
      } else {
        await signOut(auth);
        setErrorMsg("Akses Ditolak! Gunakan akun Belajar.id SD Anda.");
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setErrorMsg("Terjadi kesalahan: " + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Harap masukkan email dan password.");
      return;
    }
    setErrorMsg("Login via Email dinonaktifkan. Silakan gunakan tombol Masuk dengan Google (Akun Belajar.id SD).");
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4"/>
        <p className="text-slate-400 font-medium animate-pulse">EduQuest.ai sedang memuat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans relative overflow-hidden bg-slate-900 lg:bg-white">
      
      {/* BACKGROUND MOBILE (Dark Gradient) */}
      <div className="absolute inset-0 lg:hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black z-0">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 -right-10 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl"></div>
      </div>

      {/* KIRI - Tampilan Desktop (Split Screen Panel) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-12 flex-col justify-between overflow-hidden shadow-2xl z-10">
         {/* Dekorasi Abstract Desktop */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
           <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] bg-blue-500/30 rounded-full mix-blend-overlay filter blur-3xl"></div>
           <div className="absolute top-1/2 -right-20 w-[25rem] h-[25rem] bg-indigo-400/30 rounded-full mix-blend-overlay filter blur-3xl"></div>
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
         </div>

         {/* Header / Logo Panel Kiri */}
         <div className="relative z-10">
           <div className="flex items-center space-x-3 text-white mb-16">
             <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-xl">
               <Wand2 className="w-8 h-8 text-blue-100" />
             </div>
             <span className="text-3xl font-extrabold tracking-tight">EduQuest<span className="text-blue-300 font-medium">.ai</span></span>
           </div>
           
           <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.15] mb-6">
             Revolusi Pembuatan<br/>Soal untuk Guru SD
           </h1>
           <p className="text-blue-100/90 text-lg mb-12 max-w-md leading-relaxed font-medium">
             Buat soal ujian terstandarisasi, analisis Taksonomi Bloom, dan ilustrasi edukatif hanya dalam hitungan detik.
           </p>

           <div className="space-y-6">
             <div className="flex items-start text-white group">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mr-4 backdrop-blur-md border border-white/10 group-hover:bg-white/20 transition-colors shrink-0">
                 <Clock className="w-6 h-6 text-blue-200" />
               </div>
               <div>
                 <h3 className="font-bold text-lg">Hemat Waktu 90%</h3>
                 <p className="text-sm text-blue-200/80 mt-1 leading-relaxed">Proses penyusunan dari berjam-jam menjadi beberapa detik.</p>
               </div>
             </div>
             <div className="flex items-start text-white group">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mr-4 backdrop-blur-md border border-white/10 group-hover:bg-white/20 transition-colors shrink-0">
                 <Sparkles className="w-6 h-6 text-blue-200" />
               </div>
               <div>
                 <h3 className="font-bold text-lg">AI Standar HOTS</h3>
                 <p className="text-sm text-blue-200/80 mt-1 leading-relaxed">Didukung kecerdasan buatan dengan format MS Word siap cetak.</p>
               </div>
             </div>
           </div>
         </div>
         
         <div className="relative z-10 flex items-center text-blue-200/60 text-sm font-medium">
           <ShieldCheck className="w-4 h-4 mr-2" />
           Sistem Keamanan Terenkripsi © {new Date().getFullYear()}
         </div>
      </div>

      {/* KANAN - Area Konten Login */}
      <div className="w-full lg:w-[55%] xl:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 relative z-10 min-h-screen lg:min-h-0">
        
        {/* Kontainer Form Login */}
        <div className="w-full max-w-[420px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 sm:p-10 animate-in fade-in slide-in-from-bottom-8 relative z-20">
          
          <div className="text-center mb-8">
            <div className="lg:hidden flex items-center justify-center space-x-2 text-blue-600 mb-6">
              <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                <Wand2 className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-slate-800">EduQuest<span className="text-blue-600">.ai</span></span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Selamat Datang</h2>
            <p className="text-slate-500 text-sm font-medium">Masuk untuk melanjutkan ke dasbor Anda.</p>
          </div>

          {errorMsg && (
            <div className="mb-6 bg-red-50/80 border border-red-200 text-red-600 px-4 py-3.5 rounded-2xl flex items-start text-left text-sm font-medium animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-5 mb-8">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 ml-1">Email Belajar.id</label>
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all group">
                <Mail className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@guru.sd.belajar.id" 
                  className="w-full bg-transparent outline-none ml-3 text-sm text-slate-800 placeholder-slate-400 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 ml-1">Kata Sandi</label>
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all group">
                <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full bg-transparent outline-none ml-3 text-sm text-slate-800 placeholder-slate-400 font-medium"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none transition-colors ml-2"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center group">
              Masuk
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="flex items-center justify-between mb-8">
            <div className="w-full h-[1px] bg-slate-200"></div>
            <span className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Atau</span>
            <div className="w-full h-[1px] bg-slate-200"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white hover:bg-slate-50 focus:ring-4 focus:ring-blue-500/20 border-2 border-slate-200 text-slate-700 font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center transition-all hover:border-slate-300 disabled:opacity-70 disabled:cursor-not-allowed group shadow-sm"
          >
            {isLoggingIn ? (
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            ) : (
              <>
                <img src="https://img.icons8.com/color/48/google-logo.png" alt="Google" className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform"/>
                <span className="text-sm">Lanjutkan dengan Google</span>
              </>
            )}
          </button>
        </div>

        {/* LINK PENGEMBANG / FOOTER (Responsif) */}
        <div className="mt-12 text-center animate-in fade-in slide-in-from-bottom-12 relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 lg:text-slate-400 mb-4">Dikembangkan Oleh</p>
          <div className="flex items-center justify-center space-x-6 sm:space-x-8">
            <a 
              href="https://ed-developing.pages.dev" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center text-sm font-bold text-slate-300 lg:text-slate-500 hover:text-blue-400 lg:hover:text-blue-600 transition-colors group"
            >
              <Globe className="w-4 h-4 mr-2 text-slate-400 lg:text-slate-400 group-hover:text-blue-400 lg:group-hover:text-blue-600 transition-colors" /> 
              Portofolio
            </a>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-600/30 lg:bg-slate-300"></div>
            <a 
              href="https://www.facebook.com/dmkbn.e" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center text-sm font-bold text-slate-300 lg:text-slate-500 hover:text-blue-400 lg:hover:text-blue-600 transition-colors group"
            >
              {/* SVG Ikon Facebook Manual pengganti dari Lucide */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-slate-400 lg:text-slate-400 group-hover:text-blue-400 lg:group-hover:text-blue-600 transition-colors">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
              Facebook
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}