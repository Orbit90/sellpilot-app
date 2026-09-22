import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Truck,
  RotateCcw,
  CreditCard,
  Sparkles,
  User,
  Save,
  Download,
  RefreshCw,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BusinessCategory, ResponseTone } from '../../types';
import { SubscriptionSettingsSection } from '../subscription/SubscriptionSettingsSection';

export const SettingsView: React.FC = () => {
  const {
    business,
    user,
    settings,
    updateBusinessProfile,
    updateSettings,
    resetToDemoData,
    quickSwitchToDemo,
    logout,
    showToast,
  } = useApp();

  // Business Profile Form
  const [name, setName] = useState(business?.name || '');
  const [category, setCategory] = useState<BusinessCategory>(business?.category || 'fashion');
  const [description, setDescription] = useState(business?.description || '');
  const [phone, setPhone] = useState(business?.phone || '');
  const [location, setLocation] = useState(business?.location || '');
  const [currency, setCurrency] = useState(business?.currency || '₦');
  const [deliveryInfo, setDeliveryInfo] = useState(business?.deliveryInfo || '');
  const [returnPolicy, setReturnPolicy] = useState(business?.returnPolicy || '');
  const [paymentInstructions, setPaymentInstructions] = useState(business?.paymentInstructions || '');

  // AI Preferences
  const [defaultTone, setDefaultTone] = useState<ResponseTone>(settings?.defaultTone || 'friendly');
  const [language, setLanguage] = useState(settings?.language || 'English (Nigerian)');
  const [enablePidgin, setEnablePidgin] = useState(settings?.enablePidgin ?? true);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setName(business.name);
      setCategory(business.category);
      setDescription(business.description);
      setPhone(business.phone);
      setLocation(business.location);
      setCurrency(business.currency || '₦');
      setDeliveryInfo(business.deliveryInfo);
      setReturnPolicy(business.returnPolicy);
      setPaymentInstructions(business.paymentInstructions);
    }
  }, [business]);

  useEffect(() => {
    if (settings) {
      setDefaultTone(settings.defaultTone);
      setLanguage(settings.language);
      setEnablePidgin(settings.enablePidgin ?? settings.pidginEnabled ?? true);
    }
  }, [settings]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateBusinessProfile({
        name: name.trim(),
        category,
        description: description.trim(),
        phone: phone.trim(),
        location: location.trim(),
        currency,
        deliveryInfo: deliveryInfo.trim(),
        returnPolicy: returnPolicy.trim(),
        paymentInstructions: paymentInstructions.trim(),
      });

      await updateSettings({
        defaultTone,
        language,
        enablePidgin,
      });

      showToast('All business details and AI preferences saved successfully!');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(
      JSON.stringify(
        {
          business,
          settings,
          exportedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sellpilot_${business?.name.toLowerCase().replace(/\s+/g, '_')}_backup.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Store settings exported to JSON');
  };

  return (
    <div id="settings-view" className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Store Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure your business profile, delivery rates, bank details, and AI grounding policies.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors shrink-0 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Business Profile Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-teal-600" />
            <h2 className="font-extrabold text-base text-slate-900">Business Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Business / Brand Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Business Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BusinessCategory)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="fashion">Fashion & Clothing</option>
                <option value="shoes">Shoes & Footwear</option>
                <option value="beauty">Beauty & Cosmetics</option>
                <option value="food">Food & Confectionery</option>
                <option value="perfume">Perfume & Fragrances</option>
                <option value="accessories">Phone & Accessories</option>
                <option value="hair">Wig & Hair Vendor</option>
                <option value="other">Other Online Business</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                WhatsApp Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Store Location / Dispatch Hub
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Brand Bio / Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What sets your business apart?"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Delivery & Returns Policies */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Truck className="w-5 h-5 text-teal-600" />
            <h2 className="font-extrabold text-base text-slate-900">Delivery & Returns (Used by AI)</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Delivery Guidelines & Standard Rates
              </label>
              <textarea
                rows={3}
                value={deliveryInfo}
                onChange={(e) => setDeliveryInfo(e.target.value)}
                placeholder="e.g. Lagos Mainland: ₦2,500. Island: ₦3,500. Abuja/Nationwide courier: ₦4,500."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none leading-relaxed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                The AI Assistant will quote these exact rates when customers ask about shipping to their state.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Return & Exchange Policy
              </label>
              <textarea
                rows={2}
                value={returnPolicy}
                onChange={(e) => setReturnPolicy(e.target.value)}
                placeholder="e.g. Exchanges allowed within 48 hours for sizing differences. Items must be unworn."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Payment Instructions / Bank Details */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <CreditCard className="w-5 h-5 text-teal-600" />
            <h2 className="font-extrabold text-base text-slate-900">Payment Instructions & Bank Account</h2>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Bank Account Transfer Details
            </label>
            <textarea
              rows={3}
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              placeholder="Bank Name: Guaranty Trust Bank (GTB)&#10;Account Number: 0123456789&#10;Account Name: Your Business Name"
              className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Included automatically whenever the customer asks for account details or confirms an order.
            </p>
          </div>
        </div>

        {/* AI Preferences */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h2 className="font-extrabold text-base text-slate-900">AI Personality Preferences</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Default Reply Tone
              </label>
              <select
                value={defaultTone}
                onChange={(e) => setDefaultTone(e.target.value as ResponseTone)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="friendly">Friendly (Warm & Welcoming)</option>
                <option value="nigerian_business">Nigerian Business Tone</option>
                <option value="nigerian_pidgin">Nigerian Pidgin English</option>
                <option value="persuasive">Persuasive (High Conversion)</option>
                <option value="professional">Professional (Corporate)</option>
                <option value="casual">Casual & Relaxed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Language Standard
              </label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enablePidgin}
                  onChange={(e) => setEnablePidgin(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800">
                    Enable Nigerian Pidgin option for conversational chats
                  </span>
                  <p className="text-xs text-slate-500">
                    Allows sellers to switch to authentic Nigerian Pidgin with a single tap.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Commercial Subscription & Resource Quota */}
        <SubscriptionSettingsSection />

        {/* User Account & Data Management */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-teal-600" />
            <h2 className="font-extrabold text-base text-slate-900">
              {business?.id === 'biz_zarah_styles' ? 'Demo Account & Sample Data' : 'Account Information'}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div>
              <p className="text-sm font-bold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
              {business && (
                <p className="text-[11px] text-teal-700 font-medium mt-0.5">
                  Store: <span className="font-bold">{business.name}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Data</span>
              </button>

              {business?.id === 'biz_zarah_styles' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Reset sample catalog, orders, and customers for demo store?')) {
                      await resetToDemoData();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Demo Data</span>
                </button>
              )}

              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 rounded-2xl font-black text-sm bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-900/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save All Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
