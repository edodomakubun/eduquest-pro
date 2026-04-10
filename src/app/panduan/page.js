'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, Wand2, FileText, Settings, Download, 
  Coins, CreditCard, ShieldCheck, Zap, Upload, CheckCircle2, AlertCircle 
} from 'lucide-react';

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      {/* HEADER PANDUAN */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-blue-600">
            <BookIcon className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tight">Pusat Bantuan</span>
          </div>
          <Link href="/" className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg">
            <ChevronLeft className="w-4 h-4 mr-1" /> Kembali ke Aplikasi
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in slide-in-from-bottom-8">
        
        {/* HERO SECTION */}
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Panduan Penggunaan <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">EduQuest.ai</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Pelajari cara menyusun soal ujian berstandar HOTS, menggunakan ilustrasi AI, serta memahami sistem saldo koin dan langganan paket.
          </p>
        </div>

        {/* SECTION 1: CARA MENGGUNAKAN APLIKASI */}
        <section className="mb-16">
          <div className="flex items-center mb-8">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-4">
              <Wand2 className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">1. Cara Membuat Soal Otomatis</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GuideCard 
              step="Langkah 1" 
              title="Atur Parameter Soal" 
              icon={<Settings className="w-6 h-6 text-indigo-500" />}
              desc="Pilih Mata Pelajaran, Kelas, dan Jenis Ujian. Atur juga jumlah soal (Pilihan Ganda, Isian, dll) sesuai kebutuhan Anda."
            />
            <GuideCard 
              step="Langkah 2" 
              title="Pilih Target Bloom" 
              icon={<ShieldCheck className="w-6 h-6 text-green-500" />}
              desc="Pilih tingkat kognitif (Taksonomi Bloom) dari C1 hingga C6. AI akan mengevaluasi apakah materi Anda cocok dengan target ini."
            />
            <GuideCard 
              step="Langkah 3" 
              title="Masukkan Materi (RPP)" 
              icon={<Upload className="w-6 h-6 text-amber-500" />}
              desc="Ketik secara manual atau unggah Modul Ajar berformat PDF/TXT. AI akan membaca dokumen ini sebagai bahan dasar pembuatan soal."
            />
            <GuideCard 
              step="Langkah 4" 
              title="Generate & Unduh" 
              icon={<Download className="w-6 h-6 text-blue-500" />}
              desc="Klik tombol 'Generate'. Tunggu beberapa saat hingga soal dan gambar AI selesai dibuat, lalu klik 'Unduh .doc' untuk mencetak ke MS Word."
            />
          </div>
        </section>

        <hr className="border-slate-200 mb-16" />

        {/* SECTION 2: SISTEM KOIN & FITUR PRO */}
        <section className="mb-16">
          <div className="flex items-center mb-8">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mr-4">
              <Coins className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">2. Memahami Sistem Kredit Koin</h2>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <p className="text-slate-600 mb-6 leading-relaxed">
              EduQuest.ai menggunakan sistem <b>Kredit Koin</b> untuk menggerakkan mesin Kecerdasan Buatan (AI) yang canggih. Setiap pengguna baru akan mendapatkan Koin Gratis (Trial), namun fitur dibatasi.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Box Pengguna Free */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  Pengguna Free (Trial)
                </h3>
                <ul className="space-y-3 text-sm text-slate-600">
                  <li className="flex items-start"><AlertCircle className="w-4 h-4 text-slate-400 mr-2 shrink-0 mt-0.5" /> Hanya bisa membuat soal Pilihan Ganda.</li>
                  <li className="flex items-start"><AlertCircle className="w-4 h-4 text-slate-400 mr-2 shrink-0 mt-0.5" /> Tidak bisa unggah file PDF otomatis.</li>
                  <li className="flex items-start"><AlertCircle className="w-4 h-4 text-slate-400 mr-2 shrink-0 mt-0.5" /> Analisis Taksonomi Bloom dikunci.</li>
                  <li className="flex items-start"><AlertCircle className="w-4 h-4 text-slate-400 mr-2 shrink-0 mt-0.5" /> Fitur Gambar/Ilustrasi AI dinonaktifkan.</li>
                </ul>
              </div>

              {/* Box Pengguna Pro */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-200 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute -top-6 -right-6 text-blue-100/50"><Zap className="w-32 h-32" /></div>
                <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center relative z-10">
                  Pengguna Premium (Pro)
                </h3>
                <ul className="space-y-3 text-sm text-indigo-800 relative z-10 font-medium">
                  <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-green-500 mr-2 shrink-0 mt-0.5" /> Terbuka semua jenis soal (Esai, Menjodohkan, dll).</li>
                  <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-green-500 mr-2 shrink-0 mt-0.5" /> Bebas unggah file PDF berhalaman banyak.</li>
                  <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-green-500 mr-2 shrink-0 mt-0.5" /> Analisis Taksonomi Bloom otomatis oleh AI.</li>
                  <li className="flex items-start"><CheckCircle2 className="w-4 h-4 text-green-500 mr-2 shrink-0 mt-0.5" /> <b>Mendapatkan Ilustrasi Gambar AI di setiap soal.</b></li>
                </ul>
                <div className="mt-5 inline-block bg-white text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm relative z-10">
                  Biaya: 10 Koin / 1x Generate
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: TOP UP & PEMBAYARAN */}
        <section>
          <div className="flex items-center mb-8">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-4">
              <CreditCard className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">3. Cara Top Up & Memilih Paket</h2>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <div className="space-y-8">
              
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold shrink-0">1</div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Buka Halaman Pembayaran</h4>
                  <p className="text-slate-600 text-sm mt-1">Di halaman utama, klik tombol <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-xs mx-1">+ Top Up</span> di pojok kanan atas, atau otomatis diarahkan saat koin Anda habis.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold shrink-0">2</div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Pilih Paket yang Sesuai</h4>
                  <p className="text-slate-600 text-sm mt-1">Anda akan melihat daftar paket yang disediakan oleh Admin (Misal: Paket Basic, Premium, dll). Klik salah satu kartu paket yang ingin Anda beli.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold shrink-0">3</div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Pembayaran bisa dilakukan dengan menggunakan scan QRIS dan transfer bank </h4>
                  <p className="text-slate-600 text-sm mt-1">Gunakan aplikasi perbankan (BCA, Mandiri, dll) atau e-Wallet (GoPay, OVO, Dana) untuk memindai <b>QR Code</b> yang tampil di layar. Lakukan transfer sesuai nominal harga paket.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold shrink-0">4</div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Unggah Bukti Transfer</h4>
                  <p className="text-slate-600 text-sm mt-1">Foto atau screenshot bukti berhasil transfer, lalu unggah ke dalam kotak yang disediakan di halaman tersebut. Klik <b>"Kirim Bukti Pembayaran"</b>.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold shrink-0"><CheckCircle2 className="w-5 h-5"/></div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Selesai! Tunggu Verifikasi Admin</h4>
                  <p className="text-slate-600 text-sm mt-1">Permintaan Anda akan masuk ke status "Pending". Setelah Admin melihat dan menyetujui mutasi tersebut, Koin Anda akan otomatis bertambah dan status akun Anda berubah menjadi <b>Pro/Premium</b>.</p>
                </div>
              </div>

            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

// Komponen Pembantu untuk Kartu Langkah-langkah
function GuideCard({ step, title, icon, desc }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{step}</span>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">{icon}</div>
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}

// Ikon Buku Kecil
function BookIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}