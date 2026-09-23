import React from 'react';
import {
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Clock,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Plus,
  ChevronRight,
  Phone,
  Calendar,
  MessageCircle,
  MessageSquareText,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNaira, formatDate, formatRelativeTime } from '../../utils/formatters';
import { Order, OrderStatus } from '../../types';

export const DashboardView: React.FC = () => {
  const {
    user,
    business,
    orders,
    customers,
    products,
    followUps,
    conversations,
    setActiveConversation,
    setActiveSection,
    setIsAddOrderOpen,
    setIsAddProductOpen,
    setViewingCustomer,
    openAIAssistantWithMessage,
  } = useApp();

  // Calculate stats dynamically
  // Today's sales: sum of orders placed in the last 24h or created today
  const todaySales = orders
    .filter((o) => o.paymentStatus === 'Paid')
    .reduce((sum, o) => sum + o.total, 0);

  const totalOrdersCount = orders.length;
  const pendingPaymentsCount = orders.filter((o) => o.paymentStatus === 'Payment Pending' || o.orderStatus === 'Payment Pending').length;
  const followUpsCount = followUps.filter((f) => f.status === 'Pending').length;
  const lowStockCount = products.filter((p) => p.stockQuantity <= 4).length;

  // Sales Intelligence Stats
  const purchaseReadyCount = conversations.filter(
    (c) => c.leadStage === 'ready_to_buy' || c.detectedIntent === 'purchase_intent' || c.orderOpportunity
  ).length;
  const latestConversation = conversations.length > 0 ? conversations[0] : null;

  const recentOrders = orders.slice(0, 5);
  const recentCustomers = customers.slice(0, 4);

  const getStatusBadge = (status: OrderStatus) => {
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

  return (
    <div id="dashboard-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Good day, {business?.name || 'Seller'} 👋
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Here is what is happening across your WhatsApp and Instagram sales today.
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5">
          {user?.role === 'admin' && (
            <button
              id="dash-quick-admin-btn"
              onClick={() => setActiveSection('admin-dashboard')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-teal-950 text-teal-300 hover:bg-slate-900 border border-teal-500/40 shadow-sm transition-all"
              title="Open Admin Subscribers & Users Dashboard"
            >
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Admin Portal</span>
            </button>
          )}

          <button
            id="dash-quick-analyzer-btn"
            onClick={() => setActiveSection('conversations')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors"
          >
            <MessageSquareText className="w-4 h-4 text-teal-600" />
            <span>Chat Intel</span>
          </button>

          <button
            id="dash-quick-ai-btn"
            onClick={() => setActiveSection('ai-assistant')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Reply Assistant</span>
          </button>

          <button
            id="dash-quick-order-btn"
            onClick={() => setIsAddOrderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* --- 5 STATISTIC METRIC CARDS --- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Today's Sales */}
        <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Sales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatNaira(todaySales)}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <span>Paid orders received</span>
            </p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {totalOrdersCount}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Total completed & pending</p>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Payments</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
              {pendingPaymentsCount}
            </p>
            <button
              onClick={() => setActiveSection('orders')}
              className="text-[11px] text-amber-700 font-semibold hover:underline mt-1 flex items-center gap-0.5"
            >
              <span>View unpaid orders</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Follow-ups Needed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Follow-ups</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {followUpsCount}
            </p>
            <button
              onClick={() => setActiveSection('follow-ups')}
              className="text-[11px] text-teal-600 font-semibold hover:underline mt-1 flex items-center gap-0.5"
            >
              <span>{followUpsCount} active reminders</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">
              {lowStockCount}
            </p>
            <button
              onClick={() => setActiveSection('products')}
              className="text-[11px] text-rose-700 font-semibold hover:underline mt-1 flex items-center gap-0.5"
            >
              <span>Restock needed</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* --- WHATSAPP SALES INTELLIGENCE HUB --- */}
      <div className="bg-gradient-to-r from-slate-950 via-teal-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-sm border border-teal-900/50 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-400/30">
                <MessageSquareText className="w-3.5 h-3.5 text-teal-400" />
                <span>WhatsApp Conversation → Sales Intelligence</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                {conversations.length} Chats Analyzed
              </span>
              {purchaseReadyCount > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  {purchaseReadyCount} Ready to Buy 🔥
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Turn raw WhatsApp customer chats into completed sales
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Paste customer chats directly from WhatsApp or Instagram. SellPilot automatically extracts customer details, checks catalog stock & prices, detects buying intent, writes a grounded reply, and enables 1-click order creation.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
            <button
              id="dash-launch-chat-intel"
              onClick={() => setActiveSection('conversations')}
              className="px-5 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Paste WhatsApp Chat</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Latest Analyzed Snapshot (if any) */}
        {latestConversation && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-semibold text-teal-300">Latest Chat:</span>
              <span className="font-bold text-white">{latestConversation.customerName || 'Customer'}</span>
              <span>•</span>
              <span className="text-slate-400 line-clamp-1 italic max-w-xs sm:max-w-md">"{latestConversation.rawConversation}"</span>
            </div>

            <button
              onClick={() => {
                setActiveConversation(latestConversation);
                setActiveSection('conversations');
              }}
              className="text-teal-400 hover:text-teal-300 font-semibold hover:underline flex items-center gap-1 shrink-0"
            >
              <span>View Analysis & Reply</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* --- RECENT ORDERS & RECENT CUSTOMERS TWO-COLUMN GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders List (2 Columns on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Orders</h2>
              <p className="text-xs text-slate-500">Latest customer purchases and payment requests</p>
            </div>
            <button
              id="dash-view-all-orders"
              onClick={() => setActiveSection('orders')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>View all orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {recentOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">Your orders will appear here.</p>
                <button
                  onClick={() => setIsAddOrderOpen(true)}
                  className="mt-3 text-xs font-semibold text-teal-600 hover:underline"
                >
                  Create Your First Order
                </button>
              </div>
            ) : (
              recentOrders.map((order) => {
                const firstItem = order.items[0];
                const itemsSummary = order.items.length > 1
                  ? `${firstItem?.productName || 'Item'} + ${order.items.length - 1} more`
                  : firstItem?.productName || 'Product';

                return (
                  <div
                    key={order.id}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {order.id.slice(-3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{order.customerName}</p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                              order.orderStatus
                            )}`}
                          >
                            {order.orderStatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{itemsSummary}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(order.createdDate)}</span>
                          <span>•</span>
                          <span>{order.deliveryAddress ? order.deliveryAddress.split(',')[0] : 'Nigeria'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                        {formatNaira(order.total)}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Customers (1 Column) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Customers</h2>
              <p className="text-xs text-slate-500">Interacting via messaging</p>
            </div>
            <button
              id="dash-view-all-customers"
              onClick={() => setActiveSection('customers')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {recentCustomers.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <p className="text-sm font-medium text-slate-600">Your customers will appear here as you add orders.</p>
              </div>
            ) : (
              recentCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => setViewingCustomer(customer)}
                  className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {customer.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{customer.name}</p>
                      <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{customer.phone}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {customer.status}
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-1">
                      {formatNaira(customer.totalSpent)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick preset message teaser */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span className="truncate">Need to follow up on a customer?</span>
            <button
              onClick={() => setActiveSection('follow-ups')}
              className="text-teal-600 font-bold hover:underline shrink-0 ml-2"
            >
              Open Follow-ups
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
