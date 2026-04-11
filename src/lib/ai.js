import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

// HANYA MENGGUNAKAN API KEY GEMINI RESMI DARI GOOGLE AI STUDIO
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY; 
const appId = 'eduquest-pro';

// --- FUNGSI MENGAMBIL INSTRUKSI AI DARI DATABASE ---
const fetchAiRoleFromDB = async () => {
  try {
    const aiRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'ai_role');
    const snap = await getDoc(aiRef);
    if (snap.exists() && snap.data().instruction) {
      return snap.data().instruction;
    }
  } catch (error) {
    console.error("Gagal menarik Role AI:", error);
  }
  // Default fallback jika belum di-set admin
  return "Anda adalah asisten pembuat soal ujian untuk Guru SD di Indonesia. Pastikan bahasa mudah dipahami oleh anak Sekolah Dasar.";
};

// --- FUNGSI ANALISIS TAKSONOMI BLOOM (DIRECT GEMINI API) ---
export const analyzeBloomWithAI = async (levels, data, isPremium = false, retries = 3) => {
  if (!isPremium) return "Fitur Analisis AI Taksonomi Bloom khusus untuk pengguna Premium.";
  if (!GEMINI_API_KEY) return "API Key Gemini belum dikonfigurasi di Environment Variables Vercel.";

  const materiContext = data.rppText?.trim() ? `\n- Materi/Modul Ajar:\n"${data.rppText.substring(0, 1000)}..."` : `\n- Materi/Modul Ajar: (Belum ada materi)`;
  const kisiContext = data.kisiText?.trim() ? `\n- Kisi-Kisi Acuan:\n"${data.kisiText.substring(0, 1000)}..."` : '';
  
  const systemRole = "Anda ahli kurikulum SD. Analisis SANGAT SINGKAT pilihan Taksonomi Bloom yang diberikan.";
  const prompt = `Analisis pilihan Taksonomi Bloom: [${levels.join(', ')}]. Konteks: Kelas ${data.grade} SD, Mapel ${data.subject}, Ujian ${data.examType}. ${materiContext} ${kisiContext} Respons WAJIB berupa 1-2 kalimat saja, gunakan teks bersih: - Jika sesuai: Berikan validasi singkat. - Jika kurang tepat: Awali dengan "⚠️ REKOMENDASI:", sebutkan tingkat yang seharusnya dan alasan 1 kalimat.`;
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); 

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          systemInstruction: { parts: [{ text: systemRole }] },
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      clearTimeout(timeoutId);
      
      const apiData = await response.json();
      if (!response.ok) throw new Error(apiData.error?.message || 'Gagal menganalisis');
      
      return apiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Analisis selesai.';
    } catch (e) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, i))); 
    }
  }
};

// --- FUNGSI GENERATE SOAL UJIAN TEKS (DIRECT GEMINI API) ---
export const callGeminiTextAPI = async (formData, isPremium = false, retries = 5) => {
  if (!isPremium) {
    const hasNonPG = formData.questionTypes.some(t => t.id !== 'pg' && t.checked);
    if (hasNonPG) throw new Error("Akses Ditolak: Versi Free hanya dapat membuat soal Pilihan Ganda.");
  }
  if (!GEMINI_API_KEY) throw new Error("API Key Gemini belum dikonfigurasi di Environment Variables Vercel.");

  const activeTypes = formData.questionTypes.filter(t => t.checked && t.count > 0);
  const typesInstruction = activeTypes.map(t => `- ${t.label}: ${t.count} soal`).join('\n');
  const totalSoal = activeTypes.reduce((sum, t) => sum + t.count, 0);
  const activeBlooms = isPremium ? formData.bloomLevels.filter(b => b.checked).map(b => b.label).join(', ') : 'Tidak ada batasan Bloom';
  
  const imageInstruction = isPremium ? `"imagePrompt": "Deskripsi gambar gaya KARTUN ANAK-ANAK. WAJIB BAHASA INDONESIA jika ada teks. Tulis 'none' jika tak butuh."` : `"imagePrompt": "none"`;

  const systemRole = await fetchAiRoleFromDB();

  const materiContext = formData.rppText?.trim() ? `Materi Sumber:\n"""\n${formData.rppText.substring(0, 3000)}\n"""\n` : '';
  const kisiContext = formData.kisiText?.trim() ? `Kisi-Kisi Acuan:\n"""\n${formData.kisiText.substring(0, 3000)}\n"""\n(PASTIKAN soal yang Anda buat BENAR-BENAR MENGIKUTI acuan indikator pada kisi-kisi ini!)\n` : '';

  const prompt = `TUGAS SAAT INI:
  Anda DIWAJIBKAN membuat TEPAT ${totalSoal} soal ujian untuk kelas ${formData.grade} SD, mapel ${formData.subject}. Ujian: ${formData.examType}. 
  
  KOMPOSISI SOAL WAJIB (JUMLAH HARUS PERSIS): 
  ${typesInstruction}
  
  Fokus HANYA pada Taksonomi Bloom: ${activeBlooms}.
  
  ${materiContext}
  ${kisiContext}
  
  Respons HANYA format JSON murni tanpa awalan/akhiran markdown dengan skema berikut:
  {
    "questions": [
      {
        "id": "q1",
        "type": "Tuliskan jenis soalnya (Pilihan Ganda / Isian Singkat / Uraian / Menjodohkan / dll)",
        "text": "Teks soal...",
        "options": ["A. Opsi 1", "B. Opsi 2", "C. Opsi 3", "D. Opsi 4"], // Berikan array kosong [] jika tipe soal adalah Uraian/Esai
        "answer": "Jawaban",
        "bloomLevel": "Pilih satu Bloom",
        ${imageInstruction}
      }
    ]
  }
  
  PERINGATAN KRITIS: Array "questions" HARUS memiliki TEPAT ${totalSoal} objek. Jangan kurang dari ${totalSoal}!`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          systemInstruction: { parts: [{ text: systemRole }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" } 
        })
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error?.message || `HTTP Error ${response.status}`);
      
      let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) throw new Error("Format respons AI kosong atau tidak valid.");
      
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedData = JSON.parse(jsonText);
      return (parsedData.questions || []).map(q => ({ ...q, text: q.text.replace(/^\d+[\.\)]\s*/, '') }));
    } catch (e) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw new Error(e.name === 'AbortError' ? "Waktu tunggu respons AI habis. Server sedang sibuk, silakan coba lagi." : e.message);
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i))); 
    }
  }
};

// --- FUNGSI GENERATE KISI-KISI SOAL (DIRECT GEMINI API) ---
export const callGeminiKisiKisiAPI = async (formData, isPremium = false, retries = 5) => {
  const totalSoal = parseInt(formData.pgCount||0) + parseInt(formData.esaiCount||0) + parseInt(formData.bsCount||0) + parseInt(formData.jodohCount||0) + parseInt(formData.ceritaCount||0);
  
  if (!isPremium && totalSoal > 10) {
    throw new Error("Akses Ditolak: Versi Free maksimal menghasilkan 10 soal kisi-kisi. Silakan Upgrade Pro.");
  }
  if (!GEMINI_API_KEY) throw new Error("API Key Gemini belum dikonfigurasi di Environment Variables Vercel.");

  const systemRole = await fetchAiRoleFromDB();

  const prompt = `TUGAS SAAT INI:
  Bertindaklah sebagai ahli pembuat kurikulum Sekolah Dasar (SD) di Indonesia. Buatlah Kisi-Kisi Penyusunan Soal Ujian yang komprehensif, logis, dan terstruktur.
  
  PARAMETER KISI-KISI (JUMLAH HARUS TEPAT ${totalSoal} BARIS KISI-KISI):
  - Mata Pelajaran: ${formData.subject}
  - Kelas / Fase: ${formData.grade}
  - Kurikulum: ${formData.curriculum}
  - Jumlah Pilihan Ganda (PG): ${formData.pgCount || 0}
  - Jumlah Uraian/Esai: ${formData.esaiCount || 0}
  - Jumlah Benar/Salah: ${formData.bsCount || 0}
  - Jumlah Menjodohkan: ${formData.jodohCount || 0}
  - Jumlah Soal Cerita: ${formData.ceritaCount || 0}
  
  MATERI SUMBER:
  - Capaian Pembelajaran (CP) / KD: """${formData.cpText}"""
  - Lingkup Materi Pokok: """${formData.materiText}"""

  INSTRUKSI PENYUSUNAN:
  1. Buat indikator soal yang spesifik, operasional, dan logis.
  2. Distribusikan level kognitif secara proporsional.
  3. Total baris "kisi_kisi" dalam JSON WAJIB berjumlah tepat ${totalSoal} baris.
  
  Respons WAJIB dalam format JSON murni TANPA awalan/akhiran markdown:
  {
    "kisi_kisi": [
      {
        "no": 1,
        "cp": "Teks Capaian Pembelajaran...",
        "materi": "Teks Lingkup Materi...",
        "indikator": "Siswa disajikan sebuah gambar, siswa dapat menentukan...",
        "level_kognitif": "L1 (C2)",
        "bentuk_soal": "PG / Uraian / Benar Salah / Menjodohkan / Cerita",
        "no_soal": "1"
      }
    ]
  }`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          systemInstruction: { parts: [{ text: systemRole }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" } 
        })
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error?.message || `HTTP Error ${response.status}`);
      
      let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) throw new Error("Format respons AI kosong atau tidak valid.");
      
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedData = JSON.parse(jsonText);
      if (!parsedData.kisi_kisi || !Array.isArray(parsedData.kisi_kisi)) {
        throw new Error("AI gagal mengembalikan format tabel kisi-kisi yang benar.");
      }
      return parsedData.kisi_kisi;
    } catch (e) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw new Error(e.name === 'AbortError' ? "Waktu tunggu respons AI habis. Coba lagi." : e.message);
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
    }
  }
};

// --- FUNGSI GENERATE GAMBAR (GEMINI 2.5 FLASH IMAGE - MURNI API GOOGLE) ---
export const callImagenAPI = async (promptText, retries = 3) => {
  const finalPrompt = `cute, colorful cartoon style illustration for elementary school educational material. Highly relevant to the subject context. Child safe, vivid colors, clear outlines. Concept: ${promptText}`;
  
  if (!GEMINI_API_KEY) {
    console.error("API Key Gemini Image tidak ditemukan di Vercel.");
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); 

    try {
      if (i > 0) {
        console.warn(`Mengulang pemuatan gambar dari Gemini Flash Image... Percobaan ke-${i+1}`);
        await new Promise(r => setTimeout(r, 2000 * i)); 
      }

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] }
        })
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("🚨 DETAIL ERROR GEMINI IMAGE:", errorData);
        throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
      }
      
      const data = await response.json();
      const base64Data = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      
      if (base64Data) {
        return `data:image/jpeg;base64,${base64Data}`;
      } else {
        throw new Error("Gambar tidak ditemukan dalam respons Gemini.");
      }
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (i === retries - 1) {
        console.error("Gagal generate gambar via Gemini API:", error);
        return null; 
      }
    }
  }
};