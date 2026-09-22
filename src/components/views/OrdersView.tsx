import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  CreditCard,
  Truck,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  Trash2,
  X,
  MapPin,
  Phone,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNaira, formatDate, formatPhoneForWhatsApp } from '../../utils/formatters';
import { Order, OrderItem, OrderStatus, PaymentStatus, Product } from '../../types';

export const OrdersView: React.FC = () => {
  const {
    orders,
    products,
    customers,
    business,
    createOrder,
    updateOrder,
    deleteOrder,
    isAddOrderOpen,
    setIsAddOrderOpen,
    showToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  // Selected order for detailed receipt view
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  // New Order Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<string>('0');
  const [discount, setDiscount] = useState<string>('0');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Payment Pending');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('New');
  const [orderNotes, setOrderNotes] = useState('');

  // Items in new order
  const [orderItems, setOrderItems] = useState<
    Array<{
      productId: string;
      productName: string;
      variantName?: string;
      quantity: number;
      unitPrice: number;
    }>
  >([]);

  // Item selector helpers
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');
  const [selectedVariantToAdd, setSelectedVariantToAdd] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);

  const getOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Payment Pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Delivered':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'Cancelled':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'New':
      default:
        return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  const getPaymentBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Payment Pending':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Unpaid':
      default:
        return 'text-rose-700 bg-rose-50 border-rose-200';
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || o.orderStatus === statusFilter;
      const matchesPayment = paymentFilter === 'all' || o.paymentStatus === paymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter]);

  // Totals calculation in Add Order Form
  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  }, [orderItems]);

  const computedTotal = useMemo(() => {
    const dFee = Number(deliveryFee) || 0;
    const disc = Number(discount) || 0;
    return Math.max(0, subtotal + dFee - disc);
  }, [subtotal, deliveryFee, discount]);

  // Customer auto-fill when selecting existing customer
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) return;
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone);
      if (cust.location) setDeliveryAddress(cust.location);
    }
  };

  const handleAddItemToOrder = () => {
    if (!selectedProductToAdd) return;
    const prod = products.find((p) => p.id === selectedProductToAdd);
    if (!prod) return;

    setOrderItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        variantName: selectedVariantToAdd || undefined,
        quantity: itemQuantity > 0 ? itemQuantity : 1,
        unitPrice: prod.price,
      },
    ]);

    setSelectedProductToAdd('');
    setSelectedVariantToAdd('');
    setItemQuantity(1);
  };

  const handleRemoveOrderItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || orderItems.length === 0) {
      showToast('Please specify customer name and at least one product', 'error');
      return;
    }

    await createOrder({
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: orderItems,
      deliveryFee: Number(deliveryFee) || 0,
      discount: Number(discount) || 0,
      paymentStatus,
      orderStatus,
      deliveryAddress: deliveryAddress.trim(),
      notes: orderNotes.trim(),
    });

    // Reset
    setIsAddOrderOpen(false);
    setOrderItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setDeliveryFee('0');
    setDiscount('0');
    setOrderNotes('');
  };

  // Generate WhatsApp Invoice Summary
  const generateInvoiceText = (order: Order) => {
    const itemsList = order.items
      .map(
        (it) =>
          `• ${it.productName}${it.variantName ? ` (${it.variantName})` : ''} x ${it.quantity} - ${formatNaira(
            it.totalPrice
          )}`
      )
      .join('\n');

    return `🧾 *ORDER SUMMARY - ${business?.name || 'SellPilot'}*
Order ID: #${order.id}
Customer: ${order.customerName}
Phone: ${order.customerPhone || 'N/A'}
------------------------------------
${itemsList}
------------------------------------
Subtotal: ${formatNaira(order.productSubtotal)}
Delivery Fee: ${formatNaira(order.deliveryFee)}
${order.discount > 0 ? `Discount: -${formatNaira(order.discount)}\n` : ''}*TOTAL AMOUNT: ${formatNaira(order.total)}*
Payment Status: *${order.paymentStatus.toUpperCase()}*
Delivery Address: ${order.deliveryAddress || 'Pending verification'}

*Payment Instructions:*
${business?.paymentInstructions || 'Direct Bank Transfer'}

Thank you for choosing ${business?.name}! Please send us your payment transfer receipt to confirm dispatch.`;
  };

  const handleCopyInvoice = (order: Order) => {
    const text = generateInvoiceText(order);
    navigator.clipboard.writeText(text);
    setCopiedInvoice(true);
    showToast('Order summary copied to clipboard! Ready to paste into WhatsApp');
    setTimeout(() => setCopiedInvoice(false), 3000);
  };

  return (
    <div id="orders-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & New Order CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Order Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Record manual orders from chats, generate WhatsApp invoices, and update payment status.
          </p>
        </div>

        <button
          id="create-order-top-btn"
          onClick={() => {
            if (products.length === 0) {
              showToast('Please add products to your catalog before creating orders.', 'info');
            }
            setIsAddOrderOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Order</span>
        </button>
      </div>

      {/* Orders Filter & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID (SP-...), customer name, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none shrink-0"
            >
              <option value="all">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Payment Pending">Payment Pending</option>
              <option value="Unpaid">Unpaid</option>
            </select>

            {/* Order Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none shrink-0"
            >
              <option value="all">All Order Statuses</option>
              <option value="New">New</option>
              <option value="Payment Pending">Payment Pending</option>
              <option value="Paid">Paid</option>
              <option value="Processing">Processing</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Your orders will appear here.</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
            When a customer confirms a purchase on WhatsApp or Instagram, record it here to track delivery and payment status.
          </p>
          <button
            onClick={() => setIsAddOrderOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-sm transition-colors"
          >
            Create Your First Order
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredOrders.map((order) => {
              const waNumber = formatPhoneForWhatsApp(order.customerPhone);

              return (
                <div
                  key={order.id}
                  id={`order-item-${order.id}`}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: ID and Customer details */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] uppercase font-bold text-teal-400">Order</span>
                      <span className="text-xs font-black">{order.id.slice(-4)}</span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-base">
                          {order.customerName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getOrderStatusBadge(
                            order.orderStatus
                          )}`}
                        >
                          {order.orderStatus}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPaymentBadge(
                            order.paymentStatus
                          )}`}
                        >
                          {order.paymentStatus}
                        </span>
                      </div>

                      {/* Items list */}
                      <p className="text-xs text-slate-600 mt-1">
                        {order.items.map((it) => `${it.productName} (${it.quantity}x)`).join(', ')}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3" />
                          <span>{order.customerPhone}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{order.deliveryAddress || 'Nigeria'}</span>
                        </span>
                        <span>•</span>
                        <span>{formatDate(order.createdDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount and Quick Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <p className="text-lg font-black text-slate-900 leading-none">
                        {formatNaira(order.total)}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {order.deliveryFee > 0 ? `incl. ${formatNaira(order.deliveryFee)} delivery` : 'Free delivery'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* View Receipt / Invoice */}
                      <button
                        onClick={() => setViewingOrder(order)}
                        className="p-2 rounded-xl text-slate-600 hover:text-teal-600 hover:bg-slate-100 transition-colors"
                        title="View Order Details & Invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Copy WhatsApp Summary */}
                      <button
                        onClick={() => handleCopyInvoice(order)}
                        className="p-2 rounded-xl text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Copy WhatsApp Invoice"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {/* Send on WhatsApp directly */}
                      <a
                        href={`https://wa.me/${waNumber}?text=${encodeURIComponent(
                          generateInvoiceText(order)
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="Share on WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- DETAILED INVOICE MODAL --- */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base">Order #{viewingOrder.id}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      viewingOrder.paymentStatus === 'Paid'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {viewingOrder.paymentStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">{formatDate(viewingOrder.createdDate)}</p>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* Customer info */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-800 text-sm">{viewingOrder.customerName}</p>
                <p className="text-slate-600 font-mono">{viewingOrder.customerPhone}</p>
                <p className="text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{viewingOrder.deliveryAddress || 'No address specified'}</span>
                </p>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Ordered Items
                </div>
                {viewingOrder.items.map((it) => (
                  <div key={it.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{it.productName}</p>
                      {it.variantName && (
                        <p className="text-[11px] text-slate-400">Variant: {it.variantName}</p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        {it.quantity} x {formatNaira(it.unitPrice)}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900">{formatNaira(it.totalPrice)}</span>
                  </div>
                ))}
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Product Subtotal</span>
                  <span className="font-semibold">{formatNaira(viewingOrder.productSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="font-semibold">{formatNaira(viewingOrder.deliveryFee)}</span>
                </div>
                {viewingOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount</span>
                    <span>-{formatNaira(viewingOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Amount</span>
                  <span className="text-teal-700">{formatNaira(viewingOrder.total)}</span>
                </div>
              </div>

              {/* Status Update Quick Toggles */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Update Payment Status:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Unpaid', 'Payment Pending', 'Paid'] as PaymentStatus[]).map((ps) => (
                      <button
                        key={ps}
                        onClick={async () => {
                          await updateOrder(viewingOrder.id, { paymentStatus: ps });
                          setViewingOrder((prev) => (prev ? { ...prev, paymentStatus: ps } : null));
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                          viewingOrder.paymentStatus === ps
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {ps}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Update Order Status:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['New', 'Processing', 'Delivered'] as OrderStatus[]).map((os) => (
                      <button
                        key={os}
                        onClick={async () => {
                          await updateOrder(viewingOrder.id, { orderStatus: os });
                          setViewingOrder((prev) => (prev ? { ...prev, orderStatus: os } : null));
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                          viewingOrder.orderStatus === os
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {os}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer with Copy / WhatsApp */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => handleCopyInvoice(viewingOrder)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white transition-colors"
              >
                {copiedInvoice ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy for WhatsApp</span>
                  </>
                )}
              </button>

              <a
                href={`https://wa.me/${formatPhoneForWhatsApp(viewingOrder.customerPhone)}?text=${encodeURIComponent(
                  generateInvoiceText(viewingOrder)
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Send WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE MANUAL ORDER MODAL --- */}
      {isAddOrderOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Create Manual Order</h3>
                <p className="text-xs text-slate-500">Record a sale agreed upon in WhatsApp or Instagram.</p>
              </div>
              <button
                onClick={() => setIsAddOrderOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Existing customer dropdown or new */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Existing Customer (Optional)
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">-- Or enter customer details below --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) - {c.location}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fatima Mohammed"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Customer Phone (WhatsApp)
                  </label>
                  <input
                    type="text"
                    placeholder="+234 809 112 3344"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Delivery Address & State
                </label>
                <input
                  type="text"
                  placeholder="e.g. House 4, 3rd Avenue, Gwarinpa, Abuja"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Product Selector Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Add Product Items *</span>
                  <span className="text-teal-700">{orderItems.length} items added</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <select
                      value={selectedProductToAdd}
                      onChange={(e) => setSelectedProductToAdd(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                    >
                      <option value="">Select product from catalog...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {formatNaira(p.price)} (Stock: {p.stockQuantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Number(e.target.value))}
                      className="w-16 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none text-center"
                    />
                    <button
                      type="button"
                      onClick={handleAddItemToOrder}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold"
                    >
                      Add Item
                    </button>
                  </div>
                </div>

                {/* Items in basket */}
                {orderItems.length > 0 && (
                  <div className="divide-y divide-slate-200 pt-2">
                    {orderItems.map((it, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">{it.productName}</p>
                          <p className="text-[11px] text-slate-500">
                            {it.quantity} x {formatNaira(it.unitPrice)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">
                            {formatNaira(it.unitPrice * it.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveOrderItem(idx)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Fee, Discount, and Total */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Delivery Fee (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="2500"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Discount (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Computed Total Card */}
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-teal-900 uppercase">Calculated Total</span>
                  <p className="text-[11px] text-teal-700">Subtotal + Delivery - Discount</p>
                </div>
                <span className="text-xl font-black text-teal-900">
                  {formatNaira(computedTotal)}
                </span>
              </div>

              {/* Status Selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Payment Pending">Payment Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Order Status
                  </label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="New">New</option>
                    <option value="Payment Pending">Payment Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Processing">Processing</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddOrderOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors"
                >
                  Confirm Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
