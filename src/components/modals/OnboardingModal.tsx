import React, { useState } from 'react';
import {
  Sparkles,
  Building2,
  MapPin,
  Package,
  Truck,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BusinessCategory } from '../../types';

export const OnboardingModal: React.FC = () => {
  const { business, completeOnboarding } = useApp();
  const [step, setStep] = useState<number>(1);

  // Form states across the 6 steps
  const [businessName, setBusinessName] = useState(business?.name || '');
  const [category, setCategory] = useState<BusinessCategory>(business?.category || 'fashion');
  const [location, setLocation] = useState(business?.location || '');
  const [phone, setPhone] = useState(business?.phone || '');

  // First product
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('5');
  const [prodDescription, setProdDescription] = useState('');

  // Business Info
  const [deliveryInfo, setDeliveryInfo] = useState(business?.deliveryInfo || '');
  const [paymentInstructions, setPaymentInstructions] = useState(business?.paymentInstructions || '');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories: Array<{ id: BusinessCategory; label: string }> = [
    { id: 'fashion', label: '👗 Fashion & Clothing' },
    { id: 'shoes', label: '👟 Shoes & Footwear' },
    { id: 'beauty', label: '💄 Beauty & Cosmetics' },
    { id: 'food', label: '🍲 Food & Pastries' },
    { id: 'perfume', label: '✨ Perfume & Fragrances' },
    { id: 'accessories', label: '📱 Phone & Accessories' },
    { id: 'hair', label: '💇‍♀️ Wig & Hair Vendor' },
    { id: 'other', label: '🛍️ Other Retail Business' },
  ];

  const handleFinish = async () => {
    try {
      setIsSubmitting(true);
      await completeOnboarding({
        name: businessName?.trim() || business?.name || 'My Store',
        category: category || business?.category || 'fashion',
        location: location?.trim() || '',
        phone: phone?.trim() || '',
        deliveryInfo: deliveryInfo?.trim() || '',
        paymentInstructions: paymentInstructions?.trim() || '',
        firstProduct: prodName && prodName.trim()
          ? {
              name: prodName.trim(),
              price: Math.max(0, Number(prodPrice) || 0),
              stockQuantity: Math.max(1, Number(prodStock) || 5),
              description: prodDescription?.trim() || '',
              category: category || 'General',
            }
          : undefined,
      });
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Progress Bar Header */}
        <div className="bg-slate-900 p-6 text-white relative">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>Step {step} of 6</span>
            <div className="flex items-center gap-3">
              <span className="text-teal-400 font-bold">{Math.round((step / 6) * 100)}% Completed</span>
              <button
                type="button"
                onClick={handleFinish}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Skip to Dashboard"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>

          <h2 className="text-xl font-black mt-4 tracking-tight">
            {step === 1 && 'What is your business name?'}
            {step === 2 && 'Choose your business category'}
            {step === 3 && 'Where is your business located?'}
            {step === 4 && 'Add your first product'}
            {step === 5 && 'Set delivery & bank payment info'}
            {step === 6 && 'You are ready to sell! 🎉'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {step === 1 && 'This will be displayed to your customers in AI-generated messages.'}
            {step === 2 && 'SellPilot customizes tones and sales patterns for your niche.'}
            {step === 3 && 'Helps calculate accurate Nigerian courier and dispatch rates.'}
            {step === 4 && 'Input one item so you can test the AI Reply Assistant immediately.'}
            {step === 5 && 'The AI quotes these exact delivery fees and bank details.'}
            {step === 6 && 'Your SellPilot sales cockpit is primed and ready.'}
          </p>
        </div>

        {/* Step Body */}
        <div className="p-6 space-y-4">
          {/* Step 1: Business Name */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Business / Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zarah Styles, Lekki Hair World, Kemi Scents"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-3 text-base bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  WhatsApp Phone Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+234 803 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 text-base bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                />
              </div>
            </div>
          )}

          {/* Step 2: Category */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`p-3 rounded-xl border text-left font-bold text-xs transition-all ${
                    category === c.id
                      ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-500/20 text-teal-900'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Location */}
          {step === 3 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Primary Location / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ikeja, Lagos or Wuse 2, Abuja"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 text-base bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {['Ikeja, Lagos', 'Lekki / Island, Lagos', 'Abuja, FCT', 'Port Harcourt, Rivers', 'Ibadan, Oyo'].map(
                  (loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(loc)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 transition-colors"
                    >
                      {loc}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Step 4: First Product */}
          {step === 4 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Classic Silk Kimono Dress"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Price (₦ Naira) *
                  </label>
                  <input
                    type="number"
                    placeholder="25000"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    placeholder="10"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Material, available sizes, or colors..."
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 5: Business Information (Delivery & Bank) */}
          {step === 5 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Delivery Guidelines & Standard Fees
                </label>
                <textarea
                  rows={2}
                  value={deliveryInfo}
                  onChange={(e) => setDeliveryInfo(e.target.value)}
                  placeholder="e.g. Lagos Mainland: ₦2,500. Island: ₦3,500. Nationwide courier: ₦5,000."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Instructions (Bank Account)
                </label>
                <textarea
                  rows={2}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  placeholder="e.g. Bank: GTBank / OPay&#10;Account Number: 0123456789&#10;Account Name: Your Business Name"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 6: Confirmation & Ready */}
          {step === 6 && (
            <div className="py-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Setup Complete!</h3>
              <p className="text-xs text-slate-600 max-w-xs mx-auto">
                {businessName || 'Your store'} is now configured. You can start pasting WhatsApp customer messages to draft replies and manage orders.
              </p>
            </div>
          )}
        </div>

        {/* Modal Navigation Buttons */}
        <div className="p-6 pt-0 flex items-center justify-between gap-3 border-t border-slate-100 mt-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 6 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFinish}
                className="px-3 py-2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="onboarding-finish-btn"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs shadow-md flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              <span>{isSubmitting ? 'Opening Dashboard...' : 'Open My Dashboard'}</span>
              <Sparkles className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
