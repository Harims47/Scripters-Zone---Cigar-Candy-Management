import React, { useState, useEffect } from 'react';
import { useHub } from '../../context/HubContext';
import { Product, ProductCategory, ProductUOM } from '../../types';
import { Package, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSuccess?: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSuccess
}) => {
  const { addProduct, updateProduct } = useHub();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Cigarette');
  const [subCategory, setSubCategory] = useState<string>('GPI');
  const [brand, setBrand] = useState<string>('Four Square');
  const [uom, setUom] = useState<ProductUOM>('Packet');
  const [purchaseUOM, setPurchaseUOM] = useState<ProductUOM>('M');
  const [salesUOM, setSalesUOM] = useState<ProductUOM>('Packet');
  const [standardPurchasePrice, setStandardPurchasePrice] = useState<number>(85);
  const [rate, setRate] = useState<number>(100);
  const [caseConversionFactor, setCaseConversionFactor] = useState<number>(50);
  const [caseConversionUnit, setCaseConversionUnit] = useState<'M' | 'Packet'>('M');
  const [active, setActive] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      if (productToEdit) {
        setName(productToEdit.name);
        setSku(productToEdit.sku || '');
        setCategory(productToEdit.category);
        setSubCategory(productToEdit.subCategory || 'GPI');
        setBrand(productToEdit.brand || '');
        setUom(productToEdit.uom === 'Pocket' ? 'Packet' : productToEdit.uom);
        setPurchaseUOM(productToEdit.purchaseUOM || (productToEdit.category === 'Candy' ? 'Jar' : 'M'));
        setSalesUOM(productToEdit.salesUOM || (productToEdit.category === 'Candy' ? 'Jar' : 'Packet'));
        setStandardPurchasePrice(productToEdit.standardPurchasePrice || 85);
        setRate(productToEdit.rate);
        setCaseConversionFactor(productToEdit.caseConversionFactor || 50);
        setCaseConversionUnit(productToEdit.caseConversionUnit === 'Pocket' ? 'Packet' : (productToEdit.caseConversionUnit || 'M'));
        setActive(productToEdit.active);
      } else {
        setName('');
        setSku('');
        setCategory('Cigarette');
        setSubCategory('GPI');
        setBrand('Four Square');
        setUom('Packet');
        setPurchaseUOM('M');
        setSalesUOM('Packet');
        setStandardPurchasePrice(85);
        setRate(100);
        setCaseConversionFactor(50);
        setCaseConversionUnit('M');
        setActive(true);
      }
      setErrorMsg(null);
    }
  }, [isOpen, productToEdit]);

  const handleCategoryChange = (newCat: ProductCategory) => {
    setCategory(newCat);
    if (newCat === 'Candy') {
      setSubCategory('GPI');
      setBrand('Funda Goli');
      setUom('Jar');
      setPurchaseUOM('Jar');
      setSalesUOM('Jar');
      setStandardPurchasePrice(200);
      setRate(250);
    } else {
      setSubCategory('GPI');
      setBrand('Four Square');
      setUom('Packet');
      setPurchaseUOM('M');
      setSalesUOM('Packet');
      setStandardPurchasePrice(85);
      setRate(100);
    }
  };

  const handleSubCategoryChange = (newSub: string) => {
    setSubCategory(newSub);
    if (category === 'Cigarette') {
      if (newSub === 'GPI') setBrand('Four Square');
      else if (newSub === 'IPM') setBrand('Marlboro');
    } else {
      if (newSub === 'GPI') setBrand('Funda Goli');
      else if (newSub === 'Fereo') setBrand('Fereo Choco Drops');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }

    if (!brand.trim()) {
      setErrorMsg('Brand name is required.');
      return;
    }

    if (rate <= 0) {
      setErrorMsg('Selling rate must be greater than zero.');
      return;
    }

    if (standardPurchasePrice < 0) {
      setErrorMsg('Standard purchase price cannot be negative.');
      return;
    }

    // Critical Section 14 & 15: Validate Case Conversion Factor
    const isCase = category === 'Cigarette' && (uom === 'Case' || purchaseUOM === 'Case' || salesUOM === 'Case');
    if (isCase) {
      if (!caseConversionFactor || caseConversionFactor <= 0) {
        setErrorMsg('Configurable Case conversion factor is required when Case UOM is used.');
        return;
      }
    }

    const finalSku =
      sku.trim().toUpperCase() ||
      `${category === 'Candy' ? 'CND' : 'CIG'}-${(subCategory || brand || 'GEN').toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;

    const baseUOM = category === 'Candy' ? uom : 'Packet';
    const effectivePurchaseUOM = category === 'Candy' ? uom : purchaseUOM;
    const effectiveSalesUOM = category === 'Candy' ? uom : salesUOM;

    setIsSubmitting(true);

    try {
      if (productToEdit) {
        const res = await updateProduct({
          ...productToEdit,
          name: name.trim(),
          sku: finalSku,
          category,
          subCategory,
          brand: brand.trim(),
          uom,
          purchaseUOM: effectivePurchaseUOM,
          salesUOM: effectiveSalesUOM,
          baseUOM,
          standardPurchasePrice,
          rate,
          caseConversionFactor: isCase ? caseConversionFactor : undefined,
          caseConversionUnit: isCase ? caseConversionUnit : undefined,
          emptyPocketValue: 0,
          couponValue: 0,
          active
        });
        if (res?.error) {
          setErrorMsg(res.error);
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await addProduct({
          name: name.trim(),
          sku: finalSku,
          category,
          subCategory,
          brand: brand.trim(),
          uom,
          purchaseUOM: effectivePurchaseUOM,
          salesUOM: effectiveSalesUOM,
          baseUOM,
          standardPurchasePrice,
          rate,
          caseConversionFactor: isCase ? caseConversionFactor : undefined,
          caseConversionUnit: isCase ? caseConversionUnit : undefined,
          emptyPocketValue: 0,
          couponValue: 0,
          active
        });
        if (res?.error) {
          setErrorMsg(res.error);
          setIsSubmitting(false);
          return;
        }
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving the product.');
      setIsSubmitting(false);
    }
  };

  const isCaseSelected = uom === 'Case' || purchaseUOM === 'Case' || salesUOM === 'Case';

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} color="#2563eb" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
              {productToEdit ? 'Edit Product Master' : 'Add New Product'}
            </h3>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              margin: '12px 20px 0 20px',
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Product Name *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Four Square Regular"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Category *</label>
              <select
                className="input-field"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}
                style={{ fontWeight: 700 }}
              >
                <option value="Cigarette">Cigarette</option>
                <option value="Candy">Candy</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Subcategory / Concessionaire *</label>
              <select
                className="input-field"
                value={subCategory}
                onChange={(e) => handleSubCategoryChange(e.target.value)}
                style={{ fontWeight: 700 }}
              >
                {category === 'Cigarette' ? (
                  <>
                    <option value="GPI">GPI</option>
                    <option value="IPM">IPM</option>
                  </>
                ) : (
                  <>
                    <option value="GPI">GPI</option>
                    <option value="Fereo">Fereo</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Brand *</label>
              <input
                type="text"
                className="input-field"
                placeholder={category === 'Cigarette' ? 'e.g. Four Square' : 'e.g. Funda Goli'}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{category === 'Candy' ? 'Candy UOM *' : 'Catalog Primary UOM *'}</label>
              <select
                className="input-field"
                value={uom}
                onChange={(e) => {
                  const val = e.target.value;
                  setUom(val);
                  if (category === 'Candy') {
                    setPurchaseUOM(val);
                    setSalesUOM(val);
                  }
                }}
                style={{ fontWeight: 700 }}
              >
                {category === 'Cigarette' ? (
                  <>
                    <option value="Packet">PACKET</option>
                    <option value="M">M (100 Packets)</option>
                    <option value="Case">CASE</option>
                  </>
                ) : (
                  <>
                    <option value="Jar">JAR</option>
                    <option value="Hanger">HANGER</option>
                    <option value="Box">BOX</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Unit Configuration — ONLY for Cigarettes per Item 14 */}
          {category === 'Cigarette' && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '8px' }}>
                Unit Configuration
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Purchase UOM
                  </label>
                  <select
                    className="input-field"
                    value={purchaseUOM}
                    onChange={(e) => setPurchaseUOM(e.target.value)}
                  >
                    <option value="M">M</option>
                    <option value="Case">Case</option>
                    <option value="Packet">Packet</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Sales UOM
                  </label>
                  <select
                    className="input-field"
                    value={salesUOM}
                    onChange={(e) => setSalesUOM(e.target.value)}
                  >
                    <option value="Packet">Packet</option>
                    <option value="M">M</option>
                    <option value="Case">Case</option>
                  </select>
                </div>
              </div>

              {/* Configurable Case Conversion */}
              {isCaseSelected && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', marginBottom: '6px' }}>
                    Case Conversion Setting: 1 CASE = ?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Conversion Factor *
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="input-field"
                        value={caseConversionFactor}
                        onChange={(e) => setCaseConversionFactor(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 50"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Conversion Unit
                      </label>
                      <select
                        className="input-field"
                        value={caseConversionUnit}
                        onChange={(e) => setCaseConversionUnit(e.target.value as 'M' | 'Packet')}
                      >
                        <option value="M">M (1 M = 100 Packets)</option>
                        <option value="Packet">Packet</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                    1 Case = {caseConversionUnit === 'M' ? caseConversionFactor * 100 : caseConversionFactor} Packets.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pricing Section (Section 16) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Standard Purchase Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input-field"
                value={standardPurchasePrice}
                onChange={(e) => setStandardPurchasePrice(parseFloat(e.target.value) || 0)}
                style={{ fontWeight: 700, color: '#0f172a' }}
                placeholder="Reference purchase cost"
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Selling Rate (₹) *</label>
              <input
                type="number"
                min="1"
                step="0.5"
                className="input-field"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                style={{ fontWeight: 800, color: '#059669' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="activeCheck"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="activeCheck" style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              Active in Product Master
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }} disabled={isSubmitting}>
              <CheckCircle size={16} />
              <span>{productToEdit ? 'Save Changes' : (isSubmitting ? 'Creating...' : 'Create Product')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
