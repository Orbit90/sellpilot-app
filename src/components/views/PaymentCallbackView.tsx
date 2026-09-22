import React, { useEffect, useState } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { PLAN_CONFIGS, SubscriptionPlanId } from '../../config/plans';

export interface PaymentCallbackViewProps {
  onDismiss?: (targetSection?: 'dashboard' | 'settings') => void;
}

export const PaymentCallbackView: React.FC<PaymentCallbackViewProps> = ({ onDismiss }) => {
  const { refreshSubscription, openUpgradeModal } = useSubscription();
  const { setActiveSection } = useApp();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<{
    reference: string;
    plan: string;
    amountNaira?: number;
    subscription?: any;
    verifiedAt?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function verify() {
      const urlParams = new URLSearchParams(window.location.search);
      const reference = urlParams.get('reference') || urlParams.get('trxref');

      if (!reference) {
        if (isMounted) {
          setLoading(false);
          setSuccess(false);
          setError('No payment reference found in the callback URL.');
        }
        return;
      }

      try {
        const res = await api.verifyPaystackPayment(reference);

        if (!isMounted) return;

        if (res && res.status && res.data) {
          const payment = res.data.payment;
          const sub = res.data.subscription;
          const planKey = (payment?.plan || sub?.plan || 'PRO') as SubscriptionPlanId;
          const planConfig = PLAN_CONFIGS[planKey];

          setSuccess(true);
          setPaymentData({
            reference: payment?.reference || reference,
            plan: planConfig?.name || planKey,
            amountNaira: planConfig?.priceNaira,
            subscription: sub,
            verifiedAt: payment?.updatedAt || new Date().toISOString(),
          });

          // Refresh subscription state in context so the rest of the application reflects the new plan immediately
          await refreshSubscription();
        } else {
          setSuccess(false);
          setError(res?.message || 'Payment verification could not be confirmed with Paystack.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setSuccess(false);
        setError(err?.message || 'A network error occurred while verifying the transaction with Paystack.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [refreshSubscription]);

  const handleReturnToDashboard = () => {
    try {
      window.history.replaceState({}, document.title, '/');
    } catch {
      // ignore
    }
    if (onDismiss) {
      onDismiss('dashboard');
    } else {
      window.location.href = '/';
    }
  };

  const handleGoToSettings = () => {
    try {
      window.history.replaceState({}, document.title, '/');
    } catch {
      // ignore
    }
    if (onDismiss) {
      onDismiss('settings');
    } else {
      window.location.href = '/';
    }
  };

  const handleRetryPlan = () => {
    try {
      window.history.replaceState({}, document.title, '/');
    } catch {
      // ignore
    }
    if (onDismiss) {
      onDismiss('settings');
      openUpgradeModal('PRO');
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header decoration */}
        <div
          className={`h-2.5 w-full ${
            loading
              ? 'bg-amber-500 animate-pulse'
              : success
              ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
              : 'bg-red-500'
          }`}
        />

        <div className="p-6 sm:p-8">
          {/* LOADING STATE */}
          {loading && (
            <div className="flex flex-col items-center text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Verifying Transaction...</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">
                  Connecting to Paystack's gateway to securely verify your payment and activate your subscription.
                </p>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Server-authoritative verification</span>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {!loading && success && (
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-teal-600" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Payment Successful</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">Subscription Activated!</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Thank you! Your payment has been verified directly with Paystack and your SellPilot plan is now active.
                </p>
              </div>

              {/* Transaction & Plan Summary Card */}
              {paymentData && (
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2.5">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Activated Plan</span>
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-1">
                      {paymentData.plan}
                    </span>
                  </div>

                  {paymentData.amountNaira && (
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">Amount Paid</span>
                      <span className="font-bold text-slate-900">
                        ₦{paymentData.amountNaira.toLocaleString()} NGN
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Payment Status</span>
                    <span className="inline-flex items-center gap-1 text-teal-700 font-bold bg-teal-100 px-2 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                      Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Payment Reference</span>
                    <span className="font-mono text-slate-700 truncate max-w-[200px]" title={paymentData.reference}>
                      {paymentData.reference}
                    </span>
                  </div>

                  {paymentData.subscription?.currentPeriodEnd && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Valid Until</span>
                      <span className="text-slate-700 font-semibold">
                        {new Date(paymentData.subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full space-y-2 pt-2">
                <button
                  type="button"
                  id="callback-dashboard-btn"
                  onClick={handleReturnToDashboard}
                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-teal-900/10 flex items-center justify-center gap-2"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleGoToSettings}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  View Subscription Details in Settings
                </button>
              </div>
            </div>
          )}

          {/* FAILED STATE */}
          {!loading && !success && (
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-inner">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Verification Unsuccessful</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">Payment Not Activated</h2>
                <p className="text-sm text-slate-600 mt-1 max-w-sm">
                  We could not verify this transaction with Paystack. Your subscription has not been modified.
                </p>
              </div>

              {/* Error Box */}
              <div className="w-full bg-red-50/70 border border-red-200 rounded-xl p-4 text-left">
                <div className="text-xs font-semibold text-red-900 mb-1">Reason:</div>
                <div className="text-xs text-red-700">
                  {error || 'The payment was not marked as successful by the Paystack payment gateway.'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleRetryPlan}
                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-teal-900/10 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Choose Plan & Try Again</span>
                </button>

                <button
                  type="button"
                  onClick={handleReturnToDashboard}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
