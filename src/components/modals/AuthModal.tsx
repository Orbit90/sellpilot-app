import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, CheckCircle2, Lock, Mail, User, Building2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const AuthModal: React.FC = () => {
  const { login, signup, showToast } = useApp();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [forgotSent, setForgotSent] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleModeChange = (newMode: 'login' | 'signup' | 'forgot') => {
    setMode(newMode);
    setForgotSent(false);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'signup') {
        await signup({
          name: name.trim(),
          email: email.trim(),
          password,
          businessName: businessName.trim(),
        });
      } else {
        await api.resetPassword(email.trim());
        setForgotSent(true);
      }
    } catch (err: any) {
      if (mode === 'forgot') {
        // Anti-enumeration: Even if rate limited or on general error, display safe message
        setErrorMessage(
          err?.message && err.message.includes('wait')
            ? err.message
            : 'Unable to request password reset. Please try again later.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-md shadow-teal-900/40 text-xl font-black">
            ₦
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {mode === 'login' && 'Welcome back to SellPilot'}
            {mode === 'signup' && 'Create Your SellPilot Account'}
            {mode === 'forgot' && 'Reset Your Password'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Turn your WhatsApp & Instagram chats into completed sales.
          </p>
        </div>

        {/* Body */}
        {mode === 'forgot' && forgotSent ? (
          <div className="p-6 text-center space-y-4 animate-in fade-in duration-200">
            <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto border border-teal-100">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Check Your Email</h3>
              <p className="text-xs text-slate-600 mt-2 max-w-xs mx-auto leading-relaxed">
                If an account exists with this email address, instructions to reset your password have been sent. Please check your inbox and spam folder.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleModeChange('login')}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-md shadow-teal-900/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                {errorMessage}
              </div>
            )}
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. David Nzeamalu"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Business / Store Name *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Supreme Gadgets"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password *
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => handleModeChange('forgot')}
                      className="text-[11px] text-teal-600 hover:underline font-semibold"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-md shadow-teal-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>
                {mode === 'login' && 'Sign In'}
                {mode === 'signup' && 'Create Business Account'}
                {mode === 'forgot' && 'Send Reset Link'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Toggle Login / Signup / Forgot */}
            <div className="text-center text-xs text-slate-500 pt-2">
              {mode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('signup')}
                    className="text-teal-600 font-bold hover:underline"
                  >
                    Sign Up Free
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className="text-teal-600 font-bold hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
