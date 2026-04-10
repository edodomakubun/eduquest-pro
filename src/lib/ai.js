import { db } from './firebase'; // Kita impor instance db untuk menarik Role AI
import { doc, getDoc } from 'firebase/firestore';

const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
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
  // Default fallback jika belum di-set admin
  return "Anda adalah asisten pembuat soal ujian Guru SD di Indonesia.";
};

export const analyzeBloomWithAI = async (levels, data, isPremium = false, retries = 3) => {
  if (!isPremium) return "Fitur Analisis AI Taksonomi Bloom khusus untuk pengguna Premium.";

  const materiContext = data.rppText.trim() ? `\n- Materi/Modul Ajar:\n"${data.rppText.substring(0, 1000)}..."` : `\n- Materi/Modul Ajar: (Belum ada materi)`;
  const prompt = `Anda ahli kurikulum SD. Analisis SANGAT SINGKAT pilihan Taksonomi Bloom: [${levels.join(', ')}]. Konteks: Kelas ${data.grade} SD, Mapel ${data.subject}, Ujian ${data.examType}. ${materiContext} Respons WAJIB berupa 1-2 kalimat saja, gunakan teks bersih: - Jika sesuai: Berikan validasi singkat. - Jika kurang tepat: Awali dengan "⚠️ REKOMENDASI:", sebutkan tingkat yang seharusnya dan alasan 1 kalimat.`;
  
  const url = `https://openrouter.ai/api/v1/chat/completions`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
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
      
      const apiData = await response.json();
      if (!response.ok) throw new Error(apiData.error?.message || 'Gagal menganalisis');
      
      return apiData.choices?.[0]?.message?.content || 'Analisis selesai.';
    } catch (e) {
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
  
  // MENGAMBIL SYSTEM INSTRUCTION / ROLE AI DARI DB
  const systemRole = await fetchAiRoleFromDB();

  // Menggabungkan instruksi dinamis Admin + Parameter User
  const prompt = `${systemRole}
  
  TUGAS SAAT INI:
  Buat total ${totalSoal} soal ujian untuk kelas ${formData.grade} SD, mapel ${formData.subject}. Ujian: ${formData.examType}. 
  Fokus HANYA pada Taksonomi Bloom: ${activeBlooms}. 
  Komposisi SOAL WAJIB: \n${typesInstruction}
  
  Materi Sumber: """${formData.rppText.substring(0, 3000)}"""
  
  Respons WAJIB format JSON murni tanpa awalan/akhiran markdown:
  { "questions": [ { "id": "q1", "type": "Pilihan Ganda", "text": "Teks soal...", "options": ["A. Opsi 1"], "answer": "Jawaban", "bloomLevel": "Pilih satu Bloom", "imagePrompt": "Deskripsi gambar kartun. Tulis 'none' jika tak butuh." } ] }`;

  const url = `https://openrouter.ai/api/v1/chat/completions`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://eduquest-pro.vercel.app',
          'X-Title': 'EduQuest Pro'
        },
        body: JSON.stringify({ 
          model: AI_MODEL,
          // API OpenRouter mensupport role "system" untuk instruksi dasar, tapi kita satukan ke "user" agar reasoningnya optimal di Gemini 3.1 Flash
          messages: [{ role: "user", content: prompt }],
          reasoning: { enabled: true },
          max_tokens: 4000 
        })
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error?.message || `HTTP Error ${response.status}`);
      
      let jsonText = data.choices?.[0]?.message?.content;
      if (!jsonText) throw new Error("Format respons AI kosong atau tidak valid.");
      
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedData = JSON.parse(jsonText);
      return (parsedData.questions || []).map(q => ({ ...q, text: q.text.replace(/^\d+[\.\)]\s*/, '') }));
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, i)));
    }
  }
};

export const callImagenAPI = async (promptText, retries = 4) => {
  const finalPrompt = `cute, colorful cartoon style illustration for elementary school educational material. Highly relevant to the subject context. IF there are any written words or texts in the image, THEY MUST BE WRITTEN IN INDONESIAN. Child safe. Concept: ${promptText}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const randomSeed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=400&height=400&nologo=true&seed=${randomSeed}`;
      
      if (i > 0) { await new Promise(r => setTimeout(r, 2000 * i)); }
      const response = await fetch(imageUrl, { referrerPolicy: "no-referrer" });
      
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      const blob = await response.blob();
      
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
    } catch (error) {
      if (i === retries - 1) return null; 
    }
  }
};