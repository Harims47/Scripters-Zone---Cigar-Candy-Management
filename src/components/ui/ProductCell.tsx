import React from 'react';
import { Package, Candy, ShieldAlert } from 'lucide-react';
import { ProductCategory } from '../../types';

export interface ProductCellProps {
  name: string;
  sku?: string;
  category?: ProductCategory | string;
  subCategory?: string;
  brand?: string;
  uom?: string;
  emptyPocketDiscount?: number;
  couponDiscount?: number;
  icon?: React.ReactNode;
}

export const ProductCell: React.FC<ProductCellProps> = ({
  name,
  sku,
  category,
  subCategory,
  brand,
  uom,
  emptyPocketDiscount,
  couponDiscount,
  icon
}) => {
  // Infer category if not directly passed
  const isCigarette =
    category === 'Cigarette' ||
    name.toLowerCase().includes('cigarette') ||
    name.toLowerCase().includes('pocket') ||
    name.toLowerCase().includes('case') ||
    name.toLowerCase().includes('lights') ||
    name.toLowerCase().includes('filter');

  const isCandy =
    category === 'Candy' ||
    name.toLowerCase().includes('candy') ||
    name.toLowerCase().includes('jar') ||
    name.toLowerCase().includes('drops') ||
    name.toLowerCase().includes('chews') ||
    name.toLowerCase().includes('toffee');

  const meta = isCigarette
    ? {
        icon: <Package size={17} color="#0284c7" />,
        bg: '#f0f9ff',
        border: '#bae6fd',
        labelColor: '#0369a1'
      }
    : isCandy
    ? {
        icon: <Candy size={17} color="#db2777" />,
        bg: '#fdf2f8',
        border: '#fbcfe8',
        labelColor: '#be185d'
      }
    : {
        icon: <Package size={17} color="#6366f1" />,
        bg: '#eef2ff',
        border: '#e0e7ff',
        labelColor: '#4f46e5'
      };

  return (
    <div className="table-product-cell">
      <div
        className="table-product-icon"
        style={{
          background: meta.bg,
          borderColor: meta.border
        }}
      >
        {icon || meta.icon}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="table-product-title">{name}</span>
          {sku && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #cbd5e1',
                letterSpacing: '0.04em'
              }}
            >
              {sku}
            </span>
          )}
        </div>
        <div className="table-product-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {subCategory && (
            <span
              style={{
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '1px 5px',
                borderRadius: '3px',
                fontWeight: 700,
                fontSize: '0.68rem',
                textTransform: 'uppercase'
              }}
            >
              {subCategory}
            </span>
          )}
          {brand && (
            <span
              style={{
                background: '#f1f5f9',
                color: '#334155',
                padding: '1px 5px',
                borderRadius: '3px',
                fontWeight: 700,
                fontSize: '0.68rem'
              }}
            >
              {brand}
            </span>
          )}
          {category && <span style={{ color: meta.labelColor, fontWeight: 600 }}>{category}</span>}
          {uom && <span>• {uom}</span>}
          {((emptyPocketDiscount !== undefined && emptyPocketDiscount > 0) || (couponDiscount !== undefined && couponDiscount > 0)) && (
            <span style={{ color: '#d97706', fontSize: '0.7rem' }}>
              ({emptyPocketDiscount ? `Pocket: ₹${emptyPocketDiscount}` : ''}
              {emptyPocketDiscount && couponDiscount ? ' • ' : ''}
              {couponDiscount ? `Cpn: ₹${couponDiscount}` : ''})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
