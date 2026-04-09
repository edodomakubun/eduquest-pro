export const analyzeBloomWithAI = async (levels, data, isPremium = false, retries = 3) => {
  if (!isPremium) return "Fitur Analisis AI Taksonomi Bloom khusus untuk pengguna Premium.";
  
  if (!window.puter) throw new Error("Sistem AI belum siap. Mohon tunggu sejenak.");

  const materiContext = data.rppText.trim() ? `\n- Materi/Modul Ajar:\n"${data.rppText.substring(0, 1000)}..."` : `\n- Materi/Modul Ajar: (Belum ada materi)`;
  const prompt = `Anda ahli kurikulum SD. Analisis SANGAT SINGKAT pilihan Taksonomi Bloom: [${levels.join(', ')}]. Konteks: Kelas ${data.grade} SD, Mapel ${data.subject}, Ujian ${data.examType}. ${materiContext} Respons WAJIB berupa 1-2 kalimat saja, gunakan teks bersih: - Jika sesuai: Berikan validasi singkat. - Jika kurang tepat: Awali dengan "⚠️ REKOMENDASI:", sebutkan tingkat yang seharusnya dan alasan 1 kalimat.`;
  
  for (let i = 0; i < retries; i++) {
    try {
      // Memanggil Gemini 1.5 Flash melalui Puter.js (Tanpa API Key, Tanpa Limit Ketat)
      const response = await window.puter.ai.chat(prompt, { model: 'gemini-1.5-flash' });
      return response || 'Analisis selesai.';
    } catch (e) {
      if (i === retries - 1) throw new Error('Gagal menganalisis dengan AI: ' + e.message);
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); 
    }
  }
};

export const callGeminiTextAPI = async (formData, isPremium = false, retries = 5) => {
  if (!isPremium) {
    const hasNonPG = formData.questionTypes.some(t => t.id !== 'pg' && t.checked);
    if (hasNonPG) throw new Error("Akses Ditolak: Versi Free hanya dapat membuat soal Pilihan Ganda.");
  }

  if (!window.puter) throw new Error("Sistem AI belum siap. Mohon tunggu sejenak.");

  const activeTypes = formData.questionTypes.filter(t => t.checked && t.count > 0);
  const typesInstruction = activeTypes.map(t => `- ${t.label}: ${t.count} soal`).join('\n');
  const totalSoal = activeTypes.reduce((sum, t) => sum + t.count, 0);
  
  const activeBlooms = isPremium ? formData.bloomLevels.filter(b => b.checked).map(b => b.label).join(', ') : 'Tidak ada batasan Bloom';
  const bloomInstruction = isPremium ? `Fokus HANYA pada Taksonomi Bloom: ${activeBlooms}.` : 'Buat soal dasar (umum) tanpa spesifikasi Taksonomi Bloom yang rumit.';
  
  const imageInstruction = isPremium ? `"imagePrompt": "Deskripsi gambar gaya KARTUN ANAK-ANAK. WAJIB BAHASA INDONESIA jika ada teks. Tulis 'none' jika tak butuh."` : `"imagePrompt": "none"`;

  const prompt = `Anda asisten pembuat soal ujian Guru SD di Indonesia. Buat total ${totalSoal} soal ujian untuk kelas ${formData.grade} SD, mapel ${formData.subject}. Ujian: ${formData.examType}. ${bloomInstruction} Komposisi: \n${typesInstruction}\nMateri: """${formData.rppText.substring(0, 3000)}"""\nRespons HANYA format JSON:\n{ "questions": [ { "id": "q1", "type": "Pilihan Ganda", "text": "Teks soal...", "options": ["A. Opsi 1"], "answer": "Jawaban", "bloomLevel": "Pilih satu Bloom", ${imageInstruction} } ] }`;

  for (let i = 0; i < retries; i++) {
    try {
      // Memanggil Gemini melalui Puter.js
      const responseText = await window.puter.ai.chat(prompt, { model: 'gemini-1.5-flash' });
      
      // Membersihkan format markdown yang terkadang dibawa oleh AI
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedData = JSON.parse(cleanJson);
      return (parsedData.questions || []).map(q => ({ ...q, text: q.text.replace(/^\d+[\.\)]\s*/, '') }));
    } catch (e) {
      if (i === retries - 1) throw new Error("Gagal memuat atau format respons AI tidak valid.");
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, i)));
    }
  }
};

export const callImagenAPI = async (promptText) => {
  const finalPrompt = `cute, colorful cartoon style illustration for elementary school educational material. Highly relevant to the subject context. IF there are any written words or texts in the image, THEY MUST BE WRITTEN IN INDONESIAN. Child safe. Concept: ${promptText}`;
  
  // Menggunakan Pollinations AI (Sudah teruji aman dan gratis tanpa kunci API)
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