/**
 * Utility functions for exporting tabular data to CSV, Excel, and PDF
 */

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(','))
  ].join('\r\n');

  // Prepend UTF-8 BOM so Excel opens currency symbols correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(filename: string, headers: string[], rows: (string | number)[][]) {
  const tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${filename.slice(0, 31)}</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      <style>
        th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #334155; padding: 10px; font-size: 11pt; }
        td { border: 1px solid #cbd5e1; padding: 8px; font-size: 10pt; }
        .num { text-align: right; }
      </style>
    </head>
    <body>
      <h2 style="font-family: Arial, sans-serif; color: #0f172a;">Crackers Hub — ${filename}</h2>
      <p style="font-family: Arial, sans-serif; color: #64748b; font-size: 9pt;">Generated: ${new Date().toLocaleString()}</p>
      <table border="1">
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('\n')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPDF(title: string, headers: string[], rows: (string | number)[][], subtitle?: string) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Please allow popups to generate the printable PDF document.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - Crackers Hub</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 12mm 15mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 20px;
          background: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px;
        }
        .subtitle {
          font-size: 12px;
          color: #64748b;
          margin: 0;
        }
        .meta {
          text-align: right;
          font-size: 11px;
          color: #64748b;
        }
        .hub-tag {
          display: inline-block;
          background: #0f172a;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          margin-bottom: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        th {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.05em;
          padding: 9px 10px;
          text-align: left;
          border: 1px solid #1e293b;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #f1f5f9;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .footer {
          margin-top: 24px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
        }
        @media print {
          body {
            padding: 0;
          }
          th {
            background-color: #0f172a !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="hub-tag">CRACKERS HUB OPERATIONS</div>
          <h1 class="title">${title}</h1>
          ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
        </div>
        <div class="meta">
          <div>Report Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          <div>Printed at: ${new Date().toLocaleTimeString()}</div>
          <div>Total Records: ${rows.length}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              ${r.map(c => `<td>${c ?? '—'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <div>Crackers Hub Operations Management System</div>
        <div>Confidential Operational Document</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
