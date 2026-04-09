'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles, Clock, ShieldCheck, Loader2, AlertCircle, Wand2 } from 'lucide-react';
import { auth, googleProvider } from '../../lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true); 
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pengecekan sesi saat halaman dimuat
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email || '';
        if (email === 'operator.sdinpresleling2023@gmail.com') {
          router.push('/admin');
        } else if (email.endsWith('@guru.sd.belajar.id')) {
          router.push('/'); 
        } else {
          await signOut(auth);
          setErrorMsg("Akses Ditolak! Hanya untuk akun @guru.sd.belajar.id atau Admin.");
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
      const email = result.user.email || '';
      
      if (email === 'operator.sdinpresleling2023@gmail.com') {
        router.push('/admin');
      } else if (email.endsWith('@guru.sd.belajar.id')) {
        router.push('/');
      } else {
        await signOut(auth);
        setErrorMsg("Akses Ditolak! Gunakan akun Belajar.id atau email Admin.");
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setErrorMsg("Terjadi kesalahan: " + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      
      {/* KIRI - Tampilan Branding (Hanya muncul di Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 p-12 flex-col justify-between relative overflow-hidden">
         {/* Dekorasi Latar Belakang */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
           <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
           <div className="absolute top-1/2 right-12 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
         </div>

         <div className="relative z-10 mt-8">
           <div className="flex items-center space-x-2 text-white mb-12">
             <Wand2 className="w-10 h-10" />
             <span className="text-3xl font-bold tracking-tight">EduQuest<span className="text-blue-200">.ai</span></span>
           </div>
           
           <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
             Revolusi Pembuatan Soal untuk Guru SD
           </h1>
           <p className="text-blue-100 text-lg mb-12 max-w-md leading-relaxed">
             Buat soal ujian terstandarisasi, analisis Taksonomi Bloom, dan ilustrasi edukatif hanya dalam hitungan detik.
           </p>

           <div className="space-y-8">
             <div className="flex items-center text-blue-50">
               <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mr-5 backdrop-blur-sm border border-white/10">
                 <Clock className="w-7 h-7 text-white" />
               </div>
               <div>
                 <h3 className="font-bold text-white text-lg">Hemat Waktu</h3>
                 <p className="text-sm text-blue-200 mt-1">Dari berjam-jam menjadi beberapa detik.</p>
               </div>
             </div>
             <div className="flex items-center text-blue-50">
               <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mr-5 backdrop-blur-sm border border-white/10">
                 <Sparkles className="w-7 h-7 text-white" />
               </div>
               <div>
                 <h3 className="font-bold text-white text-lg">AI Kualitas Tinggi</h3>
                 <p className="text-sm text-blue-200 mt-1">Standar HOTS & Export langsung ke MS Word.</p>
               </div>
             </div>
           </div>
         </div>
         
         <div className="relative z-10 text-blue-200/60 text-sm font-medium">
           © {new Date().getFullYear()} Dinas Pendidikan & Kebudayaan.
         </div>
      </div>

      {/* KANAN - Kotak Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Dekorasi Mobile */}
        <div className="absolute top-0 right-0 w-full h-64 bg-blue-600 lg:hidden rounded-b-[40px] -z-10"></div>

        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8">
          
          <div className="lg:hidden flex items-center justify-center space-x-2 text-white mb-10">
             <Wand2 className="w-10 h-10" />
             <span className="text-3xl font-bold tracking-tight">EduQuest<span className="text-blue-200">.ai</span></span>
          </div>

          <div className="bg-white rounded-[2rem] shadow-2xl shadow-blue-900/5 border border-slate-100 p-8 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2 mt-2">Selamat Datang</h2>
            <p className="text-slate-500 mb-8 text-sm sm:text-base">Akses khusus tenaga pendidik. Gunakan akun <b>Belajar.id</b> atau <b>Admin</b>.</p>

            {errorMsg && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center text-left text-sm">
                <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full bg-white hover:bg-slate-50 focus:ring-4 focus:ring-blue-100 border-2 border-slate-200 text-slate-700 font-bold py-4 px-4 rounded-xl flex items-center justify-center transition-all shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {isLoggingIn ? (
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              ) : (
                <>
                  <img src="https://img.icons8.com/color/48/google-logo.png" alt="google-logo" className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform"/>
                  Masuk dengan Google
                </>
              )}
            </button>

            <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-center space-x-2 text-sm font-medium text-slate-400">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              <span>Sistem Akses Terenkripsi & Aman</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}