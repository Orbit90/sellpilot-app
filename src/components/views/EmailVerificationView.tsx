import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, XCircle, Mail, RefreshCw, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface EmailVerificationViewProps {
  onDismiss?: () => void;
}

export const EmailVerificationView: React.FC<EmailVerificationViewProps> = ({ onDismiss }) => {
  const { verifyEmail, resendVerification, user, isLoggedIn, setActiveSection } = useApp();

  const [state, setState] = useState<'verifying' | 'success' | 'expired' | 'invalid' | 'already_verified' | 'idle'>('verifying');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [resendEmail, setResendEmail] = useState<string>(user?.email || '');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Extract token from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('verify_token');

    if (!token) {
      if (user?.emailVerified) {
        setState('already_verified');
        setStatusMessage('Your email address is already verified.');
      } else {
        setState('idle');
      }
      return;
    }

    // Call verify endpoint
    let isMounted = true;
    const executeVerification = async () => {
      setState('verifying');
      const res = await verifyEmail(token);
      if (!isMounted) return;

      if (res.success) {
        setState('success');
        setStatusMessage(res.message || 'Your email address has been successfully verified!');
      } else {
        const errorLower = (res.message || res.error || '').toLowerCase();
        if (res.expired || errorLower.includes('expired')) {
          setState('expired');
          setStatusMessage(res.message || 'This verification link has expired (links are valid for 24 hours).');
        } else if (errorLower.includes('already been used') || errorLower.includes('already verified')) {
          setState('already_verified');
          setStatusMessage(res.message || 'This verification token was already used or your account is already verified.');
        } else {
          setState('invalid');
          setStatusMessage(res.message || 'This verification link is invalid or incomplete.');
        }
      }
    };

    executeVerification();

    return () => {
      isMounted = false;
    };
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = resendEmail.trim() || user?.email;
    if (!target) {
      setResendMessage('Please enter your email address.');
      return;
    }

    try {
      setIsResending(true);
      setResendMessage(null);
      const res = await resendVerification(target);
      if (res.success) {
        setResendMessage('A fresh verification link has been sent to your email.');
        setCooldown(60);
      } else {
        setResendMessage(res.error || 'Failed to send verification link.');
      }
    } catch {
      setResendMessage('Unable to send verification link. Please check your connection.');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoToDashboard = () => {
    try {
      window.history.replaceState({}, document.title, '/');
    } catch {
      // ignore
    }
    if (onDismiss) {
      onDismiss();
    } else {
      setActiveSection('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 antialiased text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
        {/* Top ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* SellPilot Brand Header */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-teal-900/40">
            ₦
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-white tracking-tight">SellPilot</span>
            <span className="text-[10px] uppercase tracking-wider text-teal-400 font-bold">Email Verification</span>
          </div>
        </div>

        {/* 1. VERIFYING STATE */}
        {state === 'verifying' && (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-5 animate-pulse">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Verifying your email...</h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xs">
              Securing your SellPilot merchant account and activating your automated sales workspace.
            </p>
          </div>
        )}

        {/* 2. SUCCESS STATE */}
        {state === 'success' && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-5 shadow-lg shadow-emerald-950">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold tracking-wide uppercase mb-3 border border-emerald-500/20">
              Account Verified
            </span>
            <h2 className="text-xl font-black text-white mb-2">Email Verified Successfully!</h2>
            <p className="text-xs sm:text-sm text-slate-300 mb-6">
              {statusMessage || 'Your email address is now confirmed. You can now access all merchant tools and subscription features.'}
            </p>

            <button
              type="button"
              onClick={handleGoToDashboard}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>{isLoggedIn ? 'Go to My Dashboard' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3. ALREADY VERIFIED STATE */}
        {state === 'already_verified' && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 mb-5">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Already Verified</h2>
            <p className="text-xs sm:text-sm text-slate-300 mb-6">
              {statusMessage || 'Your SellPilot account has already been verified and is in good standing.'}
            </p>

            <button
              type="button"
              onClick={handleGoToDashboard}
              className="w-full py-3.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>{isLoggedIn ? 'Open Dashboard' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4. EXPIRED TOKEN STATE */}
        {state === 'expired' && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-5">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold tracking-wide uppercase mb-3 border border-amber-500/20">
              Link Expired
            </span>
            <h2 className="text-xl font-bold text-white mb-2">Verification Link Expired</h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-6">
              Security links expire after 24 hours. Request a new verification link below to verify your email.
            </p>

            <form onSubmit={handleResend} className="w-full space-y-3 mb-4">
              <div className="relative text-left">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Your Registered Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="name@business.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {resendMessage && (
                <p className="text-xs text-amber-300 text-left bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                  {resendMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isResending || cooldown > 0}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer shadow-md"
              >
                <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
                <span>
                  {isResending
                    ? 'Sending...'
                    : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : 'Send New Verification Link'}
                </span>
              </button>
            </form>

            <button
              type="button"
              onClick={handleGoToDashboard}
              className="text-xs text-slate-400 hover:text-white underline mt-2"
            >
              Return to Homepage
            </button>
          </div>
        )}

        {/* 5. INVALID OR IDLE STATE */}
        {(state === 'invalid' || state === 'idle') && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-5">
              <XCircle className="w-9 h-9" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {state === 'invalid' ? 'Invalid Verification Link' : 'Verify Your Email'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-6">
              {statusMessage ||
                'To protect your store and customer data, please verify your email address to access all features.'}
            </p>

            <form onSubmit={handleResend} className="w-full space-y-3 mb-4">
              <div className="relative text-left">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Your Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="name@business.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {resendMessage && (
                <p className="text-xs text-teal-300 text-left bg-teal-500/10 border border-teal-500/20 p-2.5 rounded-lg">
                  {resendMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isResending || cooldown > 0}
                className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer shadow-md"
              >
                <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
                <span>
                  {isResending
                    ? 'Sending...'
                    : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : 'Resend Verification Email'}
                </span>
              </button>
            </form>

            <button
              type="button"
              onClick={handleGoToDashboard}
              className="text-xs text-slate-400 hover:text-white underline mt-2"
            >
              Back to Sign In / Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
