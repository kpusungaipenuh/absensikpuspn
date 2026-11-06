/**
 * Helper utilitas untuk pencetakan dokumen resmi ke printer atau simpan PDF.
 * Menyelesaikan kendala pencetakan di dalam sandbox iframe / modal browser.
 */

export function printElementById(elementId: string, documentTitle: string = 'Dokumen'): boolean {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Elemen dengan ID "${elementId}" tidak ditemukan.`);
    window.print();
    return false;
  }

  // Ambil seluruh style tag dan link stylesheet yang aktif
  const styleElements = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]')
  );
  let stylesHtml = styleElements.map(el => el.outerHTML).join('\n');

  // Tambahkan style print khusus untuk format A4 portrait 2 halaman
  const printExtraStyles = `
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm 12mm 8mm 12mm;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        background: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        font-family: "Times New Roman", Times, serif;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-page {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        box-shadow: none !important;
        border: none !important;
      }
      .page-break-before {
        page-break-before: always !important;
        break-before: page !important;
      }
      .page-break-after {
        page-break-after: always !important;
        break-after: page !important;
      }
      .no-print {
        display: none !important;
      }
      table {
        border-collapse: collapse;
      }
      @media screen {
        body {
          padding: 20px;
          background: #f1f5f9 !important;
        }
        .print-page {
          background: white;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
      }
    </style>
  `;

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${documentTitle}</title>
        ${stylesHtml}
        ${printExtraStyles}
      </head>
      <body>
        <div id="print-root">
          ${element.innerHTML}
        </div>
      </body>
    </html>
  `;

  try {
    // 1. Coba cetak melalui iframe tersembunyi
    const iframe = document.createElement('iframe');
    iframe.id = 'doc-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('Gagal mengakses iframe document.');
    }

    iframeDoc.open();
    iframeDoc.write(fullHtml);
    iframeDoc.close();

    // Tunggu stylesheet & aset ter-render dalam iframe
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print diblokir oleh browser sandbox, fallback ke window.print', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1500);
      }
    }, 400);

    return true;
  } catch (error) {
    console.warn('Gagal menggunakan print iframe:', error);
    window.print();
    return false;
  }
}

/**
 * Buka dokumen cetak di tab baru sebagai fallback aman jika browser
 * menerapkan sandbox ketat pada iframe yang memblokir dialog window.print().
 */
export function openPrintInNewTab(elementId: string, documentTitle: string = 'Dokumen'): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  const styleElements = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]')
  );
  const stylesHtml = styleElements.map(el => el.outerHTML).join('\n');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${documentTitle}</title>
        ${stylesHtml}
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 12mm 8mm 12mm;
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: "Times New Roman", Times, serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-page {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
          .page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            border-collapse: collapse;
          }
          @media screen {
            .toolbar {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: #1e293b;
              color: white;
              padding: 12px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              font-family: sans-serif;
              z-index: 9999;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .toolbar button {
              background: #b91c1c;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 8px;
              font-weight: bold;
              cursor: pointer;
            }
            .toolbar button:hover {
              background: #991b1b;
            }
            body {
              padding: 80px 20px 40px 20px !important;
              background: #e2e8f0 !important;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            #print-root {
              max-width: 210mm;
              width: 100%;
              background: white;
              padding: 40px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar no-print">
          <div>
            <strong>${documentTitle}</strong> - Format Resmi Cetak KPU Kota Sungai Penuh
          </div>
          <div style="display: flex; gap: 10px;">
            <button onclick="window.print()">Cetak Dokumen Sekarang (PDF / Printer)</button>
            <button onclick="window.close()" style="background: #475569;">Tutup Tab</button>
          </div>
        </div>
        <div id="print-root">
          ${element.innerHTML}
        </div>
        <script>
          // Jalankan dialog cetak otomatis saat halaman selesai dimuat
          window.addEventListener('load', () => {
            setTimeout(() => {
              window.print();
            }, 500);
          });
        </script>
      </body>
    </html>
  `;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank');
  if (!win) {
    alert('Popup diblokir browser. Harap izinkan popup atau gunakan tombol Cetak langsung.');
  }
}
