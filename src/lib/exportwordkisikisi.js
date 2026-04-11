export const exportToWordKisiKisi = (formData, kisiData, coins, showError) => {
  try {
    const totalSoal = parseInt(formData.pgCount||0) + parseInt(formData.esaiCount||0) + parseInt(formData.bsCount||0) + parseInt(formData.jodohCount||0) + parseInt(formData.ceritaCount||0);
    const schoolLevel = formData.schoolLevel || 'SD';

    let wordHTML = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Kisi-Kisi Ujian ${schoolLevel}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: black; }
          .header-title { text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 25px; }
          
          table.meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-weight: bold; }
          table.meta-table td { border: none; padding: 3px; vertical-align: top; }
          table.meta-table td:first-child { width: 22%; }
          table.meta-table td:nth-child(2) { width: 2%; }
          
          table.kisi-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          table.kisi-table th, table.kisi-table td { border: 1px solid black; padding: 6px; text-align: left; vertical-align: top; }
          table.kisi-table th { background-color: #d1fae5; text-align: center; font-weight: bold; font-size: 11pt; }
          
          .text-center { text-align: center !important; }
        </style>
      </head>
      <body>
        <div class="header-title">KISI-KISI PENYUSUNAN SOAL UJIAN</div>
        
        <table class="meta-table">
          <tr><td>Jenjang Pendidikan</td><td>:</td><td>${schoolLevel}</td></tr>
          <tr><td>Mata Pelajaran</td><td>:</td><td>${formData.subject}</td></tr>
          <tr><td>Kurikulum</td><td>:</td><td>${formData.curriculum}</td></tr>
          <tr><td>Kelas / Fase</td><td>:</td><td>${formData.grade}</td></tr>
          <tr><td>Penyusun</td><td>:</td><td>${formData.teacherName}</td></tr>
          <tr><td>Jumlah Soal</td><td>:</td><td>${totalSoal}</td></tr>
        </table>

        <table class="kisi-table">
          <tr>
            <th width="5%">No</th>
            <th width="20%">Capaian Pembelajaran (CP) / KD</th>
            <th width="20%">Lingkup Materi</th>
            <th width="30%">Indikator Soal</th>
            <th width="10%">Level Kognitif</th>
            <th width="10%">Bentuk Soal</th>
            <th width="5%">No Soal</th>
          </tr>
    `;

    kisiData.forEach((row, index) => {
      wordHTML += `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td>${row.cp || ''}</td>
            <td>${row.materi || ''}</td>
            <td>${row.indikator || ''}</td>
            <td class="text-center">${row.level_kognitif || ''}</td>
            <td class="text-center">${row.bentuk_soal || ''}</td>
            <td class="text-center">${row.no_soal || ''}</td>
          </tr>
      `;
    });

    wordHTML += `
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', wordHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Kisi_Kisi_${formData.subject}_Kelas${formData.grade}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (typeof showError === 'function') {
      showError('Dokumen Kisi-Kisi berhasil diunduh. Sisa koin Anda: ' + coins);
    }
  } catch (error) {
    console.error("Gagal mengexport word:", error);
    if (typeof showError === 'function') showError('Terjadi kesalahan saat mengunduh dokumen.');
  }
};