export const exportToWord = (formData, questions, coins, showError) => {
    let wordHTML = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='[http://www.w3.org/TR/REC-html40](http://www.w3.org/TR/REC-html40)'>
      <head>
        <meta charset='utf-8'>
        <title>Soal Ujian SD</title>
        <style>
          body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: black; }
          .header-kop { margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid black; font-family: 'Arial', sans-serif; }
          .header-title { text-align: center; font-weight: bold; margin-bottom: 20px; }
          .question-block { margin-bottom: 15px; page-break-inside: avoid; }
          .options { margin-left: 20px; margin-top: 5px; }
          .option-item { margin-bottom: 4px; }
          img { width: 200px; height: auto; margin-top: 10px; margin-bottom: 10px; }
          .page-break { page-break-before: always; }
          table.content-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          table.content-table th, table.content-table td { border: 1px solid black; padding: 8px; text-align: left; }
          table.content-table th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header-kop">
          <table style="width: 100%; border-collapse: collapse; border: none;">
            <tr>
              <td style="width: 15%; text-align: left; vertical-align: middle; border: none;">
                <img src="[https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Logo_of_the_Ministry_of_Education_and_Culture_of_the_Republic_of_Indonesia.svg/400px-Logo_of_the_Ministry_of_Education_and_Culture_of_the_Republic_of_Indonesia.svg.png](https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Logo_of_the_Ministry_of_Education_and_Culture_of_the_Republic_of_Indonesia.svg/400px-Logo_of_the_Ministry_of_Education_and_Culture_of_the_Republic_of_Indonesia.svg.png)" style="width: 80px; height: auto;" alt="Logo Tut Wuri Handayani" />
              </td>
              <td style="width: 70%; text-align: center; vertical-align: middle; border: none;">
                <div style="font-size: 14pt; line-height: 1.15;">PEMERINTAH KABUPATEN KEPULAUAN TANIMBAR</div>
                <div style="font-size: 16pt; font-weight: bold; line-height: 1.15;">DINAS PENDIDIKAN DAN KEBUDAYAAN</div>
                <div style="font-size: 16pt; line-height: 1.15;">SD INPRES LELINGLUAN</div>
                <div style="font-size: 10pt; line-height: 1.0; margin-top: 4px;">Jln. Wearnusmurin Lelingluan – Kec. Tanut – Kepulauan Tanimbar, Maluku</div>
                <div style="font-size: 10pt; line-height: 1.0;">Telepon. (-) , e-mail:sdinpresleling@gmail.com, Kode Pos 9746</div>
                <div style="font-size: 10pt; line-height: 1.0;">website: sdinpreslelingluan.com</div>
              </td>
              <td style="width: 15%; border: none;"></td>
            </tr>
          </table>
        </div>
        <div class="header-title">
          <span style="font-size: 14pt; text-transform: uppercase;">SOAL ${formData.examType} SD</span><br>
          <span style="font-size: 11pt; font-weight: normal;">Mata Pelajaran: ${formData.subject} | Kelas: ${formData.grade}</span>
        </div>
    `;

    const groupedQuestions = questions.reduce((acc, q) => {
      const type = q.type || 'Lainnya';
      if (!acc[type]) acc[type] = [];
      acc[type].push(q);
      return acc;
    }, {});

    let globalIndex = 1;
    Object.keys(groupedQuestions).forEach(type => {
      wordHTML += `<div style="margin-top: 25px; margin-bottom: 10px; font-weight: bold; font-size: 12pt; background-color: #f8fafc; padding: 5px;">Bagian: ${type}</div>`;
      groupedQuestions[type].forEach(q => {
        wordHTML += `
          <div class="question-block">
            <div><b>${globalIndex}.</b> ${q.text}</div>
            ${q.imageUrl ? `<div><img src="${q.imageUrl}" width="200" alt="Ilustrasi"/></div>` : ''}
            <div class="options">
              ${q.options && q.options.length > 0 ? q.options.map(opt => `<div class="option-item">${opt}</div>`).join('') : ''}
            </div>
            ${type.includes('Isian') || type.includes('Esai') || type.includes('Uraian') ? `<div style="margin-top: 15px; margin-bottom: 25px; color: #64748b;">Jawab: ________________________________________________________<br>________________________________________________________</div>` : ''}
          </div>
        `;
        globalIndex++;
      });
    });

    wordHTML += `
        <div class="page-break"></div>
        <div class="header">
          <span style="font-size: 14pt;">KUNCI JAWABAN</span><br>
          <span style="font-size: 11pt;">Mata Pelajaran: ${formData.subject} | Kelas: ${formData.grade}</span>
        </div>
        <table class="content-table">
          <tr><th width="10%">No</th><th width="65%">Jawaban Benar</th><th width="25%">Tingkat Kognitif</th></tr>
    `;

    let answerIndex = 1;
    Object.keys(groupedQuestions).forEach(type => {
      wordHTML += `<tr><td colspan="3" style="background-color: #e2e8f0; font-weight: bold; text-align: center; font-size: 10pt;">${type.toUpperCase()}</td></tr>`;
      groupedQuestions[type].forEach(q => {
        wordHTML += `<tr><td style="text-align:center;"><b>${answerIndex}</b></td><td>${q.answer}</td><td>${q.bloomLevel.split('(')[0].trim()}</td></tr>`;
        answerIndex++;
      });
    });

    wordHTML += `</table></body></html>`;
    const blob = new Blob(['\ufeff', wordHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Soal_${formData.subject}_Kelas${formData.grade}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showError('Dokumen berhasil diunduh. Sisa koin Anda: ' + coins);
};
