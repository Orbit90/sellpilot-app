import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Sparkles,
  X,
  Image as ImageIcon,
  Tag,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNaira } from '../../utils/formatters';
import { Product, ProductVariant } from '../../types';

export const ProductsView: React.FC = () => {
  const {
    products,
    createProduct,
    updateProduct,
    deleteProduct,
    isAddProductOpen,
    setIsAddProductOpen,
    openAIAssistantWithMessage,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'instock'>('all');

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState<{
    name: string;
    price: string;
    category: string;
    description: string;
    images: string;
    stockQuantity: string;
    sku: string;
    status: 'active' | 'inactive';
    variants: ProductVariant[];
  }>({
    name: '',
    price: '',
    category: 'Fashion',
    description: '',
    images: '',
    stockQuantity: '10',
    sku: '',
    status: 'active',
    variants: [],
  });

  // Variant helper states
  const [variantName, setVariantName] = useState('');
  const [variantStock, setVariantStock] = useState('5');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['all', ...Array.from(set)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === 'all' ||
        p.category.toLowerCase() === selectedCategory.toLowerCase();

      let matchesStock = true;
      if (stockFilter === 'low') matchesStock = p.stockQuantity <= 4;
      if (stockFilter === 'instock') matchesStock = p.stockQuantity > 0;

      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, searchQuery, selectedCategory, stockFilter]);

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      category: product.category,
      description: product.description,
      images: product.images.join(', '),
      stockQuantity: product.stockQuantity.toString(),
      sku: product.sku,
      status: product.status,
      variants: product.variants ? [...product.variants] : [],
    });
  };

  const closeModals = () => {
    setIsAddProductOpen(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      price: '',
      category: 'Fashion',
      description: '',
      images: '',
      stockQuantity: '10',
      sku: '',
      status: 'active',
      variants: [],
    });
    setVariantName('');
    setVariantStock('5');
  };

  const handleAddVariant = () => {
    if (!variantName.trim()) return;
    const newVariant: ProductVariant = {
      id: `var_${Date.now()}`,
      name: variantName.trim(),
      stock: Number(variantStock) || 0,
    };
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, newVariant],
    }));
    setVariantName('');
  };

  const handleRemoveVariant = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.id !== id),
    }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price) return;

    const imgArray = formData.images
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const payload: Partial<Product> = {
      name: formData.name.trim(),
      price: Number(formData.price) || 0,
      category: formData.category.trim(),
      description: formData.description.trim(),
      images: imgArray,
      stockQuantity: Number(formData.stockQuantity) || 0,
      sku: formData.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      status: formData.status,
      variants: formData.variants,
    };

    if (editingProduct) {
      await updateProduct(editingProduct.id, payload);
    } else {
      await createProduct(payload);
    }
    closeModals();
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}" from your catalog?`)) {
      await deleteProduct(id);
    }
  };

  return (
    <div id="products-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Product Catalogue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your merchandise, prices in ₦, stock counts, and variants.
          </p>
        </div>

        <button
          id="add-product-main-btn"
          onClick={() => {
            setEditingProduct(null);
            setIsAddProductOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search and Category Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
          </div>

          {/* Stock Filter Pills */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                stockFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Stock
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
                stockFilter === 'low'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Low Stock (≤4)</span>
            </button>
            <button
              onClick={() => setStockFilter('instock')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                stockFilter === 'instock'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              In Stock
            </button>
          </div>
        </div>

        {/* Category selector row */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-semibold mr-1 shrink-0">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize shrink-0 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-teal-100 text-teal-800 font-bold border border-teal-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* --- PRODUCT GRID / LIST --- */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">You haven't added any products yet.</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Add your fashion items, shoes, bags, or other goods so SellPilot can automatically quote accurate prices and stock levels to your WhatsApp customers.
          </p>
          <button
            id="empty-add-first-product"
            onClick={() => {
              setEditingProduct(null);
              setIsAddProductOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-sm transition-colors"
          >
            Add Your First Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const isLowStock = product.stockQuantity <= 4;
            const isOutOfStock = product.stockQuantity === 0;

            return (
              <div
                key={product.id}
                id={`product-card-${product.id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-slate-300 transition-all"
              >
                {/* Product Image Header */}
                <div className="h-48 bg-slate-100 relative overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}

                  {/* Badges on image */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-slate-800 shadow-sm">
                      {product.category}
                    </span>
                    {isOutOfStock ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-sm">
                        Out of Stock
                      </span>
                    ) : isLowStock ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white shadow-sm flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Low: {product.stockQuantity} left</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-600/90 backdrop-blur-sm text-white shadow-sm">
                        Stock: {product.stockQuantity}
                      </span>
                    )}
                  </div>

                  <span
                    className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      product.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {product.status}
                  </span>
                </div>

                {/* Product Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-extrabold text-base text-slate-900 leading-snug line-clamp-1">
                        {product.name}
                      </h3>
                    </div>
                    <p className="text-xl font-black text-teal-700 mt-1">
                      {formatNaira(product.price)}
                    </p>

                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {product.description || 'No description provided.'}
                    </p>

                    {/* Variants pills */}
                    {product.variants && product.variants.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {product.variants.slice(0, 4).map((v) => (
                          <span
                            key={v.id}
                            className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                          >
                            {v.name} ({v.stock})
                          </span>
                        ))}
                        {product.variants.length > 4 && (
                          <span className="text-[10px] text-slate-400 font-semibold px-1 py-0.5">
                            +{product.variants.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() =>
                        openAIAssistantWithMessage(
                          `Is ${product.name} still available, how much is it and do you deliver to Abuja?`
                        )
                      }
                      title="Test in AI Reply Assistant"
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Test AI Reply</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Edit Product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id, product.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- ADD / EDIT PRODUCT MODAL --- */}
      {(isAddProductOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
                <p className="text-xs text-slate-500">
                  Provide accurate pricing in Naira and stock for AI responses.
                </p>
              </div>
              <button
                onClick={closeModals}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Black Leather Sneaker"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Price (₦ Naira) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500">₦</span>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="35000"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full pl-8 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Shoes, Bags, Apparel, Beauty"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Total Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="10"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    SKU (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ZS-SH-01"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Product Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Mention material, fit, features. The AI Assistant uses this to answer customer questions accurately."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Image URL (or comma-separated URLs)
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.images}
                  onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              {/* Variants Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                    <span>Variants (Sizes, Colors)</span>
                  </label>
                  <span className="text-[11px] text-slate-500">Optional</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Size 42 or Midnight Black"
                    value={variantName}
                    onChange={(e) => setVariantName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Stock"
                    value={variantStock}
                    onChange={(e) => setVariantStock(e.target.value)}
                    className="w-20 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                  >
                    Add
                  </button>
                </div>

                {formData.variants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formData.variants.map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-white border border-slate-200 text-slate-800"
                      >
                        <span>
                          {v.name} ({v.stock} in stock)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(v.id)}
                          className="text-slate-400 hover:text-rose-600 ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Active / Inactive Status */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Status:</label>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={formData.status === 'active'}
                      onChange={() => setFormData({ ...formData, status: 'active' })}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Active (Available for sale)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={formData.status === 'inactive'}
                      onChange={() => setFormData({ ...formData, status: 'inactive' })}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Inactive (Hidden)</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
