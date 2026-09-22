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

  useEffect(() => {
    if (isAdmin) {
      api.getAdminSubscriptions()
        .then((data) => {
          setAdminStores(data);
          if (data.length > 0 && !selectedAdminBizId) {
            setSelectedAdminBizId(business?.id || data[0].business_id);
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
                  {adminStores.map((s) => (
                    <option key={s.business_id} value={s.business_id}>
                      {s.business_name} ({s.plan} - {s.status})
                    </option>
                  ))}
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
        </div>
      )}
    </div>
  );
};
