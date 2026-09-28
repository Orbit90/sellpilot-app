import React, { useState, useId } from 'react';
import {
  Building2,
  MapPin,
  Package,
  Truck,
  CreditCard,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Phone,
  Instagram,
  ShoppingBag,
  Send,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BusinessCategory, ResponseTone } from '../../types';
import { formatNaira } from '../../utils/formatters';

interface ProductPreset {
  name: string;
  price: number;
  stock: number;
  category: string;
  image: string;
  description: string;
}

const CATEGORY_PRESETS: Record<string, ProductPreset> = {
  fashion: {
    name: 'Luxury Silk Floral Kimono Dress',
    price: 32000,
    stock: 8,
    category: 'Fashion & Apparel',
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80',
    description: 'Premium quality mulberry silk, breathable silhouette, sizes 8-18 available. Includes matching waist sash.',
  },
  shoes: {
    name: 'Signature Leather Platform Loafers',
    price: 28500,
    stock: 6,
    category: 'Shoes & Footwear',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80',
    description: 'Handcrafted Italian leather upper, cushioned insole, sizes 38-45 in stock. Perfect for work and casual wear.',
  },
  beauty: {
    name: 'Botanical Radiance Glow Oil (50ml)',
    price: 18000,
    stock: 15,
    category: 'Beauty & Cosmetics',
    image: 'https://images.unsplash.com/photo-1608248597359-25f0a0d5c07b?auto=format&fit=crop&w=600&q=80',
    description: 'Cold-pressed rosehip and jojoba seed oil. Treats hyperpigmentation, dermatologically tested for Nigerian skin.',
  },
  hair: {
    name: '12A Double Drawn Bone Straight Frontal Wig (24")',
    price: 145000,
    stock: 4,
    category: 'Wig & Hair Vendor',
    image: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=600&q=80',
    description: '100% Raw Vietnamese human hair, HD invisible lace frontal, pre-plucked hairline, natural luster, tangle-free.',
  },
  perfume: {
    name: 'Oud Royal Extrait de Parfum (100ml)',
    price: 45000,
    stock: 10,
    category: 'Perfume & Fragrances',
    image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=600&q=80',
    description: 'Long-lasting 48-hour sillage. Notes of Cambodian oud, smoky amber, vanilla bean, and damask rose.',
  },
  accessories: {
    name: 'MagSafe Leather Wallet & Case Bundle',
    price: 22000,
    stock: 12,
    category: 'Phone & Accessories',
    image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=600&q=80',
    description: 'Built-in strong magnets, RFID blocking cardholder, compatible with iPhone 13, 14, 15, and 16 series.',
  },
  food: {
    name: 'Jumbo Assorted Party Small Chops Box',
    price: 15000,
    stock: 20,
    category: 'Food & Pastries',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    description: 'Contains 20 samosas, 20 spring rolls, 20 spicy peppered puff-puffs, 10 barbecued chicken wings.',
  },
  other: {
    name: 'Minimalist Ceramic Diffuser & Essential Oil',
    price: 19500,
    stock: 10,
    category: 'Retail Store',
    image: 'https://images.unsplash.com/photo-1602928321679-560bb453f190?auto=format&fit=crop&w=600&q=80',
    description: 'Ultrasonic whisper-quiet mist, ambient LED light, includes 10ml organic lemongrass fragrance.',
  },
};

const NIGERIAN_BANKS = [
  'OPay Digital Services',
  'Moniepoint Microfinance Bank',
  'Guaranty Trust Bank (GTBank)',
  'Access Bank Plc',
  'Zenith Bank Plc',
  'Kuda Bank',
  'First Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'PalmPay',
  'Stanbic IBTC Bank',
  'Fidelity Bank',
  'Sterling Bank',
  'Wema Bank / ALAT',
];

const POPULAR_LOCATIONS = [
  'Ikeja, Lagos',
  'Lekki / Victoria Island, Lagos',
  'Yaba / Surulere, Lagos',
  'Wuse 2, Abuja',
  'Maitama, Abuja',
  'GRA, Port Harcourt',
  'Bodija, Ibadan',
  'Kano Central, Kano',
];

export const OnboardingModal: React.FC = () => {
  const { business, completeOnboarding, setIsOnboarding } = useApp();
  const [step, setStep] = useState<number>(1);
  const totalSteps = 6;

  // Step 1: Store & Brand Profile
  const [businessName, setBusinessName] = useState(business?.name || '');
  const [category, setCategory] = useState<BusinessCategory>(business?.category || 'fashion');
  const [location, setLocation] = useState(business?.location || 'Ikeja, Lagos');
  const [phone, setPhone] = useState(business?.phone || '+234 803 123 4567');
  const [instagram, setInstagram] = useState('');

  // Step 2: First Product
  const initialPreset = CATEGORY_PRESETS[business?.category || 'fashion'] || CATEGORY_PRESETS.fashion;
  const [prodName, setProdName] = useState(initialPreset.name);
  const [prodPrice, setProdPrice] = useState(String(initialPreset.price));
  const [prodStock, setProdStock] = useState(String(initialPreset.stock));
  const [prodDescription, setProdDescription] = useState(initialPreset.description);
  const [prodImage, setProdImage] = useState(initialPreset.image);

  // Step 3: Logistics & Delivery
  const [mainlandFee, setMainlandFee] = useState('2500');
  const [islandFee, setIslandFee] = useState('3500');
  const [nationwideFee, setNationwideFee] = useState('5000');
  const [deliveryTimeline, setDeliveryTimeline] = useState('Same-day for orders before 12pm, 24-48 hrs standard within Lagos, 2-4 days nationwide via GIG / Peace Courier.');
  const [allowPickup, setAllowPickup] = useState(true);

  // Step 4: Settlement Bank Details
  const [bankName, setBankName] = useState('OPay Digital Services');
  const [accountNumber, setAccountNumber] = useState('8031234567');
  const [accountName, setAccountName] = useState(business?.name || 'Zarah Styles Enterprise');

  // Step 5: WhatsApp AI Sales Tone & Simulator
  const [selectedTone, setSelectedTone] = useState<ResponseTone>('friendly');
  const [enablePidgin, setEnablePidgin] = useState(true);
  const [activeChatPrompt, setActiveChatPrompt] = useState<'available' | 'delivery' | 'bank'>('available');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-switch product preset when merchant clicks category in Step 1
  const handleCategoryChange = (newCat: BusinessCategory) => {
    setCategory(newCat);
    const preset = CATEGORY_PRESETS[newCat] || CATEGORY_PRESETS.other;
    setProdName(preset.name);
    setProdPrice(String(preset.price));
    setProdStock(String(preset.stock));
    setProdDescription(preset.description);
    setProdImage(preset.image);
  };

  const handleFinish = async () => {
    try {
      setIsSubmitting(true);

      const formattedDeliveryInfo = `Lagos Mainland: ₦${Number(mainlandFee || 2500).toLocaleString()} | Lagos Island / Lekki: ₦${Number(islandFee || 3500).toLocaleString()} | Nationwide Interstate: ₦${Number(nationwideFee || 5000).toLocaleString()}.${allowPickup ? ' Store pickup available.' : ''} ${deliveryTimeline}`.trim();

      const formattedPaymentInstructions = `Bank: ${bankName}\nAccount Number: ${accountNumber}\nAccount Name: ${accountName}\nNote: Please send payment proof (screenshot/receipt) after transfer for instant order confirmation. Paystack card checkout links also supported.`.trim();

      await completeOnboarding({
        name: businessName.trim() || business?.name || 'My Store',
        category,
        location: location.trim(),
        phone: phone.trim(),
        deliveryInfo: formattedDeliveryInfo,
        paymentInstructions: formattedPaymentInstructions,
        description: instagram.trim() ? `Instagram: @${instagram.replace(/^@/, '')}` : '',
        currency: '₦',
        settings: {
          defaultTone: selectedTone,
          language: 'English (Nigerian)',
          pidginEnabled: enablePidgin,
          enablePidgin: enablePidgin,
        },
        firstProduct: prodName.trim()
          ? {
              name: prodName.trim(),
              price: Math.max(0, Number(prodPrice) || 0),
              stockQuantity: Math.max(1, Number(prodStock) || 5),
              description: prodDescription.trim(),
              category: CATEGORY_PRESETS[category]?.category || 'General',
              images: prodImage ? [prodImage] : [],
            }
          : undefined,
      });
    } catch {
      setIsSubmitting(false);
    }
  };

  // Helper for generating simulated AI responses
  const getSimulatedReply = () => {
    const safeStore = businessName.trim() || 'our store';
    const safeProduct = prodName.trim() || 'this item';
    const safePrice = formatNaira(Number(prodPrice) || 25000);
    const safeMainland = formatNaira(Number(mainlandFee) || 2500);
    const safeIsland = formatNaira(Number(islandFee) || 3500);

    if (activeChatPrompt === 'available') {
      if (selectedTone === 'friendly') {
        return enablePidgin
          ? `Hello sis! Yes o, the ${safeProduct} is very much available in stock right now! ✨ Price is ${safePrice}. Would you like me to reserve one for you today?`
          : `Hello! Yes, the ${safeProduct} is currently available in stock. The price is ${safePrice}. Which size or color would you like?`;
      }
      if (selectedTone === 'professional') {
        return `Good day, thank you for reaching out to ${safeStore}. The ${safeProduct} is in stock at ${safePrice}. We can dispatch your order today.`;
      }
      return `Hey! 🔥 Yes, ${safeProduct} is in stock right now for ${safePrice}! Fast selling item, how many can I pack for you?`;
    }

    if (activeChatPrompt === 'delivery') {
      return `Delivery is ${safeMainland} for Lagos Mainland and ${safeIsland} for Island/Lekki. We do same-day dispatch if you order early! Can you share your exact delivery address?`;
    }

    // bank prompt
    return `Awesome! Here are our official store account details:\n\n🏦 ${bankName}\n🔢 ${accountNumber}\n👤 ${accountName}\n💰 Total: ${safePrice}\n\nKindly send your transfer receipt once done so our dispatch rider can move! 🚀`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Top Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-3">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">Step {step} of {totalSteps}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-teal-400 font-bold">{Math.round((step / totalSteps) * 100)}% Complete</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOnboarding(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Close wizard"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>

          {/* Step Title & Subtitle */}
          <div className="mt-4">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {step === 1 && '01. Store & Brand Profile'}
              {step === 2 && '02. Add Your Hero Product'}
              {step === 3 && '03. Delivery & Dispatch Rates'}
              {step === 4 && '04. Bank Settlement & Payments'}
              {step === 5 && '05. WhatsApp AI Sales Voice'}
              {step === 6 && '06. Ready to Launch Your Store! 🎉'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              {step === 1 && 'Set up your merchant identity and social handles so SellPilot knows your brand.'}
              {step === 2 && 'Enter one item to test the AI Assistant and start quoting prices instantly.'}
              {step === 3 && 'Configure your delivery fees for Lagos Mainland, Island, and nationwide logistics.'}
              {step === 4 && 'Input your Nigerian bank account to automatically invoice customers and receive transfers.'}
              {step === 5 && 'Choose how your AI Sales Assistant speaks to buyers in WhatsApp and Instagram chats.'}
              {step === 6 && 'Your SellPilot sales cockpit is fully calibrated and ready to close sales.'}
            </p>
          </div>
        </div>

        {/* Step Body (Scrollable) */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: Store & Brand Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Store / Business Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zarah Styles, Supreme Gadgets, Kemi Luxury Hair"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Select Business Niche / Category *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'fashion', label: '👗 Fashion & Wear' },
                    { id: 'shoes', label: '👟 Shoes & Sneakers' },
                    { id: 'beauty', label: '💄 Beauty & Skin' },
                    { id: 'hair', label: '💇‍♀️ Wigs & Hair' },
                    { id: 'accessories', label: '📱 Phones & Tech' },
                    { id: 'perfume', label: '✨ Luxury Perfumes' },
                    { id: 'food', label: '🍲 Food & Chops' },
                    { id: 'other', label: '🛍️ General Retail' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCategoryChange(c.id as BusinessCategory)}
                      className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                        category === c.id
                          ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-500/20 text-teal-900 shadow-sm'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    WhatsApp Business Phone *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="+234 803 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">Used by the AI to format customer inquiry links.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Instagram Handle (Optional)
                  </label>
                  <div className="relative">
                    <Instagram className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="@yourstore_ng"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">Included in automated social message signatures.</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Primary Location / Hub
                </label>
                <div className="relative mb-2">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Ikeja, Lagos"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(loc)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        location === loc
                          ? 'bg-teal-50 border-teal-500 text-teal-800 font-semibold'
                          : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: First Hero Product */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Your First Catalog Item</h3>
                  <p className="text-xs text-slate-500">We pre-filled a popular item for your niche. Customize it or keep it to test.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const preset = CATEGORY_PRESETS[category] || CATEGORY_PRESETS.fashion;
                    setProdName(preset.name);
                    setProdPrice(String(preset.price));
                    setProdStock(String(preset.stock));
                    setProdDescription(preset.description);
                    setProdImage(preset.image);
                  }}
                  className="text-xs text-teal-700 hover:text-teal-900 flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset Sample</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Silk Kaftan, Nike Air Force 1, Human Hair Frontal"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Price (₦ Naira) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">₦</span>
                    <input
                      type="number"
                      required
                      min={0}
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="25000"
                      className="w-full pl-8 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono font-semibold"
                    />
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {[15000, 25000, 45000, 85000].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProdPrice(String(p))}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-800 border border-slate-200 font-mono"
                      >
                        {formatNaira(p)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Stock Quantity Ready for Dispatch
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                    />
                    <div className="flex gap-1">
                      {[5, 10, 20].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setProdStock(String(s))}
                          className="text-xs px-2.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Image & Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Product Image Preview
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-300">
                    <img
                      src={prodImage}
                      alt="Product preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={prodImage}
                      onChange={(e) => setProdImage(e.target.value)}
                      placeholder="Paste image URL..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none text-slate-600 font-mono truncate"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">High-resolution e-commerce photo linked automatically.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Key Selling Features & Details
                </label>
                <textarea
                  rows={2}
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="Material, available sizes, packaging, guarantees..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-700"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Delivery & Dispatch Rates */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-teal-50/60 border border-teal-200 p-3.5 rounded-xl text-xs text-teal-900 leading-relaxed">
                Nigerian social buyers routinely ask: <em>&quot;How much is delivery to Lagos Mainland vs Island?&quot;</em> SellPilot uses these figures to quote delivery instantly.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-800 block mb-1">Lagos Mainland Dispatch</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₦</span>
                    <input
                      type="number"
                      value={mainlandFee}
                      onChange={(e) => setMainlandFee(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Ikeja, Yaba, Surulere, Gbagada</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-800 block mb-1">Lagos Island / Lekki</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₦</span>
                    <input
                      type="number"
                      value={islandFee}
                      onChange={(e) => setIslandFee(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">VI, Lekki Phase 1, Ikoyi, Ajah</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-800 block mb-1">Nationwide Inter-State</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₦</span>
                    <input
                      type="number"
                      value={nationwideFee}
                      onChange={(e) => setNationwideFee(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Abuja, PH, Ibadan (via GIG / Peace)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Standard Delivery Timeline & Logistics Policy
                </label>
                <textarea
                  rows={2}
                  value={deliveryTimeline}
                  onChange={(e) => setDeliveryTimeline(e.target.value)}
                  placeholder="e.g. Same day delivery for orders placed before 12pm..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-700"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Offer Free Customer Pickup</span>
                  <span className="text-[11px] text-slate-500 block">Allow local customers to pick up from your store or hub.</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowPickup}
                  onChange={(e) => setAllowPickup(e.target.checked)}
                  className="w-5 h-5 accent-teal-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Bank Settlement & Payments */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-teal-400 font-bold text-xs uppercase tracking-wider mb-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Paystack Online Payments Ready</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Customers can also pay via Debit Cards, USSD, and Apple Pay with automated instant verification.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Settlement Bank *
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-semibold text-slate-800"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    10-Digit NUBAN Account Number *
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 0123456789"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono font-bold tracking-wider"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {accountNumber.length}/10 digits entered
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Account Beneficiary Name *
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Zarah Styles Enterprise"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-semibold"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Exact name registered with your bank.</span>
                </div>
              </div>

              {/* Account Confirmation Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
                  Automated Transfer Invoice Snippet
                </span>
                <p className="text-slate-800 font-bold">{bankName}</p>
                <p className="text-teal-700 font-black text-sm tracking-wider">{accountNumber || '0000000000'}</p>
                <p className="text-slate-600">{accountName || 'Your Store Name'}</p>
              </div>
            </div>
          )}

          {/* STEP 5: WhatsApp AI Sales Voice & Interactive Chat Simulator */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Choose Your Store&apos;s AI Voice Tone
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      id: 'friendly',
                      title: '🌟 Warm & Respectful ("Sis / Dear")',
                      desc: 'Friendly, personal, and respectful. Converts hesitant buyers through warmth.',
                    },
                    {
                      id: 'professional',
                      title: '💼 Professional & Luxury',
                      desc: 'Crisp, polite, and formal. Suited for luxury boutiques and premium electronics.',
                    },
                    {
                      id: 'persuasive',
                      title: '⚡ Vibrant & Enthusiastic',
                      desc: 'Energetic, modern social-commerce tone with subtle emojis. Great for fast fashion.',
                    },
                    {
                      id: 'casual',
                      title: '🎯 Direct & Concise',
                      desc: 'Short, clean answers. Numbers, prices, and bank details first.',
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTone(t.id as ResponseTone)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedTone === t.id
                          ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-900 block">{t.title}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nigerian Pidgin Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Nigerian Pidgin Language Blend</span>
                  <span className="text-[11px] text-slate-500 block">
                    Understands buyer phrases like &quot;How much last?&quot; and &quot;Abeg deliver tomorrow&quot;.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enablePidgin}
                  onChange={(e) => setEnablePidgin(e.target.checked)}
                  className="w-5 h-5 accent-teal-600 rounded cursor-pointer"
                />
              </div>

              {/* LIVE CHAT SIMULATOR */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Interactive WhatsApp Reply Test
                  </span>
                  <span className="text-[11px] text-teal-700 font-semibold">Test customer chats below:</span>
                </div>

                {/* Prompt selector */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveChatPrompt('available')}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      activeChatPrompt === 'available'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    💬 &quot;Is this in stock?&quot;
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChatPrompt('delivery')}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      activeChatPrompt === 'delivery'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    🚚 &quot;How much for delivery?&quot;
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChatPrompt('bank')}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      activeChatPrompt === 'bank'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    🏦 &quot;Send account number&quot;
                  </button>
                </div>

                {/* WhatsApp style preview bubble */}
                <div className="bg-[#e5ddd5] p-3.5 rounded-2xl border border-slate-300 space-y-2.5 shadow-inner">
                  {/* Incoming message */}
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-sm max-w-[85%] text-xs text-slate-800">
                      <span className="font-bold text-[10px] text-teal-700 block mb-0.5">Potential Customer (WhatsApp)</span>
                      {activeChatPrompt === 'available' && `Hello! Is the ${prodName || 'item'} still in stock and how much?`}
                      {activeChatPrompt === 'delivery' && `Can you dispatch to Lekki or Ikeja today? How much with delivery?`}
                      {activeChatPrompt === 'bank' && `I am ready to buy now. Please send your bank details make I transfer.`}
                    </div>
                  </div>

                  {/* AI Generated response */}
                  <div className="flex justify-end">
                    <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-none p-3 shadow-sm max-w-[85%] text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                      <div className="flex items-center gap-1 font-bold text-[10px] text-emerald-800 mb-0.5">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>SellPilot AI Reply ({businessName || 'Your Store'})</span>
                      </div>
                      {getSimulatedReply()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Confirmation & Store Launch */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2.5 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Your Store Is Ready to Sell!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  We configured your catalog, delivery zones, settlement bank, and WhatsApp assistant voice.
                </p>
              </div>

              {/* Summary Review Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Store & Profile</span>
                  <p className="font-bold text-slate-900 text-sm">{businessName || 'My Store'}</p>
                  <p className="text-slate-600">{phone}</p>
                  <p className="text-slate-500">{location}</p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hero Product</span>
                  <p className="font-bold text-slate-900 truncate">{prodName}</p>
                  <p className="text-teal-700 font-bold">{formatNaira(Number(prodPrice) || 0)}</p>
                  <p className="text-slate-500">{prodStock} units in stock</p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivery Logistics</span>
                  <p className="text-slate-700">Mainland: {formatNaira(Number(mainlandFee) || 2500)}</p>
                  <p className="text-slate-700">Island: {formatNaira(Number(islandFee) || 3500)}</p>
                  <p className="text-slate-700">Nationwide: {formatNaira(Number(nationwideFee) || 5000)}</p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settlement Bank</span>
                  <p className="font-bold text-slate-900">{bankName}</p>
                  <p className="font-mono text-teal-700 font-semibold">{accountNumber}</p>
                  <p className="text-slate-600 truncate">{accountName}</p>
                </div>
              </div>

              {/* What to do next checklist */}
              <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl">
                <span className="text-xs font-bold text-teal-900 block mb-1">What to do next inside your cockpit:</span>
                <ul className="text-xs text-teal-800 space-y-1">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                    <span>Paste customer WhatsApp messages into the AI Reply Assistant.</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                    <span>Record orders and generate instant Paystack payment links.</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                    <span>Track pending delivery dispatches and customer balances.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Navigation Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80 flex-shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsOnboarding(false)}
              className="text-slate-500 hover:text-slate-800 text-xs font-semibold px-2 py-1"
            >
              Skip for now
            </button>
          )}

          {step < totalSteps ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
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
              <span>{isSubmitting ? 'Opening Dashboard...' : 'Launch My Store Dashboard'}</span>
              <Sparkles className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
