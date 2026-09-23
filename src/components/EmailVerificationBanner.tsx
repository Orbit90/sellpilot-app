import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const EmailVerificationBanner: React.FC = () => {
  const { user, resendVerification } = useApp();
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // If user is verified or not logged in, don't show the banner
  if (!user || user.emailVerified !== false) {
    return null;
  }

  // Handle countdown timer for cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    try {
      setIsResending(true);
      setResendStatus(null);
      const res = await resendVerification(user.email);
      if (res.success) {
        setResendStatus('Verification link sent! Check your inbox.');
        setCooldown(60); // 60s cooldown
      } else {
        setResendStatus(res.error || 'Failed to send. Please try again.');
      }
    } catch {
      setResendStatus('Failed to send verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-200 px-4 py-3 relative z-30 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white">Please verify your email address: </span>
            <span className="text-amber-300 font-mono font-medium underline underline-offset-2">{user.email}</span>
            <span className="hidden md:inline text-amber-200/80"> — Verify to unlock all merchant features and activate subscriptions.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          {resendStatus && (
            <span className="text-xs text-amber-300/90 flex items-center gap-1 hidden lg:flex">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {resendStatus}
            </span>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || cooldown > 0}
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white font-medium text-xs border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
            <span>
              {isResending
                ? 'Sending...'
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : 'Resend Verification Email'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
