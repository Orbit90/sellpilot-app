import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Clock,
  ShoppingBag,
  Edit2,
  Trash2,
  X,
  FileText,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNaira, formatDate, formatPhoneForWhatsApp } from '../../utils/formatters';
import { Customer, CustomerStatus } from '../../types';

export const CustomersView: React.FC = () => {
  const {
    customers,
    orders,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    viewingCustomer,
    setViewingCustomer,
    isAddCustomerOpen,
    setIsAddCustomerOpen,
    createFollowUp,
    setActiveSection,
    showToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  // New Customer Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    location: 'Lagos, Nigeria',
    status: 'New' as CustomerStatus,
    notes: '',
  });

  const statuses: CustomerStatus[] = [
    'New',
    'Interested',
    'Ordered',
    'Paid',
    'Repeat Customer',
    'VIP',
    'Follow-up Needed',
  ];

  const getStatusBadge = (status: CustomerStatus) => {
    switch (status) {
      case 'VIP':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Repeat Customer':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Paid':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'Follow-up Needed':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Ordered':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Interested':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'New':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.location && c.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, statusFilter]);

  // Order history for viewing customer
  const customerOrders = useMemo(() => {
    if (!viewingCustomer) return [];
    return orders.filter(
      (o) =>
        o.customerId === viewingCustomer.id ||
        o.customerPhone === viewingCustomer.phone ||
        o.customerName.toLowerCase() === viewingCustomer.name.toLowerCase()
    );
  }, [viewingCustomer, orders]);

  const handleOpenAddCustomer = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      location: 'Lagos, Nigeria',
      status: 'New',
      notes: '',
    });
    setIsAddCustomerOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;

    await createCustomer({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      location: formData.location.trim() || 'Nigeria',
      status: formData.status,
      notes: formData.notes.trim(),
    });

    setIsAddCustomerOpen(false);
  };

  const handleUpdateNotes = async () => {
    if (!viewingCustomer) return;
    await updateCustomer(viewingCustomer.id, { notes: editedNotes });
    setIsEditingNotes(false);
  };

  const handleQuickFollowUp = async (customer: Customer) => {
    await createFollowUp({
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      reason: `Check in regarding recent inquiry (${customer.status})`,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    setActiveSection('follow-ups');
  };

  return (
    <div id="customers-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track customer relationship stages, purchase history, and WhatsApp contacts.
          </p>
        </div>

        <button
          id="add-customer-btn"
          onClick={handleOpenAddCustomer}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customers by name, phone (+234...), or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Customers ({customers.length})
          </button>
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                statusFilter === st
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Your customers will appear here as you add orders.</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Keep track of customer names, WhatsApp phone numbers, and previous delivery locations to personalize conversations.
          </p>
          <button
            onClick={handleOpenAddCustomer}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-sm transition-colors"
          >
            Add First Customer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => {
            const waNumber = formatPhoneForWhatsApp(customer.phone);

            return (
              <div
                key={customer.id}
                id={`customer-card-${customer.id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-teal-800 font-black text-sm flex items-center justify-center shrink-0 border border-teal-200">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 leading-snug">
                          {customer.name}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{customer.location || 'Nigeria'}</span>
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                        customer.status
                      )}`}
                    >
                      {customer.status}
                    </span>
                  </div>

                  {/* Phone & Email */}
                  <div className="mt-4 space-y-1 text-xs text-slate-600">
                    <p className="flex items-center gap-2 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{customer.phone}</span>
                    </p>
                    {customer.email && (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </p>
                    )}
                  </div>

                  {/* Orders count & Total Spent */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Orders</p>
                      <p className="text-base font-extrabold text-slate-900 mt-0.5">
                        {customer.ordersCount || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Spent</p>
                      <p className="text-base font-extrabold text-teal-700 mt-0.5">
                        {formatNaira(customer.totalSpent || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Notes snippet */}
                  {customer.notes && (
                    <p className="mt-3 text-xs text-slate-500 line-clamp-2 italic bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                      "{customer.notes}"
                    </p>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setViewingCustomer(customer);
                      setEditedNotes(customer.notes || '');
                      setIsEditingNotes(false);
                    }}
                    className="text-xs font-semibold text-slate-700 hover:text-teal-600 flex items-center gap-1"
                  >
                    <span>View Profile</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Direct WhatsApp Button */}
                    <a
                      href={`https://wa.me/${waNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                      title="Open WhatsApp chat"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      onClick={() => handleQuickFollowUp(customer)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                      title="Create Follow-up Reminder"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- CUSTOMER PROFILE DRAWER / MODAL --- */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center sm:justify-end p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-lg">
                  {viewingCustomer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-lg">{viewingCustomer.name}</h3>
                  <p className="text-xs text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{viewingCustomer.location || 'Nigeria'}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingCustomer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Quick WhatsApp Action banner */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-900">WhatsApp Messaging</p>
                  <p className="text-xs text-emerald-700 font-mono mt-0.5">{viewingCustomer.phone}</p>
                </div>
                <a
                  href={`https://wa.me/${formatPhoneForWhatsApp(viewingCustomer.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Start Chat</span>
                </a>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Customer Status
                </label>
                <select
                  value={viewingCustomer.status}
                  onChange={async (e) => {
                    const newStatus = e.target.value as CustomerStatus;
                    await updateCustomer(viewingCustomer.id, { status: newStatus });
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  {statuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes Section with Inline Editing */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Customer Notes</span>
                  </span>
                  {!isEditingNotes ? (
                    <button
                      onClick={() => {
                        setEditedNotes(viewingCustomer.notes || '');
                        setIsEditingNotes(true);
                      }}
                      className="text-xs font-semibold text-teal-600 hover:underline"
                    >
                      Edit Notes
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingNotes(false)}
                        className="text-xs text-slate-400 hover:underline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateNotes}
                        className="text-xs font-bold text-teal-600 hover:underline"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {isEditingNotes ? (
                  <textarea
                    rows={3}
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    placeholder="e.g. Likes pastel shoes size 40, prefers pickup at Ikeja Mall..."
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {viewingCustomer.notes || 'No customer notes added yet.'}
                  </p>
                )}
              </div>

              {/* Order History */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Order History ({customerOrders.length})</span>
                  <span className="text-teal-700 font-bold">
                    Total: {formatNaira(viewingCustomer.totalSpent || 0)}
                  </span>
                </h4>

                {customerOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center border border-dashed rounded-xl">
                    No orders recorded for this customer yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customerOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{ord.id}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100">
                              {ord.orderStatus}
                            </span>
                          </div>
                          <p className="text-slate-500 mt-0.5">
                            {formatDate(ord.createdDate)} • {ord.items.length} item(s)
                          </p>
                        </div>
                        <span className="font-black text-slate-900">
                          {formatNaira(ord.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Interaction Log */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Recent Interactions
                </h4>
                {viewingCustomer.interactions && viewingCustomer.interactions.length > 0 ? (
                  <div className="space-y-2">
                    {viewingCustomer.interactions.map((int) => (
                      <div
                        key={int.id}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
                          <span className="font-semibold text-slate-700 capitalize">{int.type} ({int.channel})</span>
                          <span>{formatDate(int.timestamp)}</span>
                        </div>
                        <p className="text-slate-600">{int.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2 text-center">
                    No recent interaction logs.
                  </p>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={async () => {
                  if (window.confirm(`Delete customer "${viewingCustomer.name}"?`)) {
                    await deleteCustomer(viewingCustomer.id);
                  }
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Customer</span>
              </button>

              <button
                onClick={() => handleQuickFollowUp(viewingCustomer)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Set Follow-up</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD CUSTOMER MODAL --- */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Add New Customer</h3>
                <p className="text-xs text-slate-500">Record a buyer from WhatsApp or Instagram.</p>
              </div>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amaka Obi"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone Number (WhatsApp) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+234 803 123 4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Location (City / State)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lekki Phase 1, Lagos"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as CustomerStatus })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Preferences
                </label>
                <textarea
                  rows={2}
                  placeholder="Preferences, preferred delivery time, sizing..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors"
                >
                  Add Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
