import React from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import {
  Clock,
  Zap,
  AlertTriangle,
  Lock,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const TrialBanner: React.FC = () => {
  const {
    subscription,
    isAdmin,
    isTrialActive,
    isTrialExpired,
    trialDaysLeft,
    openUpgradeModal,
    getUsagePercent,
  } = useSubscription();

  if (!subscription) return null;

  // 1. Admin account display
  if (isAdmin) {
    return (
      <div
        id="admin-subscription-banner"
        className="mb-4 bg-slate-900 text-slate-200 px-4 py-2.5 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-white font-bold">Admin Account:</strong> You have unlimited access across all SellPilot AI features, products, orders, and follow-ups.
          </span>
        </div>
        <button
          onClick={() => openUpgradeModal('PRO')}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
        >
          View Plans
        </button>
      </div>
    );
  }

  // 2. Trial expired state - clear and focused action
  if (isTrialExpired) {
    return (
      <div
        id="trial-expired-banner"
        className="mb-6 bg-gradient-to-r from-rose-50 via-rose-100/70 to-amber-50 border border-rose-300 rounded-xl p-4 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-200/80 text-rose-800 shrink-0 mt-0.5 sm:mt-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-950">
                Your 7-Day Free Trial Has Concluded
              </h4>
              <p className="text-xs text-rose-800 mt-0.5 max-w-2xl leading-relaxed">
                To continue analyzing WhatsApp conversations, creating orders, and syncing inventory, choose a subscription tier. Your existing customer data and order history remain completely safe.
              </p>
            </div>
          </div>

          <button
            id="expired-upgrade-btn"
            onClick={() => openUpgradeModal('PRO')}
            className="w-full sm:w-auto shrink-0 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Choose a Plan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Quota limit warning (>= 80% used on any metric)
  const aiUsagePct = getUsagePercent('ai_analysis');
  const orderUsagePct = getUsagePercent('order');
  const productUsagePct = getUsagePercent('product');

  const highMetric =
    aiUsagePct >= 80
      ? { name: 'AI WhatsApp Analyses', pct: aiUsagePct, count: subscription.usage.ai_analysis, limit: subscription.limits.ai_analysis }
      : orderUsagePct >= 80
      ? { name: 'Orders', pct: orderUsagePct, count: subscription.usage.order, limit: subscription.limits.order }
      : productUsagePct >= 80
      ? { name: 'Products', pct: productUsagePct, count: subscription.usage.product, limit: subscription.limits.product }
      : null;

  if (highMetric) {
    return (
      <div
        id="usage-limit-warning-banner"
        className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-amber-900 font-medium">
            <strong>{highMetric.pct}% Quota Reached:</strong> You have used {highMetric.count} of {highMetric.limit} {highMetric.name} this cycle. Upgrade for higher limits.
          </span>
        </div>
        <button
          onClick={() => openUpgradeModal('PRO')}
          className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition-colors"
        >
          Upgrade Quota
        </button>
      </div>
    );
  }

  // 4. Active Free Trial Banner (respectful, informative, encourages value discovery)
  if (isTrialActive) {
    return (
      <div
        id="trial-active-banner"
        className="mb-4 bg-teal-50/80 border border-teal-200/80 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-teal-100 text-teal-800 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-teal-950">
              SellPilot Free Trial: {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} remaining.
            </span>{' '}
            <span className="text-teal-800 hidden md:inline">
              Enjoy complete WhatsApp conversation intelligence, order creation, and product syncing.
            </span>
          </div>
        </div>

        <button
          id="trial-upgrade-cta-btn"
          onClick={() => openUpgradeModal('PRO')}
          className="shrink-0 px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-300" />
          <span>View Plans</span>
        </button>
      </div>
    );
  }

  return null;
};
