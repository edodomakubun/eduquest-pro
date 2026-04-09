const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export const analyzeBloomWithAI = async (levels, data) => {
  const materiContext = data.rppText.trim() ? `\n- Materi/Modul Ajar:\n"${data.rppText.substring(0, 1000)}..."` : `\n- Materi/Modul Ajar: (Belum ada materi)`;
  const prompt = `Anda ahli kurikulum SD. Analisis SANGAT SINGKAT pilihan Taksonomi Bloom: [${levels.join(', ')}]. Konteks: Kelas ${data.grade} SD, Mapel ${data.subject}, Ujian ${data.examType}. ${materiContext} Respons WAJIB berupa 1-2 kalimat saja, gunakan teks bersih: - Jika sesuai: Berikan validasi singkat. - Jika kurang tepat: Awali dengan "⚠️ REKOMENDASI:", sebutkan tingkat yang seharusnya dan alasan 1 kalimat.`;
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  
  const apiData = await response.json();
  if (!response.ok) throw new Error(apiData.error?.message || 'Gagal menganalisis');
  return apiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Analisis selesai.';
};

export const callGeminiTextAPI = async (formData, retries = 3) => {
  const activeTypes = formData.questionTypes.filter(t => t.checked && t.count > 0);
  const typesInstruction = activeTypes.map(t => `- ${t.label}: ${t.count} soal`).join('\n');
  const totalSoal = activeTypes.reduce((sum, t) => sum + t.count, 0);
  const activeBlooms = formData.bloomLevels.filter(b => b.checked).map(b => b.label).join(', ');

  const prompt = `Anda asisten pembuat soal ujian Guru SD di Indonesia. Buat total ${totalSoal} soal ujian untuk kelas ${formData.grade} SD, mapel ${formData.subject}. Ujian: ${formData.examType}. Fokus HANYA pada Taksonomi Bloom: ${activeBlooms}. Komposisi: \n${typesInstruction}\nMateri: """${formData.rppText.substring(0, 3000)}"""\nRespons HANYA format JSON:\n{ "questions": [ { "id": "q1", "type": "Pilihan Ganda", "text": "Teks soal...", "options": ["A. Opsi 1"], "answer": "Jawaban", "bloomLevel": "Pilih satu Bloom", "imagePrompt": "Deskripsi gambar gaya KARTUN ANAK-ANAK. WAJIB BAHASA INDONESIA jika ada teks. Tulis 'none' jika tak butuh." } ] }`;

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
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
};

export const callImagenAPI = async (promptText, retries = 3) => {
  const finalPrompt = `Create a cute, colorful cartoon style illustration for elementary school educational material. Highly relevant to the subject context. IF there are any written words or texts in the image, THEY MUST BE WRITTEN IN INDONESIAN. Child safe. Concept: ${promptText}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instances: [{ prompt: finalPrompt }],
          parameters: { sampleCount: 1 }
        })
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error?.message || `HTTP Error ${response.status}`);

      const base64Str = data.predictions?.[0]?.bytesBase64Encoded;
      if (base64Str) return `data:image/jpeg;base64,${base64Str}`;
      return null;
    } catch (e) {
      if (i === retries - 1) return null; 
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
};