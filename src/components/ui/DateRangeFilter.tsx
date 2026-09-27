import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onPresetSelect?: (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onPresetSelect
}) => {
  const handlePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (preset === 'today') {
      onStartDateChange(todayStr);
      onEndDateChange(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      onStartDateChange(y);
      onEndDateChange(y);
    } else if (preset === 'week') {
      const w = new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0];
      onStartDateChange(w);
      onEndDateChange(todayStr);
    } else if (preset === 'month') {
      const m = new Date();
      m.setDate(1);
      onStartDateChange(m.toISOString().split('T')[0]);
      onEndDateChange(todayStr);
    } else if (preset === 'all') {
      onStartDateChange('2026-01-01');
      onEndDateChange(todayStr);
    }

    if (onPresetSelect) onPresetSelect(preset);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        background: '#ffffff',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>
        <Calendar size={16} color="#6366f1" />
        <span>Date Range:</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="date"
          className="input-field"
          style={{ padding: '6px 10px', fontSize: '0.8rem', width: '138px' }}
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
        />
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>to</span>
        <input
          type="date"
          className="input-field"
          style={{ padding: '6px 10px', fontSize: '0.8rem', width: '138px' }}
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          type="button"
          onClick={() => handlePreset('today')}
          style={{
            padding: '4px 8px',
            fontSize: '0.74rem',
            fontWeight: 600,
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            cursor: 'pointer',
            color: '#334155'
          }}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => handlePreset('yesterday')}
          style={{
            padding: '4px 8px',
            fontSize: '0.74rem',
            fontWeight: 600,
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            cursor: 'pointer',
            color: '#334155'
          }}
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => handlePreset('week')}
          style={{
            padding: '4px 8px',
            fontSize: '0.74rem',
            fontWeight: 600,
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            cursor: 'pointer',
            color: '#334155'
          }}
        >
          7 Days
        </button>
        <button
          type="button"
          onClick={() => handlePreset('all')}
          style={{
            padding: '4px 8px',
            fontSize: '0.74rem',
            fontWeight: 600,
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            cursor: 'pointer',
            color: '#334155'
          }}
        >
          All Time
        </button>
      </div>
    </div>
  );
};
