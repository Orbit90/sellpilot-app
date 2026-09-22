import React, { useState, useEffect } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useApp } from '../../context/AppContext';
import { SubscriptionPlanId } from '../../types';
import { api } from '../../services/api';
import {
  Check,
  Zap,
  Sparkles,
  Shield,
  CreditCard,
  AlertCircle,
  X,
  Lock,
  ArrowRight,
  Clock,
  Loader2,
} from 'lucide-react';

export const UpgradeModal: React.FC = () => {
  const {
    isUpgradeModalOpen,
    closeUpgradeModal,
    selectedUpgradePlan,
    plans,
    subscription,
    refreshSubscription,
    isAdmin,
  } = useSubscription();

  const { business, showToast } = useApp();
  const [activePlanId, setActivePlanId] = useState<SubscriptionPlanId>(
    selectedUpgradePlan || 'PRO'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<{
    reference: string;
    amountNaira: number;
    planName: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (selectedUpgradePlan) {
      setActivePlanId(selectedUpgradePlan);
    }
  }, [selectedUpgradePlan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUpgradeModalOpen) {
        closeUpgradeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUpgradeModalOpen, closeUpgradeModal]);

  if (!isUpgradeModalOpen) return null;

  const currentPlanId = subscription?.planConfig?.id || 'FREE_TRIAL';
  const paidPlans = plans.filter((p) => p && p.id !== 'FREE_TRIAL');
  const activePlan =
    plans.find((p) => p && p.id === activePlanId) ||
    paidPlans.find((p) => p && p.id === activePlanId) ||
    paidPlans[0];

  const handleSelectPlan = (planId: SubscriptionPlanId) => {
    setActivePlanId(planId);
    setCheckoutResult(null);
  };

  const handleInitiateUpgrade = async (overridePlanId?: SubscriptionPlanId) => {
    const targetPlan = (overridePlanId || activePlanId) as 'STARTER' | 'PRO' | 'BUSINESS';

    if (targetPlan === currentPlanId && subscription?.isActive) {
      showToast('You are already on this plan', 'info');
      return;
    }

    // Prevent accidental double-clicks from creating multiple payment attempts
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      // 1. Only send the plan identifier (STARTER | PRO | BUSINESS). Never send the price.
      // 2. Uses the authenticated user's existing session token via api.initializePaystackPayment.
      const res = await api.initializePaystackPayment(targetPlan);

      if (res && res.status && res.data?.authorization_url) {
        showToast('Redirecting to Paystack secure checkout...', 'info');
        // Redirect to Paystack's returned authorization_url
        window.location.href = res.data.authorization_url;
      } else {
        throw new Error(res?.message || 'Unable to open Paystack payment gateway.');
      }
    } catch (err: any) {
      // Clear user-friendly error without exposing server secrets or technical details
      const friendlyMessage =
        err?.message && !err.message.includes('SECRET_KEY') && !err.message.includes('stack')
          ? err.message
          : 'Payment initialization could not be completed. Please try again later.';
      showToast(friendlyMessage, 'error');
      setIsProcessing(false);
    }
  };

  // For developer/tester convenience: simulate activating plan via admin API if user is admin or for demo testing
  const handleSimulateActivation = async () => {
    if (!business?.id) return;
    setIsProcessing(true);
    try {
      await api.updateAdminSubscription(business.id, {
        plan: activePlanId,
        status: 'active',
        extendDays: 30,
      });
      await refreshSubscription();
      showToast(`Subscription updated to ${activePlanId} plan (Active for 30 days)!`, 'success');
      setCheckoutResult(null);
      closeUpgradeModal();
    } catch (err: any) {
      showToast(err.message || 'Could not simulate plan activation', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="upgrade-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeUpgradeModal();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6"
    >
      <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-6">
        <div
          id="upgrade-modal-content"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto"
        >
          {/* Fixed Sticky Header */}
          <div className="sticky top-0 z-20 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-4 sm:p-5 flex-shrink-0 border-b border-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Commercial Subscription</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Supercharge Your WhatsApp Commerce
                </h2>
                <p className="mt-0.5 text-slate-300 text-xs sm:text-sm max-w-xl">
                  Choose a merchant tier designed for high-converting social sales across Nigeria.
                </p>

                {/* Current Status Pill */}
                <div className="mt-2.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  <span>
                    Current Plan:{' '}
                    <strong className="text-white font-bold">
                      {subscription?.planConfig.name || '7-Day Free Trial'}
                    </strong>
                  </span>
                  {subscription?.isTrial && (
                    <span className="text-teal-300 font-medium">
                      ({subscription.trialDaysLeft} days remaining)
                    </span>
                  )}
                  {subscription?.isExpired && (
                    <span className="text-rose-400 font-bold">(Trial Expired)</span>
                  )}
                </div>
              </div>

              <button
                id="close-upgrade-modal-btn"
                onClick={closeUpgradeModal}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors shrink-0"
                title="Close dialog (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 overscroll-contain">
            {checkoutResult ? (
              /* Checkout Intermediary / Integration Pending Notice */
              <div
                id="checkout-pending-view"
                className="bg-amber-50/80 border border-amber-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Payment Gateway Integration
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {checkoutResult.message}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-amber-200/80 text-xs text-slate-700 space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Selected Plan:</span>
                    <span className="font-bold font-sans text-slate-900">
                      {checkoutResult.planName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Price:</span>
                    <span className="font-bold text-emerald-700 font-sans">
                      ₦{(checkoutResult.amountNaira ?? 0).toLocaleString()} / month
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Payment Reference:</span>
                    <span className="text-slate-800">{checkoutResult.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Gateways:</span>
                    <span className="text-slate-800">Paystack / Flutterwave (Pre-configured)</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 leading-relaxed">
                  <strong>Architecture Verification:</strong> The commercial subscription access control and quota enforcement engine is active and operational. When real API keys are mounted, users will be directed to Paystack/Flutterwave seamlessly.
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    id="simulate-plan-activation-btn"
                    onClick={handleSimulateActivation}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Activate {checkoutResult.planName} (Test Mode)</span>
                  </button>
                  <button
                    onClick={() => setCheckoutResult(null)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Change Selection
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile Quick Selector Tabs */}
                <div className="flex md:hidden items-center justify-between p-1 bg-slate-100 rounded-xl gap-1">
                  {paidPlans.map((plan) => {
                    const isSelected = activePlanId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                          isSelected
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>{plan.name.replace(' Plan', '')}</span>
                        {plan.id === 'PRO' && <span className="ml-1 text-amber-300">★</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Plan Cards Grid - Fully scrollable, starts cleanly at Starter */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                  {paidPlans.map((plan) => {
                    const isSelected = activePlanId === plan.id;
                    const isCurrent = currentPlanId === plan.id;
                    const isPopular = plan.id === 'PRO';

                    return (
                      <div
                        key={plan.id}
                        id={`plan-card-${plan.id.toLowerCase()}`}
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`relative rounded-xl p-5 cursor-pointer border-2 transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-teal-600 bg-teal-50/30 shadow-md shadow-teal-900/5 ring-1 ring-teal-500'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        {isPopular && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-[11px] font-bold rounded-full shadow-sm">
                            Most Popular
                          </span>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="font-bold text-slate-900 text-base">
                              {plan.name}
                            </h3>
                            {isCurrent && (
                              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                Current
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 mb-3 min-h-[2.25rem]">
                            {plan.tagline || plan.description}
                          </p>

                          <div className="mb-4">
                            <span className="text-2xl font-black text-slate-900">
                              ₦{(plan.priceNaira ?? 0).toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 font-medium ml-1">
                              / month
                            </span>
                          </div>

                          <div className="space-y-2 pt-3 border-t border-slate-100">
                            {plan.features.map((feat, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                                <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={isCurrent && subscription?.isActive}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSelected) {
                                handleInitiateUpgrade(plan.id);
                              } else {
                                handleSelectPlan(plan.id);
                              }
                            }}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                              isCurrent && subscription?.isActive
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : isSelected
                                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isCurrent && subscription?.isActive
                              ? 'Active Plan'
                              : isSelected
                              ? 'Subscribe with Paystack'
                              : 'Select Plan'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Sticky Action Footer */}
          {!checkoutResult && (
            <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-sm p-4 sm:p-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Secure payment via Paystack Test Gateway. Cancel or switch anytime.</span>
              </div>

              <button
                id="proceed-upgrade-btn"
                onClick={() => handleInitiateUpgrade()}
                disabled={isProcessing || (activePlanId === currentPlanId && subscription?.isActive)}
                className="w-full sm:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-teal-900/10 flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Connecting to Paystack...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {activePlan
                        ? `Subscribe to ${activePlan.name} (₦${(activePlan.priceNaira ?? 0).toLocaleString()}/mo)`
                        : 'Subscribe with Paystack'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
