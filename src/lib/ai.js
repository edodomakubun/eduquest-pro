import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

// Mengambil API Key dari brankas rahasia Vercel
const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
// Menambahkan API Key Gemini khusus untuk Image Generation
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY; 

// Menggunakan Model Gemini 3.1 Flash Lite Preview (Via OpenRouter untuk Text)
const AI_MODEL = "google/gemini-3.1-flash-lite-preview"; 
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
  return "Anda adalah asisten pembuat soal ujian untuk Guru SD di Indonesia. Pastikan bahasa mudah dipahami oleh anak Sekolah Dasar.";
};

// --- FUNGSI ANALISIS TAKSONOMI BLOOM ---
export const analyzeBloomWithAI = async (levels, data, isPremium = false, retries = 3) => {
  if (!isPremium) return "Fitur Analisis AI Taksonomi Bloom khusus untuk pengguna Premium.";

  const materiContext = data.rppText?.trim() ? `\n- Materi/Modul Ajar:\n"${data.rppText.substring(0, 1000)}..."` : `\n- Materi/Modul Ajar: (Belum ada materi)`;
  const kisiContext = data.kisiText?.trim() ? `\n- Kisi-Kisi Acuan:\n"${data.kisiText.substring(0, 1000)}..."` : '';
  
  const prompt = `Anda ahli kurikulum SD. Analisis SANGAT SINGKAT pilihan Taksonomi Bloom: [${levels.join(', ')}]. Konteks: Kelas ${data.grade} SD, Mapel ${data.subject}, Ujian ${data.examType}. ${materiContext} ${kisiContext} Respons WAJIB berupa 1-2 kalimat saja, gunakan teks bersih: - Jika sesuai: Berikan validasi singkat. - Jika kurang tepat: Awali dengan "⚠️ REKOMENDASI:", sebutkan tingkat yang seharusnya dan alasan 1 kalimat.`;
  
  const url = `https://openrouter.ai/api/v1/chat/completions`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 Detik Timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal, 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://eduquest-pro.vercel.app', 
          'X-Title': 'EduQuest Pro'
        },
        body: JSON.stringify({ 
          model: AI_MODEL,
          messages: [{ role: "user", content: prompt }],
          reasoning: { enabled: true },
          max_tokens: 1000 
        })
      });
      clearTimeout(timeoutId);
      
      const apiData = await response.json();
      if (!response.ok) throw new Error(apiData.error?.message || 'Gagal menganalisis');
      
      return apiData.choices?.[0]?.message?.content || 'Analisis selesai.';
    } catch (e) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); 
    }
  }
};

// --- FUNGSI GENERATE SOAL UJIAN (TEKS) ---
export const callGeminiTextAPI = async (formData, isPremium = false, retries = 5) => {
  if (!isPremium) {
    const hasNonPG = formData.questionTypes.some(t => t.id !== 'pg' && t.checked);
    if (hasNonPG) throw new Error("Akses Ditolak: Versi Free hanya dapat membuat soal Pilihan Ganda.");
  }

  const activeTypes = formData.questionTypes.filter(t => t.checked && t.count > 0);
  const typesInstruction = activeTypes.map(t => `- ${t.label}: ${t.count} soal`).join('\n');
  const totalSoal = activeTypes.reduce((sum, t) => sum + t.count, 0);
  const activeBlooms = isPremium ? formData.bloomLevels.filter(b => b.checked).map(b => b.label).join(', ') : 'Tidak ada batasan Bloom';
  
  const imageInstruction = isPremium ? `"imagePrompt": "Deskripsi gambar gaya KARTUN ANAK-ANAK. WAJIB BAHASA INDONESIA jika ada teks. Tulis 'none' jika tak butuh."` : `"imagePrompt": "none"`;

  const systemRole = await fetchAiRoleFromDB();

  const materiContext = formData.rppText?.trim() ? `Materi Sumber:\n"""\n${formData.rppText.substring(0, 3000)}\n"""\n` : '';
  const kisiContext = formData.kisiText?.trim() ? `Kisi-Kisi Acuan:\n"""\n${formData.kisiText.substring(0, 3000)}\n"""\n(PASTIKAN soal yang Anda buat BENAR-BENAR MENGIKUTI acuan indikator pada kisi-kisi ini!)\n` : '';

  const prompt = `${systemRole}
  
  TUGAS SAAT INI:
  Buat total ${totalSoal} soal ujian untuk kelas ${formData.grade} SD, mapel ${formData.subject}. Ujian: ${formData.examType}. 
  Fokus HANYA pada Taksonomi Bloom: ${activeBlooms}. 
  Komposisi SOAL WAJIB: \n${typesInstruction}
  
  ${materiContext}
  ${kisiContext}
  
  Respons HANYA format JSON murni tanpa awalan/akhiran markdown:
  { "questions": [ { "id": "q1", "type": "Pilihan Ganda", "text": "Teks soal...", "options": ["A. Opsi 1"], "answer": "Jawaban", "bloomLevel": "Pilih satu Bloom", ${imageInstruction} } ] }`;

  const url = `https://openrouter.ai/api/v1/chat/completions`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal, 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://eduquest-pro.vercel.app',
          'X-Title': 'EduQuest Pro'
        },
        body: JSON.stringify({ 
          model: AI_MODEL,
          messages: [{ role: "user", content: prompt }],
          reasoning: { enabled: true },
          response_format: { type: "json_object" }, 
          max_tokens: 4000 
        })
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error?.message || `HTTP Error ${response.status}`);
      
      let jsonText = data.choices?.[0]?.message?.content;
      if (!jsonText) throw new Error("Format respons AI kosong atau tidak valid.");
      
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedData = JSON.parse(jsonText);
      return (parsedData.questions || []).map(q => ({ ...q, text: q.text.replace(/^\d+[\.\)]\s*/, '') }));
    } catch (e) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw new Error(e.name === 'AbortError' ? "Waktu tunggu respons AI habis. Coba lagi." : e.message);
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, i)));
    }
  }
};

// --- FUNGSI GENERATE KISI-KISI SOAL ---
export const callGeminiKisiKisiAPI = async (formData, isPremium = false, retries = 5) => {
  const totalSoal = parseInt(formData.pgCount||0) + parseInt(formData.esaiCount||0) + parseInt(formData.bsCount||0) + parseInt(formData.jodohCount||0) + parseInt(formData.ceritaCount||0);
  
  if (!isPremium && totalSoal > 10) {
    throw new Error("Akses Ditolak: Versi Free maksimal menghasilkan 10 soal kisi-kisi. Silakan Upgrade Pro.");
  }

  const systemRole = await fetchAiRoleFromDB();

  const prompt = `${systemRole}
  
  TUGAS SAAT INI:
  Bertindaklah sebagai ahli pembuat kurikulum Sekolah Dasar (SD) di Indonesia. Buatlah Kisi-Kisi Penyusunan Soal Ujian yang komprehensif, logis, dan terstruktur.
  
  PARAMETER KISI-KISI:
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
  1. Buat indikator soal yang spesifik, operasional (menggunakan KKO yang tepat), dan logis berdasarkan materi.
  2. Distribusikan level kognitif secara proporsional (gabungan dari L1/C1-C2, L2/C3, L3/C4-C6).
  3. Indikator biasanya berbunyi seperti: "Disajikan sebuah teks/gambar..., siswa dapat menentukan..."
  4. Total baris kisi-kisi harus TEPAT ${totalSoal} baris.
  
  Respons WAJIB dalam format JSON murni TANPA awalan/akhiran markdown atau teks apapun:
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

  const url = `https://openrouter.ai/api/v1/chat/completions`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal, 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://eduquest-pro.vercel.app',
          'X-Title': 'EduQuest Pro'
        },
        body: JSON.stringify({ 
          model: AI_MODEL,
          messages: [{ role: "user", content: prompt }],
          reasoning: { enabled: true },
          response_format: { type: "json_object" }, 
          max_tokens: 6000 
        })
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error?.message || `HTTP Error ${response.status}`);
      
      let jsonText = data.choices?.[0]?.message?.content;
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
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, i)));
    }
  }
};

// --- FUNGSI GENERATE GAMBAR (UPGRADE KE GEMINI API IMAGEN-4.0) ---
export const callImagenAPI = async (promptText, retries = 3) => {
  const finalPrompt = `cute, colorful cartoon style illustration for elementary school educational material. Highly relevant to the subject context. Child safe, vivid colors, clear outlines. Concept: ${promptText}`;
  
  // Jika API Key Gemini tidak dipasang, gunakan sistem Pollinations (Fallback)
  if (!GEMINI_API_KEY) {
    console.warn("API Key Gemini Image tidak ditemukan, menggunakan fallback Pollinations...");
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=400&height=400&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    try {
      const response = await fetch(fallbackUrl, { referrerPolicy: "no-referrer" });
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) { return null; }
  }

  // JIKA ADA API KEY: Gunakan Google Gemini Imagen 4 (Via REST API Resmi)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 Detik Timeout

    try {
      if (i > 0) {
        console.warn(`Mengulang pemuatan gambar dari Gemini API... Percobaan ke-${i+1}`);
        await new Promise(r => setTimeout(r, 2000 * i)); 
      }

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: finalPrompt }],
          parameters: { sampleCount: 1, aspectRatio: "1:1" }
        })
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("🚨 DETAIL ERROR GEMINI IMAGE:", errorData); // <-- LOG ERROR AKAN MUNCUL DI CONSOLE BROWSER (F12)
        throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
      }
      
      const data = await response.json();
      
      // Mengambil Base64 mentah dari respons API Google
      const base64Data = data.predictions?.[0]?.bytesBase64Encoded;
      
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