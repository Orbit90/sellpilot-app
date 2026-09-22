import React, { useState, useMemo } from 'react';
import {
  Clock,
  Plus,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  MessageCircle,
  Calendar,
  Phone,
  User,
  AlertCircle,
  Trash2,
  X,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { formatDate, formatPhoneForWhatsApp } from '../../utils/formatters';
import { FollowUp, FollowUpStatus, ResponseTone } from '../../types';

export const FollowUpsView: React.FC = () => {
  const {
    followUps,
    customers,
    business,
    createFollowUp,
    updateFollowUp,
    deleteFollowUp,
    showToast,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [generatingForId, setGeneratingForId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Follow-up form
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reason, setReason] = useState('Asked for price but didn\'t buy');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [customReason, setCustomReason] = useState('');

  const commonReasons = [
    'Asked for price but didn\'t buy',
    'Promised payment / awaiting transfer',
    'Abandoned cart / unanswered message',
    'Delivery confirmation & review',
    'Past buyer re-engagement / new arrivals',
    'Size or color verification follow-up',
  ];

  const getStatusBadge = (status: FollowUpStatus) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Contacted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Cancelled':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Pending':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((f) => {
      if (statusFilter === 'all') return true;
      return f.status === statusFilter;
    });
  }, [followUps, statusFilter]);

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    const cust = customers.find((c) => c.id === id);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      showToast('Please provide a customer name', 'error');
      return;
    }

    const finalReason = reason === 'custom' ? customReason : reason;

    // Generate initial suggested message
    let suggestedMsg = '';
    try {
      const res = await api.generateFollowUp({
        customerName: customerName.trim(),
        customerId: selectedCustomerId || undefined,
        reason: finalReason,
        tone: 'friendly',
      });
      suggestedMsg = res.message;
    } catch {
      suggestedMsg = `Hi ${customerName} 👋 Hope you're having a wonderful day! Just following up from ${business?.name || 'our store'} regarding your recent inquiry. Let us know if you'd like us to reserve your items!`;
    }

    await createFollowUp({
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      reason: finalReason,
      suggestedMessage: suggestedMsg,
      dueDate: new Date(dueDate).toISOString(),
    });

    setIsCreateOpen(false);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId('');
  };

  const handleRegenerateMessage = async (followUp: FollowUp, tone: ResponseTone = 'friendly') => {
    try {
      setGeneratingForId(followUp.id);
      const res = await api.generateFollowUp({
        customerId: followUp.customerId,
        customerName: followUp.customerName,
        reason: followUp.reason,
        tone,
      });

      await updateFollowUp(followUp.id, { suggestedMessage: res.message });
      showToast('New suggested follow-up generated!');
    } catch {
      showToast('Failed to regenerate message', 'error');
    } finally {
      setGeneratingForId(null);
    }
  };

  const handleCopyMessage = (id: string, message: string) => {
    navigator.clipboard.writeText(message);
    setCopiedId(id);
    showToast('Message copied! Ready to paste into WhatsApp');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div id="follow-ups-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Sales Follow-ups</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Never lose a lead. Remind potential buyers about their inquiries and pending transfers.
          </p>
        </div>

        <button
          id="add-follow-up-top-btn"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Follow-up Reminder</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto">
        {(['Pending', 'Contacted', 'Completed', 'Cancelled', 'all'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors ${
              statusFilter === st
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {st === 'all' ? 'All Follow-ups' : st}
          </button>
        ))}
      </div>

      {/* Follow-up Cards */}
      {filteredFollowUps.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No follow-ups found in this view.</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Set reminders for customers who inquired about prices, asked for account details, or left uncompleted chats.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-sm transition-colors"
          >
            Create Follow-up Reminder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFollowUps.map((fu) => {
            const waNumber = formatPhoneForWhatsApp(fu.customerPhone);
            const isGenerating = generatingForId === fu.id;
            const isCopied = copiedId === fu.id;

            return (
              <div
                key={fu.id}
                id={`follow-up-card-${fu.id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Customer & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-slate-900">{fu.customerName}</h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                            fu.status
                          )}`}
                        >
                          {fu.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{fu.customerPhone || 'No phone recorded'}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                        Due Date
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {formatDate(fu.dueDate)}
                      </span>
                    </div>
                  </div>

                  {/* Reason Pill */}
                  <div className="mt-3">
                    <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                      Reason: {fu.reason}
                    </span>
                  </div>

                  {/* Suggested AI Message */}
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-teal-600" />
                        <span>AI Suggested WhatsApp Message</span>
                      </span>
                      <button
                        onClick={() => handleRegenerateMessage(fu, 'friendly')}
                        disabled={isGenerating}
                        className="text-[10px] font-semibold text-teal-600 hover:underline flex items-center gap-1"
                        title="Regenerate message"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                        <span>Regenerate</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-200">
                      "{fu.suggestedMessage || 'Click regenerate to create custom AI message.'}"
                    </p>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Mark as Contacted / Completed */}
                    {fu.status === 'Pending' && (
                      <button
                        onClick={() => updateFollowUp(fu.id, { status: 'Contacted' })}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      >
                        Mark Contacted
                      </button>
                    )}
                    {fu.status !== 'Completed' && (
                      <button
                        onClick={() => updateFollowUp(fu.id, { status: 'Completed' })}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => deleteFollowUp(fu.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopyMessage(fu.id, fu.suggestedMessage)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {/* WhatsApp Send */}
                    <a
                      href={`https://wa.me/${waNumber}?text=${encodeURIComponent(fu.suggestedMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- CREATE FOLLOW-UP MODAL --- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Create Follow-up Reminder</h3>
                <p className="text-xs text-slate-500">SellPilot will draft a personalized message.</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Customer (Optional)
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">-- Or enter name & phone below --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

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
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
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
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Follow-up Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  {commonReasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
