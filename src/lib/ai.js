import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

// Menggunakan Model Gemini 3.1 Flash Lite Preview
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

export const analyzeBloomWithAI = async (levels, data, isPremium = false, retries = 3) => {
  if (!isPremium) return "Fitur Analisis AI Taksonomi Bloom khusus untuk pengguna Premium.";

  const materiContext = data.rppText.trim() ? `\n- Materi/Modul Ajar:\n"${data.rppText.substring(0, 1000)}..."` : `\n- Materi/Modul Ajar: (Belum ada materi)`;
  const prompt = `Anda ahli kurikulum SD. Analisis SANGAT SINGKAT pilihan Taksonomi Bloom: [${levels.join(', ')}]. Konteks: Kelas ${data.grade} SD, Mapel ${data.subject}, Ujian ${data.examType}. ${materiContext} Respons WAJIB berupa 1-2 kalimat saja, gunakan teks bersih: - Jika sesuai: Berikan validasi singkat. - Jika kurang tepat: Awali dengan "⚠️ REKOMENDASI:", sebutkan tingkat yang seharusnya dan alasan 1 kalimat.`;
  
  const url = `https://openrouter.ai/api/v1/chat/completions`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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

export const callGeminiTextAPI = async (formData, isPremium = false, retries = 5) => {
  if (!isPremium) {
    const hasNonPG = formData.questionTypes.some(t => t.id !== 'pg' && t.checked);
    if (hasNonPG) throw new Error("Akses Ditolak: Versi Free hanya dapat membuat soal Pilihan Ganda.");
  }

  const activeTypes = formData.questionTypes.filter(t => t.checked && t.count > 0);
  const typesInstruction = activeTypes.map(t => `- ${t.label}: ${t.count} soal`).join('\n');
  const totalSoal = activeTypes.reduce((sum, t) => sum + t.count, 0);
  
  const activeBlooms = isPremium ? formData.bloomLevels.filter(b => b.checked).map(b => b.label).join(', ') : 'Tidak ada batasan Bloom';
  const bloomInstruction = isPremium ? `Fokus HANYA pada Taksonomi Bloom: ${activeBlooms}.` : 'Buat soal dasar (umum) tanpa spesifikasi Taksonomi Bloom yang rumit.';
  
  const imageInstruction = isPremium ? `"imagePrompt": "Deskripsi gambar gaya KARTUN ANAK-ANAK. WAJIB BAHASA INDONESIA jika ada teks. Tulis 'none' jika tak butuh."` : `"imagePrompt": "none"`;

  const systemRole = await fetchAiRoleFromDB();

  const prompt = `${systemRole}
  
  TUGAS SAAT INI:
  Buat total ${totalSoal} soal ujian untuk kelas ${formData.grade} SD, mapel ${formData.subject}. Ujian: ${formData.examType}. 
  ${bloomInstruction}
  Komposisi SOAL WAJIB: \n${typesInstruction}
  
  Materi Sumber: """${formData.rppText.substring(0, 3000)}"""
  
  Respons HANYA format JSON murni yang sesuai struktur berikut:
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
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
    }
  }
};

// KEMBALI KE JALUR GRATIS (Frontend Request Tanpa API Key)
export const callImagenAPI = async (promptText, retries = 4) => {
  const finalPrompt = `cute, colorful cartoon style illustration for elementary school educational material. Highly relevant to the subject context. IF there are any written words or texts in the image, THEY MUST BE WRITTEN IN INDONESIAN. Child safe. Concept: ${promptText}`;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // Batas waktu tunggu 20 detik per gambar

    try {
      const randomSeed = Math.floor(Math.random() * 1000000);
      
      // Memanggil URL publik gratis dari Pollinations tanpa parameter key
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=400&height=400&nologo=true&seed=${randomSeed}`;
      
      if (i > 0) {
        console.warn(`Mengulang pemuatan gambar... Percobaan ke-${i+1}`);
        await new Promise(r => setTimeout(r, 2000 * i)); 
      }

      const response = await fetch(imageUrl, { 
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      
      const blob = await response.blob();
      
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (i === retries - 1) {
        console.error("Gagal total mengonversi gambar setelah beberapa percobaan:", error);
        return null; // Tetap kembalikan null agar soal tetap tampil meskipun gambarnya gagal dimuat
      }
    }
  }
};