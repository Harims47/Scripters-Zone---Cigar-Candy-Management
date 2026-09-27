import React from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';

interface TableExportButtonsProps {
  onExportCSV: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  disabled?: boolean;
}

export const TableExportButtons: React.FC<TableExportButtonsProps> = ({
  onExportCSV,
  onExportExcel,
  onExportPDF,
  disabled = false
}) => {
  return (
    <div className="table-export-group">
      <button
        type="button"
        className="btn-export csv"
        onClick={onExportCSV}
        disabled={disabled}
        title="Export to CSV Spreadsheet"
      >
        <FileText size={13} />
        <span>CSV</span>
      </button>

      <button
        type="button"
        className="btn-export excel"
        onClick={onExportExcel}
        disabled={disabled}
        title="Export to Microsoft Excel"
      >
        <FileSpreadsheet size={13} />
        <span>Excel</span>
      </button>

      <button
        type="button"
        className="btn-export pdf"
        onClick={onExportPDF}
        disabled={disabled}
        title="Export / Print to PDF"
      >
        <FileText size={13} />
        <span>PDF</span>
      </button>
    </div>
  );
};
