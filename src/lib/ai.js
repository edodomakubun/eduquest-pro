const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export const analyzeBloomWithAI = async (levels, data, isPremium = false, retries = 3) => {
  if (!isPremium) return "Fitur Analisis AI Taksonomi Bloom khusus untuk pengguna Premium.";

  const materiContext = data.rppText.trim() ? `\n- Materi/Modul Ajar:\n"${data.rppText.substring(0, 1000)}..."` : `\n- Materi/Modul Ajar: (Belum ada materi)`;
  const prompt = `Anda ahli kurikulum SD. Analisis SANGAT SINGKAT pilihan Taksonomi Bloom: [${levels.join(', ')}]. Konteks: Kelas ${data.grade} SD, Mapel ${data.subject}, Ujian ${data.examType}. ${materiContext} Respons WAJIB berupa 1-2 kalimat saja, gunakan teks bersih: - Jika sesuai: Berikan validasi singkat. - Jika kurang tepat: Awali dengan "⚠️ REKOMENDASI:", sebutkan tingkat yang seharusnya dan alasan 1 kalimat.`;
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      const apiData = await response.json();
      if (!response.ok) throw new Error(apiData.error?.message || 'Gagal menganalisis');
      return apiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Analisis selesai.';
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); 
    }
  }
};

export const callGeminiTextAPI = async (formData, isPremium = false, retries = 5) => {
  // --- VALIDASI BACKEND: Keamanan User Free ---
  if (!isPremium) {
    const hasNonPG = formData.questionTypes.some(t => t.id !== 'pg' && t.checked);
    if (hasNonPG) throw new Error("Akses Ditolak: Versi Free hanya dapat membuat soal Pilihan Ganda.");
  }

  const activeTypes = formData.questionTypes.filter(t => t.checked && t.count > 0);
  const typesInstruction = activeTypes.map(t => `- ${t.label}: ${t.count} soal`).join('\n');
  const totalSoal = activeTypes.reduce((sum, t) => sum + t.count, 0);
  
  // Bypass Taksonomi Bloom jika Free
  const activeBlooms = isPremium ? formData.bloomLevels.filter(b => b.checked).map(b => b.label).join(', ') : 'Tidak ada batasan Bloom';
  const bloomInstruction = isPremium ? `Fokus HANYA pada Taksonomi Bloom: ${activeBlooms}.` : 'Buat soal dasar (umum) tanpa spesifikasi Taksonomi Bloom yang rumit.';
  
  // Bypass Gambar jika Free
  const imageInstruction = isPremium ? `"imagePrompt": "Deskripsi gambar gaya KARTUN ANAK-ANAK. WAJIB BAHASA INDONESIA jika ada teks. Tulis 'none' jika tak butuh."` : `"imagePrompt": "none"`;

  const prompt = `Anda asisten pembuat soal ujian Guru SD di Indonesia. Buat total ${totalSoal} soal ujian untuk kelas ${formData.grade} SD, mapel ${formData.subject}. Ujian: ${formData.examType}. ${bloomInstruction} Komposisi: \n${typesInstruction}\nMateri: """${formData.rppText.substring(0, 3000)}"""\nRespons HANYA format JSON:\n{ "questions": [ { "id": "q1", "type": "Pilihan Ganda", "text": "Teks soal...", "options": ["A. Opsi 1"], "answer": "Jawaban", "bloomLevel": "Pilih satu Bloom", ${imageInstruction} } ] }`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error?.message || `HTTP Error ${response.status}`);
      
      const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) throw new Error("Format respons AI kosong atau tidak valid.");
      
      const parsedData = JSON.parse(jsonText);
      return (parsedData.questions || []).map(q => ({ ...q, text: q.text.replace(/^\d+[\.\)]\s*/, '') }));
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, i)));
    }
  }
};

export const callImagenAPI = async (promptText) => {
  const finalPrompt = `cute, colorful cartoon style illustration for elementary school educational material. Highly relevant to the subject context. IF there are any written words or texts in the image, THEY MUST BE WRITTEN IN INDONESIAN. Child safe. Concept: ${promptText}`;
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=400&height=400&nologo=true`;
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Gagal memuat gambar');
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Gambar gagal dikonversi ke Base64:", error);
    return null;
  }
};