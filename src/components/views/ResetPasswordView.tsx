import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, AlertTriangle, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';

interface ResetPasswordViewProps {
  onDismiss: () => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({ onDismiss }) => {
  const [token, setToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<'form' | 'missing_token' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const extractedToken = params.get('token') || params.get('reset_token');

    if (!extractedToken || !extractedToken.trim()) {
      setState('missing_token');
    } else {
      setToken(extractedToken.trim());
      setState('form');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 8 || newPassword.length > 128) {
      setErrorMessage('Password must be between 8 and 128 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify and try again.');
      return;
    }

    if (!token) {
      setState('missing_token');
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.confirmResetPassword(token, newPassword);

      if (res.success) {
        setState('success');
      } else {
        setState('error');
        setErrorMessage(res.message || 'Unable to reset password. The link may have expired or already been used.');
      }
    } catch (err: any) {
      setState('error');
      // Do not expose raw internal API errors or stack traces to the user
      setErrorMessage(
        err?.message && !err.message.includes('500') && !err.message.includes('Internal')
          ? err.message
          : 'Unable to reset password. The link may have expired or already been used. Please request a new link.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 antialiased text-slate-100">
      <div className="bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800/80 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-md shadow-teal-900/40 text-white text-xl font-black">
            ₦
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            {state === 'success' ? 'Password Reset Complete' : 'Reset Your Password'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {state === 'success'
              ? 'Your SellPilot account has been secured with your new password.'
              : 'Choose a strong new password for your SellPilot account.'}
          </p>
        </div>

        <div className="p-6">
          {/* STATE 1: MISSING TOKEN */}
          {state === 'missing_token' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-200">Missing Reset Link</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  This password reset link appears incomplete or invalid. Please check the email you received or request a fresh link.
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-md shadow-teal-900/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Go to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STATE 2: SUCCESS */}
          {state === 'success' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-200">Password Changed Successfully</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Your password has been updated. You can now sign in to your merchant dashboard with your new password.
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-md shadow-teal-900/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Back to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STATE 3: FORM or ERROR */}
          {(state === 'form' || state === 'error') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{errorMessage}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={128}
                    placeholder="Between 8 and 128 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Password must be between 8 and 128 characters.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={128}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-md shadow-teal-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Updating Password...</span>
                  ) : (
                    <>
                      <span>Update Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-xs text-slate-400 hover:text-teal-400 font-semibold transition-colors"
                >
                  Return to Sign In
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer security badge */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800/60 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>Encrypted with scrypt & SHA-256 session protection</span>
        </div>
      </div>
    </div>
  );
};
