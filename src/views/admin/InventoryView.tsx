import React, { useState, useMemo, useEffect } from 'react';
import { useHub } from '../../context/HubContext';
import { useToast } from '../../context/ToastContext';
import {
  Product,
  ProductUOM,
  PurchaseOrder,
  PurchaseInvoice,
  StockInRecord,
  InitialStockRecord
} from '../../types';
import { toBaseQuantity, fromBaseQuantity } from '../../utils/inventoryConversion';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TablePagination } from '../../components/ui/TablePagination';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { useTableState } from '../../utils/useTableState';
import {
  Package,
  PlusCircle,
  FileText,
  Truck,
  Layers,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  X,
  Trash2
} from 'lucide-react';

interface InvoiceItemDraft {
  productId: string;
  quantity: number;
  rate: number;
  discount: number;
}

export interface InventoryViewProps {
  initialTab?: 'STOCK' | 'INVOICES' | 'INITIAL_STOCK' | 'LEDGER';
}

export const InventoryView: React.FC<InventoryViewProps> = ({ initialTab = 'STOCK' }) => {
  const {
    products,
    purchaseInvoices,
    suppliers,
    initialStocks,
    inventoryMovements,
    addPurchaseInvoice,
    addInitialStock,
    getProductStockBase
  } = useHub();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'STOCK' | 'INVOICES' | 'INITIAL_STOCK' | 'LEDGER'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Stock on Hand Search & Filters (Section 14)
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategory, setStockCategory] = useState<'ALL' | 'Cigarette' | 'Candy'>('ALL');

  // Invoices & Initial Stock Search
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [initStockSearch, setInitStockSearch] = useState('');

  // --- Multi-Item Purchase Invoice Workspace State (Direct Receiving) ---
  const [isInvoiceWorkspaceOpen, setIsInvoiceWorkspaceOpen] = useState(false);
  const [invSupplier, setInvSupplier] = useState('Godfrey Phillips India (GPI) Central Depo');
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [invNumber, setInvNumber] = useState('');
  const [invItems, setInvItems] = useState<InvoiceItemDraft[]>([
    { productId: products[0]?.id || '', quantity: 100, rate: products[0]?.standardPurchasePrice || 85, discount: 0 }
  ]);

  // Sync default product into invoice items once products load
  useEffect(() => {
    if (products.length > 0) {
      setInvItems((prev) => {
        const defaultProd = products.find((p) => p.active) || products[0];
        if (!defaultProd) return prev;
        return prev.map((item) => {
          if (!item.productId) {
            return {
              ...item,
              productId: defaultProd.id,
              rate: item.rate || defaultProd.standardPurchasePrice || 85,
            };
          }
          return item;
        });
      });
    }
  }, [products]);

  // --- Multi-Product Initial Stock Workspace State (Section 21) ---
  const [isInitWorkspaceOpen, setIsInitWorkspaceOpen] = useState(false);
  const [initRowInputs, setInitRowInputs] = useState<Record<string, { qty: number | string; cost: number | string; notes: string }>>({});
  const [initGlobalDate, setInitGlobalDate] = useState(new Date().toISOString().split('T')[0]);

  // Ledger Filter states
  const [ledgerProdFilter, setLedgerProdFilter] = useState('ALL');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');

  // Filtered Stock on Hand Products
  const filteredStockProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.active) return false;
      if (stockCategory !== 'ALL' && p.category !== stockCategory) return false;
      if (stockSearch.trim()) {
        const q = stockSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, stockCategory, stockSearch]);

  // Filtered Purchase Invoices
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.toLowerCase().trim();
    if (!q) return purchaseInvoices;
    return purchaseInvoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.supplier.toLowerCase().includes(q) ||
        (inv.notes && inv.notes.toLowerCase().includes(q))
    );
  }, [purchaseInvoices, invoiceSearch]);

  // Filtered Initial Stocks
  const filteredInitStocks = useMemo(() => {
    const q = initStockSearch.toLowerCase().trim();
    if (!q) return initialStocks;
    return initialStocks.filter(
      (s) =>
        s.productName.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
    );
  }, [initialStocks, initStockSearch]);

  // ================= INVOICE HANDLERS (Direct Receiving with Item Discounts) =================
  const handleAddInvRow = () => {
    const defaultProd = products.find((p) => p.active) || products[0];
    setInvItems((prev) => [
      ...prev,
      { productId: defaultProd?.id || '', quantity: 50, rate: defaultProd?.standardPurchasePrice || 85, discount: 0 }
    ]);
  };

  const handleUpdateInvRow = (index: number, field: keyof InvoiceItemDraft, val: any) => {
    setInvItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      if (field === 'productId') {
        const p = products.find((prod) => prod.id === val);
        if (p) copy[index].rate = p.standardPurchasePrice || 85;
      }
      return copy;
    });
  };

  const handleRemoveInvRow = (index: number) => {
    if (invItems.length === 1) return;
    setInvItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Invoice calculations per Item 18:
  // Item Gross = Quantity * Rate
  // Item Net = Item Gross - Item Discount
  // Invoice Gross = SUM(Item Gross)
  // Total Item Discount = SUM(Item Discount)
  // Invoice Net = Invoice Gross - Total Item Discount
  const invGross = invItems.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.rate) || 0)), 0);
  const invTotalDiscount = invItems.reduce((sum, it) => sum + (Number(it.discount) || 0), 0);
  const invGrandTotal = Math.max(0, invGross - invTotalDiscount);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invSupplier.trim()) {
      toast.error('Supplier name is required.');
      return;
    }

    const resolvedItems = invItems.map((it) => {
      let pId = it.productId;
      if (!pId) {
        const defaultProd = products.find((p) => p.active) || products[0];
        pId = defaultProd?.id || '';
      }
      return { ...it, productId: pId };
    });

    const validItems = resolvedItems.filter((it) => (Number(it.quantity) || 0) > 0 && !!it.productId);
    if (validItems.length === 0) {
      toast.error('Enter at least one item with valid product and quantity > 0.');
      return;
    }

    const itemsFormatted = validItems.map((it) => {
      const p = products.find((prod) => prod.id === it.productId);
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const gross = qty * rate;
      const discount = Math.max(0, Number(it.discount) || 0);
      const net = Math.max(0, gross - discount);
      return {
        productId: it.productId,
        productName: p?.name || '',
        quantity: qty,
        rate: rate,
        gross: Number(gross) || 0,
        discount: Number(discount) || 0,
        net: Number(net) || 0
      };
    });

    const res = await addPurchaseInvoice({
      supplier: invSupplier.trim(),
      date: invDate,
      items: itemsFormatted,
      grossAmount: Number(invGross) || 0,
      discount: Number(invTotalDiscount) || 0,
      netAmount: Number(invGrandTotal) || 0,
      notes: invNumber.trim() ? invNumber.trim() : undefined
    });

    if (res?.error) {
      toast.error(`Failed to record invoice: ${res.error}`);
    } else {
      toast.success(`Purchase Invoice recorded and stock received! Net: ₹${(Number(invGrandTotal) || 0).toLocaleString('en-IN')}`);
      setIsInvoiceWorkspaceOpen(false);
      setInvNumber('');
      const defaultProd = products.find((p) => p.active) || products[0];
      setInvItems([{ productId: defaultProd?.id || '', quantity: 100, rate: defaultProd?.standardPurchasePrice || 85, discount: 0 }]);
    }
  };

  // ================= INITIAL STOCK BATCH HANDLER (Section 21) =================
  const handleSaveAllInitialStock = () => {
    let savedCount = 0;
    const errors: string[] = [];

    products.filter((p) => p.active).forEach((p) => {
      const row = initRowInputs[p.id];
      if (!row) return;
      const qty = Number(row.qty) || 0;
      if (qty <= 0) return;

      const cost = Number(row.cost) || p.standardPurchasePrice || 85;
      const res = addInitialStock({
        productId: p.id,
        productName: p.name,
        quantity: qty,
        uom: p.uom,
        unitCost: cost,
        date: initGlobalDate,
        notes: row.notes || 'Opening stock entry'
      });

      if (res.error) {
        errors.push(p.name);
      } else {
        savedCount++;
      }
    });

    if (savedCount > 0) {
      toast.success(`Opening stock established for ${savedCount} products in bulk!`);
      setInitRowInputs({});
      setIsInitWorkspaceOpen(false);
    } else if (errors.length > 0) {
      toast.error(`Opening stock already established for: ${errors.join(', ')}.`);
    } else {
      toast.error('Please enter opening quantity > 0 for at least one product.');
    }
  };

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return inventoryMovements.filter((m) => {
      if (ledgerProdFilter !== 'ALL' && m.productId !== ledgerProdFilter) return false;
      if (ledgerTypeFilter !== 'ALL' && m.transactionType !== ledgerTypeFilter) return false;
      return true;
    });
  }, [inventoryMovements, ledgerProdFilter, ledgerTypeFilter]);

  // Tab 1: Stock table state
  const stockTable = useTableState(filteredStockProducts, {
    initialPageSize: 10,
    initialSortField: 'name',
    initialSortDirection: 'asc',
    sortExtractors: {
      name: (p) => p.name,
      brand: (p) => p.brand,
      stock: (p) => getProductStockBase(p.id),
      uom: (p) => p.uom,
      standardPurchasePrice: (p) => p.standardPurchasePrice || 0,
      rate: (p) => p.rate,
      status: (p) => {
        const s = getProductStockBase(p.id);
        return s <= 0 ? 0 : s <= 20 ? 1 : 2;
      }
    }
  });

  // Tab 2: Invoices table state
  const invoicesTable = useTableState(filteredInvoices, {
    initialPageSize: 10,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    sortExtractors: {
      invoiceNumber: (i) => i.invoiceNumber,
      date: (i) => i.date,
      supplier: (i) => i.supplier,
      grossAmount: (i) => i.grossAmount,
      discount: (i) => i.discount,
      netAmount: (i) => i.netAmount
    }
  });

  // Tab 3: Initial stock table state
  const initStockTable = useTableState(filteredInitStocks, {
    initialPageSize: 10,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    sortExtractors: {
      date: (s) => s.date,
      productName: (s) => s.productName,
      quantity: (s) => s.quantity,
      uom: (s) => s.uom,
      unitCost: (s) => s.unitCost,
      totalValue: (s) => s.quantity * s.unitCost,
      notes: (s) => s.notes || ''
    }
  });

  // Tab 4: Ledger table state
  const ledgerTable = useTableState(filteredMovements, {
    initialPageSize: 10,
    initialSortField: 'date',
    initialSortDirection: 'desc',
    sortExtractors: {
      date: (m) => m.date,
      productName: (m) => m.productName,
      transactionType: (m) => m.transactionType,
      reference: (m) => m.reference || '',
      quantity: (m) => m.displayQuantity,
      baseQuantity: (m) => m.baseQuantity,
      balanceAfter: (m) => m.runningStockBase,
      notes: (m) => m.notes || ''
    }
  });

  return (
    <div className="inventory-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Inventory & Purchases
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Live stock on hand, purchase invoice receiving, opening stock setup, and inventory movement ledger.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'INVOICES' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsInvoiceWorkspaceOpen((prev) => !prev)}
              style={{ fontWeight: 700 }}
            >
              <FileText size={15} />
              <span>{isInvoiceWorkspaceOpen ? 'Hide Invoice Form' : '+ Record Purchase Invoice'}</span>
            </button>
          )}
          {activeTab === 'INITIAL_STOCK' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsInitWorkspaceOpen((prev) => !prev)}
              style={{ fontWeight: 700 }}
            >
              <Layers size={15} />
              <span>{isInitWorkspaceOpen ? 'Hide Opening Form' : 'Add Opening Stock Table'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'STOCK' ? 'active' : ''}`}
          onClick={() => setActiveTab('STOCK')}
          style={{
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'STOCK' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            color: activeTab === 'STOCK' ? '#2563eb' : '#64748b',
            cursor: 'pointer'
          }}
        >
          Live Stock on Hand ({products.filter(p => p.active).length})
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'INVOICES' ? 'active' : ''}`}
          onClick={() => setActiveTab('INVOICES')}
          style={{
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'INVOICES' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            color: activeTab === 'INVOICES' ? '#2563eb' : '#64748b',
            cursor: 'pointer'
          }}
        >
          Purchase Invoices ({purchaseInvoices.length})
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'INITIAL_STOCK' ? 'active' : ''}`}
          onClick={() => setActiveTab('INITIAL_STOCK')}
          style={{
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'INITIAL_STOCK' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            color: activeTab === 'INITIAL_STOCK' ? '#2563eb' : '#64748b',
            cursor: 'pointer'
          }}
        >
          Opening Stock ({initialStocks.length})
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'LEDGER' ? 'active' : ''}`}
          onClick={() => setActiveTab('LEDGER')}
          style={{
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'LEDGER' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            color: activeTab === 'LEDGER' ? '#2563eb' : '#64748b',
            cursor: 'pointer'
          }}
        >
          Movement Ledger ({inventoryMovements.length})
        </button>
      </div>

      {/* Tab 0: Live Stock on Hand (Section 14: What stock do I have?) */}
      {activeTab === 'STOCK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Stock on Hand Table */}
          <div className="table-container">
            <div
              className="table-toolbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                width: '100%',
                marginBottom: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={stockSearch}
                    onChange={(e) => {
                      setStockSearch(e.target.value);
                      stockTable.resetPage();
                    }}
                    style={{
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      width: '220px',
                      outline: 'none'
                    }}
                  />
                </div>

                <select
                  value={stockCategory}
                  onChange={(e) => {
                    setStockCategory(e.target.value as any);
                    stockTable.resetPage();
                  }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: '#ffffff'
                  }}
                >
                  <option value="ALL">All Categories</option>
                  <option value="Cigarette">Cigarettes Only</option>
                  <option value="Candy">Candies Only</option>
                </select>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                Showing {stockTable.totalItems} Active Catalog SKUs
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', minWidth: '780px' }}>
                <thead>
                  <tr>
                    <SortableHeader
                      label="Product Name"
                      field="name"
                      currentSortField={stockTable.sortField}
                      currentSortDirection={stockTable.sortDirection}
                      onSort={stockTable.toggleSort}
                      style={{ padding: '12px 16px' }}
                    />
                    <SortableHeader
                      label="Brand & Category"
                      field="brand"
                      currentSortField={stockTable.sortField}
                      currentSortDirection={stockTable.sortDirection}
                      onSort={stockTable.toggleSort}
                      style={{ padding: '12px 14px' }}
                    />
                    <SortableHeader
                      label="Stock on Hand"
                      field="stock"
                      currentSortField={stockTable.sortField}
                      currentSortDirection={stockTable.sortDirection}
                      onSort={stockTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 14px' }}
                    />
                    <SortableHeader
                      label="UOM"
                      field="uom"
                      currentSortField={stockTable.sortField}
                      currentSortDirection={stockTable.sortDirection}
                      onSort={stockTable.toggleSort}
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="Std Purchase (₹)"
                      field="standardPurchasePrice"
                      currentSortField={stockTable.sortField}
                      currentSortDirection={stockTable.sortDirection}
                      onSort={stockTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 14px' }}
                    />
                    <SortableHeader
                      label="Selling Rate (₹)"
                      field="rate"
                      currentSortField={stockTable.sortField}
                      currentSortDirection={stockTable.sortDirection}
                      onSort={stockTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 14px' }}
                    />
                    <SortableHeader
                      label="Stock Status"
                      field="status"
                      currentSortField={stockTable.sortField}
                      currentSortDirection={stockTable.sortDirection}
                      onSort={stockTable.toggleSort}
                      align="center"
                      style={{ padding: '12px 16px' }}
                    />
                  </tr>
                </thead>
                <tbody>
                  {stockTable.pagedData.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      title={stockSearch ? 'No matching products' : 'No products found'}
                      description={
                        stockSearch
                          ? `No active inventory items matched "${stockSearch}".`
                          : 'No products are currently available in the active catalog.'
                      }
                      icon={<Package size={28} />}
                    />
                  ) : (
                    stockTable.pagedData.map((p) => {
                      const baseStock = getProductStockBase(p.id);
                      const stockInUOM = fromBaseQuantity(p, baseStock, p.uom);
                      const isOutOfStock = stockInUOM <= 0;
                      const isLowStock = stockInUOM > 0 && stockInUOM <= 20;

                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{p.sku}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ color: '#334155', fontWeight: 600 }}>{p.brand}</div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{p.category}</div>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span
                              style={{
                                fontSize: '0.94rem',
                                fontWeight: 900,
                                color: isOutOfStock ? '#dc2626' : isLowStock ? '#d97706' : '#059669'
                              }}
                            >
                              {stockInUOM.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: '#eff6ff',
                                color: '#1d4ed8'
                              }}
                            >
                              {p.uom}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                            ₹{p.standardPurchasePrice || 85}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            ₹{p.rate}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {isOutOfStock ? (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626' }}>
                                OUT OF STOCK
                              </span>
                            ) : isLowStock ? (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                                LOW STOCK
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857' }}>
                                IN STOCK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={stockTable.currentPage}
              totalPages={stockTable.totalPages}
              totalItems={stockTable.totalItems}
              pageSize={stockTable.pageSize}
              onPageChange={stockTable.setCurrentPage}
              onPageSizeChange={stockTable.setPageSize}
              itemLabel="products"
            />
          </div>
        </div>
      )}

      {/* Tab: Purchase Invoices (Direct Stock Receiving Flow with Item Discounts) */}
      {activeTab === 'INVOICES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isInvoiceWorkspaceOpen && (
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  Record Purchase Invoice (Multi-Item)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsInvoiceWorkspaceOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.76rem' }}>Supplier *</label>
                  <input
                    type="text"
                    list="supplier-options"
                    className="input-field"
                    placeholder="Enter or select supplier..."
                    value={invSupplier}
                    onChange={(e) => setInvSupplier(e.target.value)}
                    required
                  />
                  <datalist id="supplier-options">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.76rem' }}>Invoice Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.76rem' }}>Invoice Number *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. INV-2026-9021"
                    value={invNumber}
                    onChange={(e) => setInvNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Items Table */}
                            {/* Desktop Items Table */}
              <div className="inv-desktop-only" style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Product</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, width: '90px', textAlign: 'center' }}>Quantity</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', width: '110px' }}>Actual Rate (₹)</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', width: '110px' }}>Discount (₹)</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right', width: '110px' }}>Net Total (₹)</th>
                      <th style={{ padding: '8px 8px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invItems.map((item, index) => {
                      const itemGross = item.quantity * item.rate;
                      const itemNet = Math.max(0, itemGross - (Number(item.discount) || 0));
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px' }}>
                            <select
                              className="input-field"
                              value={item.productId}
                              onChange={(e) => handleUpdateInvRow(index, 'productId', e.target.value)}
                              style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                            >
                              {products.filter((p) => p.active).map((p) => (
                                <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="number"
                              min="1"
                              data-testid="invoice-item-qty"
                              className="input-field"
                              style={{ padding: '5px 8px', fontSize: '0.82rem', textAlign: 'center' }}
                              value={item.quantity}
                              onChange={(e) => handleUpdateInvRow(index, 'quantity', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              data-testid="invoice-item-rate"
                              className="input-field"
                              style={{ padding: '5px 8px', fontSize: '0.82rem', textAlign: 'right' }}
                              value={item.rate}
                              onChange={(e) => handleUpdateInvRow(index, 'rate', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              className="input-field"
                              style={{ padding: '5px 8px', fontSize: '0.82rem', textAlign: 'right', borderColor: Number(item.discount) > 0 ? '#f59e0b' : undefined }}
                              value={item.discount}
                              onChange={(e) => handleUpdateInvRow(index, 'discount', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            ₹{itemNet.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            {invItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveInvRow(index)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Items Cards (Item 19 Responsive) */}
              <div className="inv-mobile-only" style={{ gap: '10px' }}>
                {invItems.map((item, index) => {
                  const itemGross = item.quantity * item.rate;
                  const itemNet = Math.max(0, itemGross - (Number(item.discount) || 0));
                  return (
                    <div
                      key={index}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b' }}>Item #{index + 1}</span>
                        {invItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveInvRow(index)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 4px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.72rem' }}>Product</label>
                        <select
                          className="input-field"
                          value={item.productId}
                          onChange={(e) => handleUpdateInvRow(index, 'productId', e.target.value)}
                          style={{ fontSize: '0.82rem' }}
                        >
                          {products.filter((p) => p.active).map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Quantity</label>
                          <input
                            type="number"
                            min="1"
                            className="input-field"
                            value={item.quantity}
                            onChange={(e) => handleUpdateInvRow(index, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Actual Rate (₹)</label>
                          <input
                            type="number"
                            min="0"
                            className="input-field"
                            value={item.rate}
                            onChange={(e) => handleUpdateInvRow(index, 'rate', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Discount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            className="input-field"
                            value={item.discount}
                            onChange={(e) => handleUpdateInvRow(index, 'discount', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Net Total</div>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                            ₹{itemNet.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddInvRow}
                  style={{ fontSize: '0.8rem', fontWeight: 700 }}
                >
                  <PlusCircle size={14} />
                  <span>+ Add Product Row</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Gross: <strong>₹{invGross.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: invTotalDiscount > 0 ? '#d97706' : '#64748b' }}>
                    Total Discount: <strong>-₹{invTotalDiscount.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#059669' }}>
                    Net: ₹{invGrandTotal.toLocaleString('en-IN')}
                  </div>

                  <button
                    type="button"
                    data-testid="save-purchase-invoice-btn"
                    className="btn btn-primary"
                    onClick={handleCreateInvoice}
                    style={{ fontWeight: 800, padding: '8px 18px' }}
                  >
                    Save & Receive Stock
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Invoices List Table */}
          <div className="table-container">
            <div
              className="table-toolbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                width: '100%',
                marginBottom: 0
              }}
            >
              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Search invoices by # or supplier..."
                  value={invoiceSearch}
                  onChange={(e) => {
                    setInvoiceSearch(e.target.value);
                    invoicesTable.resetPage();
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 28px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    outline: 'none'
                  }}
                />
                {invoiceSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceSearch('');
                      invoicesTable.resetPage();
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: 0
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                Showing {invoicesTable.totalItems} Invoices
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', minWidth: '780px' }}>
                <thead>
                  <tr>
                    <SortableHeader
                      label="Invoice #"
                      field="invoiceNumber"
                      currentSortField={invoicesTable.sortField}
                      currentSortDirection={invoicesTable.sortDirection}
                      onSort={invoicesTable.toggleSort}
                      style={{ padding: '12px 16px' }}
                    />
                    <SortableHeader
                      label="Date"
                      field="date"
                      currentSortField={invoicesTable.sortField}
                      currentSortDirection={invoicesTable.sortDirection}
                      onSort={invoicesTable.toggleSort}
                      style={{ padding: '12px 12px' }}
                    />
                    <SortableHeader
                      label="Supplier"
                      field="supplier"
                      currentSortField={invoicesTable.sortField}
                      currentSortDirection={invoicesTable.sortDirection}
                      onSort={invoicesTable.toggleSort}
                      style={{ padding: '12px 12px' }}
                    />
                    <th style={{ padding: '12px 12px', fontWeight: 800 }}>Items</th>
                    <SortableHeader
                      label="Gross (₹)"
                      field="grossAmount"
                      currentSortField={invoicesTable.sortField}
                      currentSortDirection={invoicesTable.sortDirection}
                      onSort={invoicesTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 12px' }}
                    />
                    <SortableHeader
                      label="Discount (₹)"
                      field="discount"
                      currentSortField={invoicesTable.sortField}
                      currentSortDirection={invoicesTable.sortDirection}
                      onSort={invoicesTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 12px' }}
                    />
                    <SortableHeader
                      label="Net (₹)"
                      field="netAmount"
                      currentSortField={invoicesTable.sortField}
                      currentSortDirection={invoicesTable.sortDirection}
                      onSort={invoicesTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 12px' }}
                    />
                  </tr>
                </thead>
                <tbody>
                  {invoicesTable.pagedData.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      title={invoiceSearch ? 'No matching invoices' : 'No purchase invoices'}
                      description={
                        invoiceSearch
                          ? `No purchase invoices matched "${invoiceSearch}".`
                          : 'No purchase invoices registered yet. Click "Record Purchase Invoice" above to enter one.'
                      }
                      icon={<FileText size={28} />}
                    />
                  ) : (
                    invoicesTable.pagedData.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#7c3aed' }}>{inv.invoiceNumber}</td>
                        <td style={{ padding: '12px 12px' }}>{inv.date}</td>
                        <td style={{ padding: '12px 12px', fontWeight: 600 }}>{inv.supplier}</td>
                        <td style={{ padding: '12px 12px' }}>
                          {(inv.items || []).map((it, i) => (
                            <div key={i}>{it.productName} × {Number(it.quantity) || 0} @ ₹{Number(it.rate) || 0}</div>
                          ))}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>₹{(Number(inv.grossAmount) || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', color: '#dc2626' }}>
                          {(Number(inv.discount) || 0) > 0 ? `-₹${(Number(inv.discount) || 0).toLocaleString('en-IN')}` : '₹0'}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                          ₹{(Number(inv.netAmount) || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={invoicesTable.currentPage}
              totalPages={invoicesTable.totalPages}
              totalItems={invoicesTable.totalItems}
              pageSize={invoicesTable.pageSize}
              onPageChange={invoicesTable.setCurrentPage}
              onPageSizeChange={invoicesTable.setPageSize}
              itemLabel="invoices"
            />
          </div>
        </div>
      )}

      {/* Tab 4: Initial Opening Stock (Section 21 Multi-Product Table Workspace) */}
      {activeTab === 'INITIAL_STOCK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isInitWorkspaceOpen && (
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #bfdbfe',
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(37,99,235,0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eff6ff', paddingBottom: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e40af' }}>
                    Bulk Opening Stock Entry
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Enter initial baseline inventory for multiple products in one click. Only products without established opening stock will be saved.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInitWorkspaceOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Opening Date:</label>
                <input
                  type="date"
                  className="input-field"
                  style={{ width: '160px', padding: '6px 10px', fontSize: '0.82rem' }}
                  value={initGlobalDate}
                  onChange={(e) => setInitGlobalDate(e.target.value)}
                />
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Product Name</th>
                      <th style={{ padding: '8px 8px', fontWeight: 700 }}>UOM</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, width: '110px' }}>Opening Qty</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', width: '110px' }}>Unit Cost (₹)</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Notes / Audit Ref</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', width: '110px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.filter((p) => p.active).map((p) => {
                      const alreadySet = initialStocks.some((s) => s.productId === p.id);
                      const currentInput = initRowInputs[p.id] || { qty: '', cost: p.standardPurchasePrice || 85, notes: '' };

                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: alreadySet ? '#fafafa' : '#ffffff' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 700, color: alreadySet ? '#94a3b8' : '#0f172a' }}>
                            {p.name} <span style={{ fontSize: '0.72rem', color: '#64748b' }}>({p.brand})</span>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <span style={{ fontSize: '0.72rem', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px', fontWeight: 700 }}>
                              {p.uom}
                            </span>
                          </td>
                          <td style={{ padding: '4px 10px' }}>
                            <input
                              type="number"
                              min="0"
                              disabled={alreadySet}
                              placeholder={alreadySet ? 'Set' : '0'}
                              className="input-field"
                              style={{ padding: '4px 6px', fontSize: '0.82rem', textAlign: 'center' }}
                              value={currentInput.qty}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInitRowInputs((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    ...(prev[p.id] || { qty: '', cost: p.standardPurchasePrice || 85, notes: '' }),
                                    qty: val
                                  }
                                }));
                              }}
                            />
                          </td>
                          <td style={{ padding: '4px 10px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              disabled={alreadySet}
                              className="input-field"
                              style={{ padding: '4px 6px', fontSize: '0.82rem', textAlign: 'right' }}
                              value={currentInput.cost}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInitRowInputs((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    ...(prev[p.id] || { qty: '', cost: p.standardPurchasePrice || 85, notes: '' }),
                                    cost: val
                                  }
                                }));
                              }}
                            />
                          </td>
                          <td style={{ padding: '4px 12px' }}>
                            <input
                              type="text"
                              disabled={alreadySet}
                              placeholder="e.g. Audit verification"
                              className="input-field"
                              style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                              value={currentInput.notes}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInitRowInputs((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    ...(prev[p.id] || { qty: '', cost: p.standardPurchasePrice || 85, notes: '' }),
                                    notes: val
                                  }
                                }));
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            {alreadySet ? (
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#047857' }}>
                                ESTABLISHED
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }}>
                                READY
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsInitWorkspaceOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveAllInitialStock}
                  style={{ fontWeight: 800, padding: '8px 20px' }}
                >
                  Save Opening Stock
                </button>
              </div>
            </div>
          )}

          {/* Initial Stock Records Table */}
          <div className="table-container">
            <div
              className="table-toolbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                width: '100%',
                marginBottom: 0
              }}
            >
              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Search opening stock records..."
                  value={initStockSearch}
                  onChange={(e) => {
                    setInitStockSearch(e.target.value);
                    initStockTable.resetPage();
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 28px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    outline: 'none'
                  }}
                />
                {initStockSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setInitStockSearch('');
                      initStockTable.resetPage();
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: 0
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                Showing {initStockTable.totalItems} Baseline Records
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', minWidth: '780px' }}>
                <thead>
                  <tr>
                    <SortableHeader
                      label="Date"
                      field="date"
                      currentSortField={initStockTable.sortField}
                      currentSortDirection={initStockTable.sortDirection}
                      onSort={initStockTable.toggleSort}
                      style={{ padding: '12px 16px' }}
                    />
                    <SortableHeader
                      label="Product Name"
                      field="productName"
                      currentSortField={initStockTable.sortField}
                      currentSortDirection={initStockTable.sortDirection}
                      onSort={initStockTable.toggleSort}
                      style={{ padding: '12px 12px' }}
                    />
                    <SortableHeader
                      label="Quantity"
                      field="quantity"
                      currentSortField={initStockTable.sortField}
                      currentSortDirection={initStockTable.sortDirection}
                      onSort={initStockTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 12px' }}
                    />
                    <SortableHeader
                      label="UOM"
                      field="uom"
                      currentSortField={initStockTable.sortField}
                      currentSortDirection={initStockTable.sortDirection}
                      onSort={initStockTable.toggleSort}
                      align="center"
                      style={{ padding: '12px 12px' }}
                    />
                    <SortableHeader
                      label="Unit Cost (₹)"
                      field="unitCost"
                      currentSortField={initStockTable.sortField}
                      currentSortDirection={initStockTable.sortDirection}
                      onSort={initStockTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 12px' }}
                    />
                    <SortableHeader
                      label="Total Value (₹)"
                      field="totalValue"
                      currentSortField={initStockTable.sortField}
                      currentSortDirection={initStockTable.sortDirection}
                      onSort={initStockTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 12px' }}
                    />
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {initStockTable.pagedData.length === 0 ? (
                    <TableEmptyState
                      colSpan={7}
                      title={initStockSearch ? 'No matching records' : 'No opening stock records'}
                      description={
                        initStockSearch
                          ? `No opening stock records matched "${initStockSearch}".`
                          : 'No opening stock established yet. Click "Add Opening Stock Table" above to establish baseline inventory.'
                      }
                      icon={<Layers size={28} />}
                    />
                  ) : (
                    initStockTable.pagedData.map((init) => (
                      <tr key={init.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{init.date}</td>
                        <td style={{ padding: '12px 12px', fontWeight: 800, color: '#0f172a' }}>{init.productName}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                          {(Number(init.quantity) || 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 7px', background: '#f1f5f9', borderRadius: '4px' }}>
                            {init.uom}
                          </span>
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>₹{(Number(init.unitCost) || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                          ₹{((Number(init.quantity) || 0) * (Number(init.unitCost) || 0)).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{init.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={initStockTable.currentPage}
              totalPages={initStockTable.totalPages}
              totalItems={initStockTable.totalItems}
              pageSize={initStockTable.pageSize}
              onPageChange={initStockTable.setCurrentPage}
              onPageSizeChange={initStockTable.setPageSize}
              itemLabel="records"
            />
          </div>
        </div>
      )}

      {/* Tab 5: Movement Ledger */}
      {activeTab === 'LEDGER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Ledger Table */}
          <div className="table-container">
            <div
              className="table-toolbar"
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center',
                width: '100%',
                marginBottom: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={15} color="#64748b" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Filter Movements:</span>
              </div>

              <select
                value={ledgerProdFilter}
                onChange={(e) => {
                  setLedgerProdFilter(e.target.value);
                  ledgerTable.resetPage();
                }}
                className="input-field"
                style={{ width: '220px', padding: '6px 10px', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
                ))}
              </select>

              <select
                value={ledgerTypeFilter}
                onChange={(e) => {
                  setLedgerTypeFilter(e.target.value);
                  ledgerTable.resetPage();
                }}
                className="input-field"
                style={{ width: '180px', padding: '6px 10px', fontSize: '0.82rem' }}
              >
                <option value="ALL">All Transaction Types</option>
                <option value="OPENING_STOCK">OPENING_STOCK</option>
                <option value="PURCHASE">PURCHASE</option>
                <option value="STOCK_ISSUE">STOCK_ISSUE</option>
                <option value="RETURN">RETURN</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
              </select>

              <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                Showing {ledgerTable.totalItems} Movements
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', minWidth: '820px' }}>
                <thead>
                  <tr>
                    <SortableHeader
                      label="Date"
                      field="date"
                      currentSortField={ledgerTable.sortField}
                      currentSortDirection={ledgerTable.sortDirection}
                      onSort={ledgerTable.toggleSort}
                      style={{ padding: '12px 14px' }}
                    />
                    <SortableHeader
                      label="Product Name"
                      field="productName"
                      currentSortField={ledgerTable.sortField}
                      currentSortDirection={ledgerTable.sortDirection}
                      onSort={ledgerTable.toggleSort}
                      style={{ padding: '12px 12px' }}
                    />
                    <SortableHeader
                      label="Type"
                      field="transactionType"
                      currentSortField={ledgerTable.sortField}
                      currentSortDirection={ledgerTable.sortDirection}
                      onSort={ledgerTable.toggleSort}
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="Reference"
                      field="reference"
                      currentSortField={ledgerTable.sortField}
                      currentSortDirection={ledgerTable.sortDirection}
                      onSort={ledgerTable.toggleSort}
                      style={{ padding: '12px 12px' }}
                    />
                    <SortableHeader
                      label="Quantity"
                      field="quantity"
                      currentSortField={ledgerTable.sortField}
                      currentSortDirection={ledgerTable.sortDirection}
                      onSort={ledgerTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="Base Change"
                      field="baseQuantity"
                      currentSortField={ledgerTable.sortField}
                      currentSortDirection={ledgerTable.sortDirection}
                      onSort={ledgerTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 10px' }}
                    />
                    <SortableHeader
                      label="Balance"
                      field="balanceAfter"
                      currentSortField={ledgerTable.sortField}
                      currentSortDirection={ledgerTable.sortDirection}
                      onSort={ledgerTable.toggleSort}
                      align="right"
                      style={{ padding: '12px 12px' }}
                    />
                    <th style={{ padding: '12px 14px', fontWeight: 800 }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerTable.pagedData.length === 0 ? (
                    <TableEmptyState
                      colSpan={8}
                      title="No movements match filters"
                      description="No inventory movement ledger records matched the selected product and transaction type filters."
                      icon={<Layers size={28} />}
                    />
                  ) : (
                    ledgerTable.pagedData.map((mov) => {
                      const isPositive = mov.baseQuantity > 0;
                      return (
                        <tr key={mov.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{mov.date}</td>
                          <td style={{ padding: '12px 12px', fontWeight: 700, color: '#0f172a' }}>{mov.productName}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '4px',
                                background:
                                  mov.transactionType === 'OPENING_STOCK'
                                    ? '#eff6ff'
                                    : mov.transactionType === 'PURCHASE'
                                    ? '#ecfdf5'
                                    : mov.transactionType === 'STOCK_ISSUE'
                                    ? '#fff7ed'
                                    : '#f5f3ff',
                                color:
                                  mov.transactionType === 'OPENING_STOCK'
                                    ? '#1d4ed8'
                                    : mov.transactionType === 'PURCHASE'
                                    ? '#047857'
                                    : mov.transactionType === 'STOCK_ISSUE'
                                    ? '#c2410c'
                                    : '#6d28d9'
                              }}
                            >
                              {mov.transactionType}
                            </span>
                          </td>
                          <td style={{ padding: '12px 12px', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                            {mov.reference}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600 }}>
                            {Number(mov.displayQuantity) || 0} {mov.displayUOM}
                          </td>
                          <td
                            style={{
                              padding: '12px 10px',
                              textAlign: 'right',
                              fontWeight: 800,
                              color: isPositive ? '#059669' : '#dc2626'
                            }}
                          >
                            {isPositive ? `+${Number(mov.baseQuantity) || 0}` : `${Number(mov.baseQuantity) || 0}`}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {Number(mov.runningStockBase) || 0}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '0.78rem' }}>
                            {mov.notes || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={ledgerTable.currentPage}
              totalPages={ledgerTable.totalPages}
              totalItems={ledgerTable.totalItems}
              pageSize={ledgerTable.pageSize}
              onPageChange={ledgerTable.setCurrentPage}
              onPageSizeChange={ledgerTable.setPageSize}
              itemLabel="movements"
            />
          </div>
        </div>
      )}
    </div>
  );
};
