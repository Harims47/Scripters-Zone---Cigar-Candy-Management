import React, { useState, useMemo } from 'react';
import { useHub } from '../../context/HubContext';
import { Product, ProductCategory } from '../../types';
import { TableExportButtons } from '../../components/ui/TableExportButtons';
import { TablePagination } from '../../components/ui/TablePagination';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { TableEmptyState } from '../../components/ui/TableEmptyState';
import { ProductFormModal } from '../../components/modals/ProductFormModal';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportHelpers';
import { useTableState } from '../../utils/useTableState';
import { Search, Plus, Edit2, Trash2, Package } from 'lucide-react';

export const ProductsCatalogView: React.FC = () => {
  const { products, deleteProduct, isLoading, error, refreshAll } = useHub();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ProductCategory>('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const availableSubCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.subCategory) set.add(p.subCategory);
    });
    return Array.from(set);
  }, [products]);

  // Filtering
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
      const matchSub = subCategoryFilter === 'ALL' || p.subCategory === subCategoryFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.uom && p.uom.toLowerCase().includes(q));
      return matchCat && matchSub && matchSearch;
    });
  }, [products, categoryFilter, subCategoryFilter, searchTerm]);

  // Table State: Sorting & Pagination
  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    sortField,
    sortDirection,
    toggleSort,
    pagedData: pagedProducts,
    totalItems,
    resetPage
  } = useTableState(filteredProducts, {
    initialPageSize: 10,
    initialSortField: 'name',
    initialSortDirection: 'asc',
    sortExtractors: {
      sku: (p) => p.sku || '',
      name: (p) => p.name,
      category: (p) => p.category,
      brand: (p) => p.brand || p.subCategory || '',
      uom: (p) => p.uom,
      standardPurchasePrice: (p) => Number(p.standardPurchasePrice || 0),
      rate: (p) => Number(p.rate || 0),
      active: (p) => (p.active ? 1 : 0)
    }
  });

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    resetPage();
  };

  const handleCategoryChange = (val: 'ALL' | ProductCategory) => {
    setCategoryFilter(val);
    resetPage();
  };

  const handleSubCategoryChange = (val: string) => {
    setSubCategoryFilter(val);
    resetPage();
  };

  const handleEdit = (prod: Product) => {
    setEditingProduct(prod);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name} from the Product Master?`)) {
      deleteProduct(id);
    }
  };

  // Exports
  const handleExportCSV = () => {
    const headers = ['SKU', 'Product', 'Category', 'Sub Category', 'Brand', 'UOM', 'Std Purchase (₹)', 'Rate (₹)', 'Status'];
    const rows = filteredProducts.map((p) => [
      p.sku || '—',
      p.name,
      p.category,
      p.subCategory || '—',
      p.brand,
      p.uom,
      p.standardPurchasePrice || '—',
      p.rate,
      p.active ? 'Active' : 'Inactive'
    ]);
    exportToCSV('product_master', headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['SKU', 'Product', 'Category', 'Sub Category', 'Brand', 'UOM', 'Std Purchase (₹)', 'Rate (₹)', 'Status'];
    const rows = filteredProducts.map((p) => [
      p.sku || '—',
      p.name,
      p.category,
      p.subCategory || '—',
      p.brand,
      p.uom,
      p.standardPurchasePrice || '—',
      p.rate,
      p.active ? 'Active' : 'Inactive'
    ]);
    exportToExcel('product_master', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['SKU', 'Product', 'Category', 'Sub Category', 'Brand', 'UOM', 'Std Purchase', 'Selling Rate'];
    const rows = filteredProducts.map((p) => [
      p.sku || '—',
      p.name,
      p.category,
      p.subCategory || '—',
      p.brand,
      p.uom,
      p.standardPurchasePrice ? `₹${p.standardPurchasePrice}` : '—',
      `₹${p.rate}`
    ]);
    exportToPDF('Product Master Catalog', headers, rows);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Product Master Catalog
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Master catalog for Candy and Cigarette lines with category, brand, UOM, and selling rates.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TableExportButtons
            onExportCSV={handleExportCSV}
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAdd}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
          >
            <Plus size={16} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="table-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
            <div className="table-search-box" style={{ width: '100%' }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search product name, SKU, brand..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              className="select-field"
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value as any)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <option value="ALL">All Categories</option>
              <option value="Cigarette">Cigarette</option>
              <option value="Candy">Candy</option>
            </select>

            <select
              className="select-field"
              value={subCategoryFilter}
              onChange={(e) => handleSubCategoryChange(e.target.value)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <option value="ALL">All Concessionaires</option>
              {availableSubCategories.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', minWidth: '920px' }}>
            <thead>
              <tr>
                <SortableHeader label="SKU" field="sku" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Product Name" field="name" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Category" field="category" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} />
                <SortableHeader label="Brand / Group" field="brand" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} />
                <SortableHeader label="UOM (Base)" field="uom" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} align="center" />
                <SortableHeader label="Std Purchase (₹)" field="standardPurchasePrice" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} align="right" />
                <SortableHeader label="Selling Rate" field="rate" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} align="right" />
                <SortableHeader label="Status" field="active" currentSortField={sortField} currentSortDirection={sortDirection} onSort={toggleSort} align="center" />
                <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {error && products.length === 0 ? (
                <TableEmptyState
                  isError
                  title="Failed to load product catalog"
                  description={error}
                  onRetry={refreshAll}
                  colSpan={9}
                />
              ) : pagedProducts.length === 0 ? (
                <TableEmptyState
                  title="No products found"
                  description="No products match your current search and filter criteria."
                  actionLabel="Clear All Filters"
                  onAction={() => {
                    setSearchTerm('');
                    setCategoryFilter('ALL');
                    setSubCategoryFilter('ALL');
                  }}
                  colSpan={9}
                />
              ) : (
                pagedProducts.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.76rem', fontWeight: 700, padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px', color: '#475569' }}>
                        {p.sku}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px', fontWeight: 800, color: '#0f172a' }}>
                      {p.name}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: p.category === 'Cigarette' ? '#eff6ff' : '#fdf2f8', color: p.category === 'Cigarette' ? '#1d4ed8' : '#be185d' }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 600, color: '#334155' }}>
                      {p.brand} ({p.subCategory})
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 7px', background: '#f1f5f9', borderRadius: '4px', color: '#475569' }}>
                        {p.uom} {p.baseUOM && p.baseUOM !== p.uom ? `(${p.baseUOM})` : ''}
                      </span>
                      {p.caseConversionFactor ? (
                        <div style={{ fontSize: '0.68rem', color: '#2563eb', marginTop: '2px', fontWeight: 600 }}>
                          1 Case = {p.caseConversionFactor} {p.caseConversionUnit || 'M'}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>
                      {p.standardPurchasePrice ? `₹${p.standardPurchasePrice.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      ₹{p.rate.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: p.active ? '#ecfdf5' : '#f1f5f9', color: p.active ? '#047857' : '#94a3b8' }}>
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => handleEdit(p)}
                          title="Edit Product"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 6px', color: '#ef4444' }}
                          onClick={() => handleDelete(p.id, p.name)}
                          title="Delete Product"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          totalItems={filteredProducts.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productToEdit={editingProduct}
      />
    </div>
  );
};
