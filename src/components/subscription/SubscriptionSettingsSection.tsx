import React, { useState, useEffect } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { SubscriptionMetric, SubscriptionPlanId } from '../../types';
import {
  CreditCard,
  Sparkles,
  Check,
  Shield,
  Zap,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Sliders,
  Users,
  Package,
  ShoppingBag,
  MessageSquare,
  Bot,
  Search,
  ExternalLink,
} from 'lucide-react';

export const SubscriptionSettingsSection: React.FC = () => {
  const {
    subscription,
    plans,
    openUpgradeModal,
    refreshSubscription,
    isAdmin,
    isTrialActive,
    isTrialExpired,
    trialDaysLeft,
    getUsagePercent,
  } = useSubscription();

  const { showToast, business } = useApp();

  // Admin testing states
  const [adminStores, setAdminStores] = useState<any[]>([]);
  const [selectedAdminBizId, setSelectedAdminBizId] = useState<string>('');
  const [adminTargetPlan, setAdminTargetPlan] = useState<SubscriptionPlanId>('PRO');
  const [adminExtendDays, setAdminExtendDays] = useState<number>(30);
  const [adminTestMetric, setAdminTestMetric] = useState<SubscriptionMetric>('ai_analysis');
  const [adminTestCount, setAdminTestCount] = useState<number>(50);
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);
  const [subscriberSearch, setSubscriberSearch] = useState<string>('');

  useEffect(() => {
    if (isAdmin) {
      api.getAdminSubscriptions()
        .then((data) => {
          setAdminStores(data);
          if (data.length > 0 && !selectedAdminBizId) {
            const firstBizId = data[0].businessId || data[0].business_id;
            setSelectedAdminBizId(business?.id || firstBizId);
          }
        })
        .catch(() => {});
    }
  }, [isAdmin, business?.id, selectedAdminBizId]);

  if (!subscription) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-20 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const { planConfig, usage, limits } = subscription;

  const usageItems: Array<{
    metric: SubscriptionMetric;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    used: number;
    limit: number;
  }> = [
    {
      metric: 'ai_analysis',
      label: 'WhatsApp AI Analyses',
      icon: Bot,
      used: usage.ai_analysis,
      limit: limits.ai_analysis,
    },
    {
      metric: 'order',
      label: 'Orders Processed',
      icon: ShoppingBag,
      used: usage.order,
      limit: limits.order,
    },
    {
      metric: 'product',
      label: 'Catalog Products',
      icon: Package,
      used: usage.product,
      limit: limits.product,
    },
    {
      metric: 'customer',
      label: 'Customer Contacts',
      icon: Users,
      used: usage.customer,
      limit: limits.customer,
    },
    {
      metric: 'follow_up',
      label: 'Scheduled Follow-ups',
      icon: MessageSquare,
      used: usage.follow_up,
      limit: limits.follow_up,
    },
  ];

  const handleAdminUpdatePlan = async () => {
    if (!selectedAdminBizId) return;
    setIsAdminActionLoading(true);
    try {
      await api.updateAdminSubscription(selectedAdminBizId, {
        plan: adminTargetPlan,
        status: 'active',
        extendDays: adminExtendDays,
      });
      await refreshSubscription();
      showToast(`Store subscription updated to ${adminTargetPlan}`, 'success');
      const updated = await api.getAdminSubscriptions();
      setAdminStores(updated);
    } catch (err: any) {
      showToast(err.message || 'Admin update failed', 'error');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const handleAdminSetUsage = async () => {
    if (!selectedAdminBizId) return;
    setIsAdminActionLoading(true);
    try {
      await api.setAdminUsage(selectedAdminBizId, adminTestMetric, adminTestCount);
      await refreshSubscription();
      showToast(`Usage for ${adminTestMetric} set to ${adminTestCount}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Usage update failed', 'error');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-base text-slate-900">
              Subscription & Plan
            </h2>
            <p className="text-xs text-slate-500">
              Manage your tier limits, Nigerian billing, and feature quotas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openUpgradeModal('PRO')}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-200" />
          <span>Change Plan</span>
        </button>
      </div>

      {/* Plan Summary Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
              Current Membership
            </span>
            {isTrialActive && (
              <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold border border-teal-500/30">
                Trial Active ({trialDaysLeft}d left)
              </span>
            )}
            {isTrialExpired && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                Trial Expired
              </span>
            )}
            {isAdmin && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                Admin (Unlimited)
              </span>
            )}
            {!isTrialActive && !isTrialExpired && !isAdmin && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                Active
              </span>
            )}
          </div>

          <h3 className="text-2xl font-black text-white">
            {planConfig.name}
          </h3>
          <p className="text-xs text-slate-300 max-w-md">
            {planConfig.tagline || planConfig.description}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-700">
          <div className="text-left md:text-right">
            <div className="text-xs text-slate-400 font-medium">Billing Rate</div>
            <div className="text-xl font-black text-white">
              {(planConfig?.priceNaira ?? 0) === 0 ? '₦0' : `₦${(planConfig?.priceNaira ?? 0).toLocaleString()}`}
              <span className="text-xs text-slate-400 font-normal ml-1">/ month</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openUpgradeModal('PRO')}
            className="w-full sm:w-auto px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Upgrade to Pro</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Usage Quota Meters */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Current Cycle Resource Usage
          </h4>
          <span className="text-[11px] text-slate-500">
            Resets each 30-day period
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {usageItems.map((item) => {
            const Icon = item.icon;
            const isUnlimited = item.limit === Infinity || item.limit === -1;
            const pct = isUnlimited ? 0 : getUsagePercent(item.metric);
            const isNearLimit = pct >= 80 && !isUnlimited;
            const isAtLimit = pct >= 100 && !isUnlimited;

            return (
              <div
                key={item.metric}
                id={`usage-meter-${item.metric}`}
                className={`p-3.5 rounded-xl border transition-all ${
                  isAtLimit
                    ? 'border-rose-300 bg-rose-50/40'
                    : isNearLimit
                    ? 'border-amber-300 bg-amber-50/40'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      {item.label}
                    </span>
                  </div>

                  {isAtLimit && (
                    <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                      Limit Reached
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="font-extrabold text-slate-900 text-sm">
                    {item.used}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    of {isUnlimited ? 'Unlimited' : item.limit}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isAtLimit
                        ? 'bg-rose-500'
                        : isNearLimit
                        ? 'bg-amber-500'
                        : 'bg-teal-600'
                    }`}
                    style={{ width: isUnlimited ? '15%' : `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan Matrix Comparison */}
      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Available Subscription Tiers
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-600 border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Plan</th>
                <th className="p-3">Price / mo</th>
                <th className="p-3">WhatsApp AI</th>
                <th className="p-3">Orders</th>
                <th className="p-3">Products</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.map((p) => {
                const isCurrent = p.id === planConfig.id;
                return (
                  <tr
                    key={p.id}
                    className={isCurrent ? 'bg-teal-50/50 font-medium' : 'hover:bg-slate-50/50'}
                  >
                    <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] text-teal-700 bg-teal-100 font-bold px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {(p?.priceNaira ?? 0) === 0 ? 'Free (7d)' : `₦${(p?.priceNaira ?? 0).toLocaleString()}`}
                    </td>
                    <td className="p-3">{p.limits.ai_analysis} / mo</td>
                    <td className="p-3">{p.limits.order === Infinity ? 'Unlimited' : p.limits.order}</td>
                    <td className="p-3">{p.limits.product === Infinity ? 'Unlimited' : p.limits.product}</td>
                    <td className="p-3">
                      {isCurrent ? (
                        <span className="text-slate-400 text-[11px] font-semibold">Active</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openUpgradeModal(p.id)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition-colors"
                        >
                          Select
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Control Center (Only visible to admin accounts) */}
      {isAdmin && (
        <div
          id="admin-subscription-controls"
          className="mt-6 p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Admin Subscription Control & Simulation
              </h3>
              <p className="text-xs text-slate-400">
                Verify quota enforcement and plan transitions across tenant accounts
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Store & Plan update */}
            <div className="space-y-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">
                Manage Tenant Subscription
              </span>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Select Store</label>
                <select
                  value={selectedAdminBizId}
                  onChange={(e) => setSelectedAdminBizId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {adminStores.map((s) => {
                    const bId = s.businessId || s.business_id;
                    const bName = s.businessName || s.business_name || 'Unnamed Business';
                    return (
                      <option key={bId} value={bId}>
                        {bName} ({s.plan} - {s.status})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Target Plan</label>
                  <select
                    value={adminTargetPlan}
                    onChange={(e) => setAdminTargetPlan(e.target.value as SubscriptionPlanId)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="FREE_TRIAL">FREE_TRIAL</option>
                    <option value="STARTER">STARTER</option>
                    <option value="PRO">PRO</option>
                    <option value="BUSINESS">BUSINESS</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Duration</label>
                  <select
                    value={adminExtendDays}
                    onChange={(e) => setAdminExtendDays(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value={7}>7 Days (Trial)</option>
                    <option value={30}>30 Days</option>
                    <option value={365}>1 Year</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAdminUpdatePlan}
                disabled={isAdminActionLoading}
                className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                Apply Subscription State
              </button>
            </div>

            {/* Quota Simulation */}
            <div className="space-y-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Simulate Quota Limit Enforcement
              </span>

              <p className="text-[11px] text-slate-400">
                Artificially set usage count to test 402 HTTP enforcement on resource routes.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Metric</label>
                  <select
                    value={adminTestMetric}
                    onChange={(e) => setAdminTestMetric(e.target.value as SubscriptionMetric)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="ai_analysis">AI Analysis</option>
                    <option value="order">Orders</option>
                    <option value="product">Products</option>
                    <option value="customer">Customers</option>
                    <option value="follow_up">Follow-ups</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Usage Count</label>
                  <input
                    type="number"
                    value={adminTestCount}
                    onChange={(e) => setAdminTestCount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAdminSetUsage}
                disabled={isAdminActionLoading}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                Set Quota Count
              </button>
            </div>
          </div>

          {/* Full Tenant Subscriber Directory */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Subscribers & Tenant Stores ({adminStores.length})</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Real-time list of all stores, owner details, plan tier, and renewal status.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search store, owner or email..."
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-96">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-800 text-slate-300 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10">
                  <tr>
                    <th className="p-3">Store & Category</th>
                    <th className="p-3">Merchant / Owner</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Expires / Renews</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
                  {adminStores
                    .filter((s) => {
                      if (!subscriberSearch.trim()) return true;
                      const q = subscriberSearch.toLowerCase();
                      const bName = (s.businessName || s.business_name || '').toLowerCase();
                      const oName = (s.ownerName || s.owner_name || '').toLowerCase();
                      const email = (s.ownerEmail || s.owner_email || '').toLowerCase();
                      const plan = (s.plan || '').toLowerCase();
                      return bName.includes(q) || oName.includes(q) || email.includes(q) || plan.includes(q);
                    })
                    .map((s) => {
                      const bId = s.businessId || s.business_id;
                      const bName = s.businessName || s.business_name || 'Store';
                      const bCat = s.businessCategory || s.business_category || 'General';
                      const oName = s.ownerName || s.owner_name || 'N/A';
                      const email = s.ownerEmail || s.owner_email || 'N/A';
                      const isSelected = selectedAdminBizId === bId;

                      const planBadgeColor: Record<string, string> = {
                        BUSINESS: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
                        PRO: 'bg-teal-950/80 text-teal-300 border-teal-800/60',
                        STARTER: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
                        FREE_TRIAL: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
                      };

                      const statusBadgeColor: Record<string, string> = {
                        active: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/50',
                        trialing: 'bg-amber-950/70 text-amber-400 border-amber-800/50',
                        expired: 'bg-red-950/70 text-red-400 border-red-800/50',
                        cancelled: 'bg-slate-800 text-slate-400 border-slate-700',
                      };

                      const expiryDate = s.trialEndsAt || s.trial_ends_at || s.currentPeriodEnd || s.current_period_end;
                      const formattedDate = expiryDate ? new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';

                      return (
                        <tr
                          key={bId}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-teal-950/30' : ''
                          }`}
                        >
                          <td className="p-3">
                            <div className="font-semibold text-white">{bName}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{bCat}</div>
                          </td>
                          <td className="p-3">
                            <div className="text-white">{oName}</div>
                            <div className="text-[10px] text-slate-400">{email}</div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                planBadgeColor[s.plan] || 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {s.plan}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                statusBadgeColor[s.status] || 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-slate-300">
                            {formattedDate}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAdminBizId(bId);
                                const ctrl = document.getElementById('admin-subscription-controls');
                                ctrl?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                                isSelected
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Manage'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
