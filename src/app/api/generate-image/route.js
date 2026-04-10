import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt tidak boleh kosong' }, { status: 400 });
    }

    // Mengambil Secret Key dari Vercel Environment (SANGAT AMAN, TIDAK BOCOR KE BROWSER)
    // Perhatikan: Tidak menggunakan NEXT_PUBLIC_ lagi
    const apiKey = process.env.POLLINATIONS_API_KEY;

    // Prompt dasar gaya kartun anak
    const finalPrompt = `cute, colorful cartoon style illustration for elementary school educational material. Highly relevant to the subject context. IF there are any written words or texts in the image, THEY MUST BE WRITTEN IN INDONESIAN. Child safe. Concept: ${prompt}`;
    
    const randomSeed = Math.floor(Math.random() * 1000000);

    const params = new URLSearchParams({
      width: 400,
      height: 400,
      nologo: true,
      seed: randomSeed,
      enhance: false, 
      model: 'flux' 
    });

    // Menambahkan key jika tersedia di pengaturan Vercel
    if (apiKey) {
      params.append('key', apiKey);
    }

    const imageUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(finalPrompt)}?${params.toString()}`;

    // Menembak request ke Pollinations.ai dari SERVER (bukan browser)
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: { 'Accept': 'image/jpeg, image/png' },
      referrerPolicy: "no-referrer"
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
    }

    // Mengonversi gambar menjadi format Base64 agar mudah dikirim ke Frontend
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const base64Image = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ success: true, image: base64Image });

  } catch (error) {
    console.error("API Route Error (generate-image):", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}