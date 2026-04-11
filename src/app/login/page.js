'use client'; 

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles, Clock, ShieldCheck, Loader2, AlertCircle, Wand2, Mail, Lock, Eye, EyeOff, ArrowRight, Globe, Facebook, CheckCircle2, Coins, Zap, Download, Image as ImageIcon, FileText, Settings, CreditCard } from 'lucide-react';
import { auth, googleProvider, db } from '../../lib/firebase';
import { signInWithPopup, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const appId = 'eduquest-pro';

export default function LoginPage() {
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true); 
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Fungsi Pengecekan Akses (Dinamis dari Database Whitelist)
  const checkAccess = async (userEmail) => {
    if (userEmail === 'operator.sdinpresleling2023@gmail.com') return 'admin';
    try {
      const domainsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'allowed_domains');
      const docSnap = await getDoc(domainsRef);
      // DITAMBAHKAN: Whitelist default untuk SD dan SMP
      const domains = docSnap.exists() ? docSnap.data().list || [] : ['@guru.sd.belajar.id', '@guru.smp.belajar.id'];
      
      const isAllowed = domains.some(domain => userEmail.toLowerCase().endsWith(domain.toLowerCase()));
      return isAllowed ? 'user' : 'denied';
    } catch (error) {
      console.error("Error checking access:", error);
      return 'denied';
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userEmail = currentUser.email || '';
        const access = await checkAccess(userEmail);
        
        if (access === 'admin') {
          router.push('/admin');
        } else if (access === 'user') {
          const disabled = await isAccountDisabled(currentUser.uid);
          if (disabled) {
            await signOut(auth);
            setErrorMsg('Akun ini dinonaktifkan. Hubungi admin untuk aktivasi kembali.');
            setIsAuthLoading(false);
            return;
          }
          router.push('/'); 
        } else {
          await signOut(auth);
          setErrorMsg("Akses Ditolak! Domain email Anda tidak terdaftar dalam sistem. Gunakan email institusi yang diizinkan.");
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
      
      const access = await checkAccess(userEmail);
      
      if (access === 'admin') {
        router.push('/admin');
      } else if (access === 'user') {
        const disabled = await isAccountDisabled(result.user.uid);
        if (disabled) {
          await signOut(auth);
          setErrorMsg('Akun ini dinonaktifkan. Hubungi admin untuk aktivasi kembali.');
        } else {
          router.push('/');
        }
      } else {
        await signOut(auth);
        setErrorMsg("Akses Ditolak! Domain email Anda tidak terdaftar dalam sistem. Gunakan email institusi yang diizinkan.");
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setErrorMsg("Terjadi kesalahan: " + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Harap masukkan email dan password.");
      return;
    }

    setIsLoggingIn(true);
    setErrorMsg('');

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = result.user.email || '';
      const access = await checkAccess(userEmail);

      if (access === 'admin') {
        router.push('/admin');
      } else if (access === 'user') {
        const disabled = await isAccountDisabled(result.user.uid);
        if (disabled) {
          await signOut(auth);
          setErrorMsg('Akun ini dinonaktifkan. Hubungi admin untuk aktivasi kembali.');
        } else {
          router.push('/');
        }
      } else {
        await signOut(auth);
        setErrorMsg("Akses Ditolak! Domain email Anda tidak terdaftar dalam sistem. Gunakan email institusi yang diizinkan.");
      }
    } catch (err) {
      const message = err.message || 'Terjadi kesalahan saat login.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Email atau password tidak cocok. Mohon periksa kembali.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Format email tidak valid.');
      } else if (err.code === 'auth/user-disabled') {
        setErrorMsg('Akun ini dinonaktifkan.');
      } else {
        setErrorMsg('Gagal masuk: ' + message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isAccountDisabled = async (userId) => {
    try {
      const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', userId);
      const profileSnap = await getDoc(profileRef);
      return profileSnap.exists() && profileSnap.data().disabled === true;
    } catch (error) {
      console.error('Gagal memeriksa status akun:', error);
      return false;
    }
  };

  const handleRegisterNavigation = () => {
    router.push('/register');
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4"/>
        <p className="text-slate-400 font-medium animate-pulse">Memuat sistem keamanan...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* HERO SECTION */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] bg-blue-500/30 rounded-full mix-blend-overlay filter blur-3xl"></div>
          <div className="absolute top-1/2 -right-20 w-[25rem] h-[25rem] bg-indigo-400/30 rounded-full mix-blend-overlay filter blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-20 lg:py-32">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center space-x-3 mb-8">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-xl">
                <Wand2 className="w-10 h-10 text-blue-100" />
              </div>
              <span className="text-4xl lg:text-5xl font-extrabold tracking-tight">EduQuest<span className="text-blue-300 font-medium">.ai</span></span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold leading-tight mb-6">
              Revolusi Pembuatan<br/>
              <span className="text-blue-200">Soal Guru SD & SMP</span>
            </h1>
            <p className="text-xl lg:text-2xl text-blue-100/90 max-w-3xl mx-auto leading-relaxed font-medium mb-12">
              Buat soal ujian terstandarisasi, analisis Taksonomi Bloom, dan ilustrasi edukatif hanya dalam hitungan detik.
            </p>

            {/* LOGIN FORM HERO */}
            <div className="max-w-md mx-auto bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-white mb-2">Masuk ke Akun Anda</h2>
                <p className="text-blue-100 text-sm">Gunakan Akun Belajar.id untuk melanjutkan</p>
              </div>

              {errorMsg && (
                <div className="mb-6 bg-red-50/90 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-start text-left text-sm font-medium">
                  <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-white ml-1">Email Sekolah / Institusi</label>
                  <div className="relative flex items-center bg-white/20 border border-white/30 rounded-2xl px-4 py-3 focus-within:ring-4 focus-within:ring-white/30 focus-within:border-white transition-all group">
                    <Mail className="w-5 h-5 text-blue-200 group-focus-within:text-white transition-colors" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@institusi.id"
                      className="w-full bg-transparent outline-none ml-3 text-sm text-white placeholder-blue-200 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-white ml-1">Kata Sandi</label>
                  <div className="relative flex items-center bg-white/20 border border-white/30 rounded-2xl px-4 py-3 focus-within:ring-4 focus-within:ring-white/30 focus-within:border-white transition-all group">
                    <Lock className="w-5 h-5 text-blue-200 group-focus-within:text-white transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent outline-none ml-3 text-sm text-white placeholder-blue-200 font-medium"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-blue-200 hover:text-white focus:outline-none transition-colors ml-2">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="w-full bg-white hover:bg-blue-50 text-blue-600 font-bold py-3 px-4 rounded-2xl transition-all shadow-lg flex items-center justify-center group">
                  Masuk <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

              <div className="flex items-center justify-between mb-6">
                <div className="w-full h-[1px] bg-white/30"></div><span className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider">Atau</span><div className="w-full h-[1px] bg-white/30"></div>
              </div>

              <button onClick={handleGoogleLogin} disabled={isLoggingIn} className="w-full bg-white hover:bg-blue-50 text-blue-600 font-bold py-3 px-4 rounded-2xl flex items-center justify-center transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed group mb-4">
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <><img src="https://img.icons8.com/color/48/google-logo.png" alt="Google" className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform"/><span className="text-sm">Lanjutkan dengan Google</span></>}
              </button>

              <button type="button" onClick={handleRegisterNavigation} className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-4 rounded-2xl transition-all border border-white/30">
                Daftar Akun Baru
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* PANDUAN SINGKAT PENGGUNAAN APLIKASI */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-4">Panduan Singkat Penggunaan</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Pelajari cara menggunakan EduQuest.ai dalam 4 langkah sederhana</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow text-center group">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-200 transition-colors">
                <Settings className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">1. Atur Parameter</h3>
              <p className="text-slate-600 leading-relaxed">Pilih mata pelajaran, kelas, dan jenis ujian sesuai kebutuhan</p>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow text-center group">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-green-200 transition-colors">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">2. Masukkan Materi</h3>
              <p className="text-slate-600 leading-relaxed">Ketik manual atau upload RPP/PDF sebagai bahan dasar soal</p>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow text-center group">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-200 transition-colors">
                <Wand2 className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">3. Generate Soal</h3>
              <p className="text-slate-600 leading-relaxed">AI akan membuat soal HOTS dengan ilustrasi dalam hitungan detik</p>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow text-center group">
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-amber-200 transition-colors">
                <Download className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">4. Unduh & Cetak</h3>
              <p className="text-slate-600 leading-relaxed">Download soal siap pakai dalam format MS Word</p>
            </div>
          </div>
        </div>
      </section>

      {/* PAKET YANG TERSEDIA */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-4">Paket Koin Tersedia</h2>
            <p className="text-xl text-slate-600">Pilih paket yang sesuai dengan kebutuhan Anda</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-2xl border-2 border-blue-200 hover:border-blue-500 shadow-lg hover:shadow-xl transition-all text-center relative group">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">POPULER</div>
              <div className="flex items-center justify-center mb-6">
                <Coins className="w-10 h-10 text-blue-500 mr-3" />
                <span className="text-3xl font-bold text-blue-600">50 Koin</span>
              </div>
              <div className="text-4xl font-black text-slate-800 mb-4">Rp 25.000</div>
              <p className="text-slate-600 mb-6 text-lg">Untuk 5x generate soal lengkap</p>
              <ul className="text-sm text-slate-500 space-y-2 mb-8">
                <li>• 5x Generate soal HOTS</li>
                <li>• Mendukung semua jenis soal</li>
                <li>• Ilustrasi AI included</li>
              </ul>
              <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg">
                Pilih Paket
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl border-2 border-green-200 hover:border-green-500 shadow-lg hover:shadow-xl transition-all text-center group">
              <div className="flex items-center justify-center mb-6">
                <Coins className="w-10 h-10 text-green-500 mr-3" />
                <span className="text-3xl font-bold text-green-600">100 Koin</span>
              </div>
              <div className="text-4xl font-black text-slate-800 mb-4">Rp 45.000</div>
              <p className="text-slate-600 mb-6 text-lg">Untuk 10x generate soal lengkap</p>
              <ul className="text-sm text-slate-500 space-y-2 mb-8">
                <li>• 10x Generate soal HOTS</li>
                <li>• Hemat 10% dari pembelian satuan</li>
                <li>• Bonus 5 koin gratis</li>
              </ul>
              <button className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg">
                Pilih Paket
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl border-2 border-purple-200 hover:border-purple-500 shadow-lg hover:shadow-xl transition-all text-center group">
              <div className="flex items-center justify-center mb-6">
                <Coins className="w-10 h-10 text-purple-500 mr-3" />
                <span className="text-3xl font-bold text-purple-600">200 Koin</span>
              </div>
              <div className="text-4xl font-black text-slate-800 mb-4">Rp 80.000</div>
              <p className="text-slate-600 mb-6 text-lg">Untuk 20x generate soal lengkap</p>
              <ul className="text-sm text-slate-500 space-y-2 mb-8">
                <li>• 20x Generate soal HOTS</li>
                <li>• Hemat 20% dari pembelian satuan</li>
                <li>• Bonus 20 koin gratis</li>
              </ul>
              <button className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg">
                Pilih Paket
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* KEUNGGULAN APLIKASI */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-4">Keunggulan EduQuest.ai</h2>
            <p className="text-xl text-slate-600">Teknologi AI terdepan untuk pendidikan Indonesia</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow group">
              <div className="flex items-start mb-6">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-blue-200 transition-colors">
                  <Sparkles className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">AI Generatif Canggih</h3>
                  <p className="text-slate-600 leading-relaxed">Didukung Google Gemini AI untuk menghasilkan soal berkualitas tinggi dengan analisis Taksonomi Bloom otomatis</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow group">
              <div className="flex items-start mb-6">
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-green-200 transition-colors">
                  <ImageIcon className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">Ilustrasi AI Unik</h3>
                  <p className="text-slate-600 leading-relaxed">Setiap soal dilengkapi gambar kartun edukatif yang dibuat khusus oleh Google Imagen AI</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow group">
              <div className="flex items-start mb-6">
                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-purple-200 transition-colors">
                  <Clock className="w-7 h-7 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">Hemat Waktu 90%</h3>
                  <p className="text-slate-600 leading-relaxed">Proses pembuatan soal dari berjam-jam menjadi hanya beberapa detik dengan kualitas terstandar</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow group">
              <div className="flex items-start mb-6">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-amber-200 transition-colors">
                  <ShieldCheck className="w-7 h-7 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">Standar Kurikulum Merdeka</h3>
                  <p className="text-slate-600 leading-relaxed">Soal disesuaikan dengan kurikulum terbaru dan standar kompetensi siswa Indonesia</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow group">
              <div className="flex items-start mb-6">
                <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-red-200 transition-colors">
                  <Download className="w-7 h-7 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">Format MS Word Siap Cetak</h3>
                  <p className="text-slate-600 leading-relaxed">Hasil generate langsung dalam format Word yang siap untuk dicetak atau didistribusikan</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow group">
              <div className="flex items-start mb-6">
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-indigo-200 transition-colors">
                  <CheckCircle2 className="w-7 h-7 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">Beragam Jenis Soal</h3>
                  <p className="text-slate-600 leading-relaxed">Mendukung Pilihan Ganda, Isian, Uraian, Menjodohkan, Benar-Salah, dan Soal Cerita</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* UPDATE TERBARU */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-4">Update Terbaru</h2>
            <p className="text-xl text-slate-600">Fitur dan peningkatan terbaru EduQuest.ai</p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8 shadow-lg">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center mr-6 shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <h3 className="text-2xl font-bold text-blue-900 mr-4">v2.1.0 - AI Image Generation</h3>
                    <span className="bg-blue-100 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">Baru</span>
                  </div>
                  <p className="text-blue-800 text-lg mb-4 leading-relaxed">Setiap soal sekarang dilengkapi dengan ilustrasi kartun edukatif yang dibuat oleh Google Imagen AI. Gambar-gambar ini dirancang khusus untuk anak SD dan SMP dengan gaya yang menarik dan mudah dipahami.</p>
                  <p className="text-blue-600 text-sm font-medium">Dirilis: April 2026</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-lg">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center mr-6 shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <h3 className="text-2xl font-bold text-slate-800 mr-4">v2.0.5 - Enhanced Bloom Analysis</h3>
                    <span className="bg-green-100 text-green-700 text-sm font-bold px-3 py-1 rounded-full">Update</span>
                  </div>
                  <p className="text-slate-600 text-lg mb-4 leading-relaxed">Peningkatan algoritma analisis Taksonomi Bloom dengan akurasi yang lebih tinggi. AI sekarang dapat memberikan rekomendasi tingkat kognitif yang lebih tepat berdasarkan materi yang diunggah.</p>
                  <p className="text-slate-500 text-sm font-medium">Dirilis: Maret 2026</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-lg">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center mr-6 shrink-0">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <h3 className="text-2xl font-bold text-slate-800 mr-4">v2.0.0 - PDF Upload Support</h3>
                    <span className="bg-purple-100 text-purple-700 text-sm font-bold px-3 py-1 rounded-full">Fitur Baru</span>
                  </div>
                  <p className="text-slate-600 text-lg mb-4 leading-relaxed">Sekarang Anda dapat mengunggah file PDF sebagai sumber materi. AI akan secara otomatis membaca dan menganalisis isi dokumen untuk menghasilkan soal yang lebih akurat dan relevan.</p>
                  <p className="text-slate-500 text-sm font-medium">Dirilis: Februari 2026</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-lg">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center mr-6 shrink-0">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <h3 className="text-2xl font-bold text-slate-800 mr-4">v1.5.0 - Multiple Question Types</h3>
                    <span className="bg-amber-100 text-amber-700 text-sm font-bold px-3 py-1 rounded-full">Peningkatan</span>
                  </div>
                  <p className="text-slate-600 text-lg mb-4 leading-relaxed">Penambahan dukungan untuk berbagai jenis soal: Pilihan Ganda, Isian Singkat, Uraian (Esai), Menjodohkan, Benar-Salah, dan Soal Cerita. Lebih fleksibel untuk berbagai kebutuhan pembelajaran.</p>
                  <p className="text-slate-500 text-sm font-medium">Dirilis: Januari 2026</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
                <Wand2 className="w-8 h-8 text-blue-100" />
              </div>
              <span className="text-2xl font-extrabold tracking-tight">EduQuest<span className="text-blue-300 font-medium">.ai</span></span>
            </div>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Membantu guru SD dan SMP di Indonesia membuat soal ujian berkualitas dengan bantuan kecerdasan buatan.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-8 mb-8">
            <a href="https://ed-developing.pages.dev" target="_blank" rel="noopener noreferrer" className="flex items-center text-slate-300 hover:text-blue-400 transition-colors group">
              <Globe className="w-5 h-5 mr-2 text-slate-400 group-hover:text-blue-400 transition-colors" /> Portofolio
            </a>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
            <a href="https://www.facebook.com/dmkbn.e" target="_blank" rel="noopener noreferrer" className="flex items-center text-slate-300 hover:text-blue-400 transition-colors group">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2 text-slate-400 group-hover:text-blue-400 transition-colors"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              Facebook
            </a>
          </div>

          <div className="text-center text-slate-500 text-sm">
            <ShieldCheck className="w-4 h-4 inline mr-2" />
            Sistem Keamanan Terenkripsi © {new Date().getFullYear()} EduQuest.ai
          </div>
        </div>
      </footer>
    </div>
  );
}