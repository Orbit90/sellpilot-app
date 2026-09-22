import React, { useState, useMemo } from 'react';
import {
  MessageSquareText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Send,
  Copy,
  ShoppingBag,
  Clock,
  UserPlus,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Tag,
  Check,
  Package,
  TrendingUp,
  Sliders,
  DollarSign,
  MapPin,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConversationAnalysis, DetectedProduct, PotentialOrderItem, ResponseTone } from '../../types';
import { formatNaira, formatDate } from '../../utils/formatters';

const SAMPLE_SCENARIOS = [
  {
    title: 'Product & Delivery Question',
    badge: 'Question',
    text: `Customer: Hi, is the Casual Sneakers available in size 42? How much is delivery to Abuja?`,
  },
  {
    title: 'Ready to Buy (Purchase Intent)',
    badge: 'Purchase Intent',
    text: `Customer: Good day, I'm ready to buy 2 units of the Classic Handbag in Caramel Tan. Please send your bank account details so I can transfer immediately.`,
  },
  {
    title: 'Unlisted Item Inquired',
    badge: 'Unlisted Product',
    text: `Customer: Hello! Do you have Nike Air Force 1 size 42 in stock and how much does it cost?`,
  },
  {
    title: 'Discount Request / Negotiation',
    badge: 'Negotiation',
    text: `Customer: Hello, I really like the Ankara Modern Midi Dress, but can you give me 30% discount? Last price abeg.`,
  },
  {
    title: 'Hesitant Lead (Follow-up)',
    badge: 'Considering',
    text: `Customer: I really like the Black Leather Sneaker in size 43, but let me think about it and check my budget. I will get back to you by tomorrow.`,
  },
];

export const ConversationAnalyzerView: React.FC = () => {
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    analyzeConversation,
    createCustomerFromConversation,
    createOrderFromConversation,
    createFollowUpFromConversation,
    adjustConversationReply,
    customers,
    products,
    business,
    showToast,
  } = useApp();

  const [conversationInput, setConversationInput] = useState('');
  const [selectedTone, setSelectedTone] = useState<ResponseTone>('friendly');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedReply, setCopiedReply] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Quick Action Modal states
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Form states for conversion
  const [orderDeliveryFee, setOrderDeliveryFee] = useState(0);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [orderDeliveryAddress, setOrderDeliveryAddress] = useState('');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [customerLocationInput, setCustomerLocationInput] = useState('');

  // Scenarios: strictly isolated. Demo scenarios only on demo store; real merchant products for registered accounts
  const isDemoStore = business?.id === 'biz_zarah_styles';
  const scenariosToDisplay = useMemo(() => {
    if (isDemoStore) return SAMPLE_SCENARIOS;
    if (!products || products.length === 0) return [];

    const firstProduct = products[0];
    const secondProduct = products.length > 1 ? products[1] : null;

    return [
      {
        title: `Product Inquiry (${firstProduct.name.slice(0, 24)})`,
        text: `Customer: Hi, is the "${firstProduct.name}" available in stock? How much is delivery to Abuja?`,
      },
      {
        title: `Ready to Buy (${firstProduct.name.slice(0, 24)})`,
        text: `Customer: Good day, I am ready to order 1 unit of "${firstProduct.name}". Please send your official bank account details so I can pay immediately.`,
      },
      ...(secondProduct
        ? [
            {
              title: `Catalog Inquiry (${secondProduct.name.slice(0, 24)})`,
              text: `Customer: Hello! Do you have "${secondProduct.name}" available in stock and how much is it?`,
            },
          ]
        : []),
    ];
  }, [isDemoStore, products]);

  // Follow-up form
  const [followUpDueDate, setFollowUpDueDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().split('T')[0];
  });

  const currentAnalysis = activeConversation || (conversations.length > 0 ? conversations[0] : null);

  const handleAnalyze = async (textToAnalyze?: string) => {
    const text = textToAnalyze || conversationInput;
    if (!text.trim()) {
      showToast('Please paste a WhatsApp conversation to analyze', 'error');
      return;
    }

    try {
      setIsAnalyzing(true);
      const result = await analyzeConversation(text.trim(), selectedTone);
      setConversationInput('');
      // Pre-fill modal states
      if (result.customerName) setCustomerNameInput(result.customerName);
      if (result.customerPhone) setCustomerPhoneInput(result.customerPhone);
      if (result.deliveryFeeEstimated) setOrderDeliveryFee(result.deliveryFeeEstimated);
    } catch {
      // Error handled by context
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectSample = (sampleText: string) => {
    setConversationInput(sampleText);
    handleAnalyze(sampleText);
  };

  const handleCopyReply = () => {
    if (!currentAnalysis?.suggestedReply) return;
    navigator.clipboard.writeText(currentAnalysis.suggestedReply);
    setCopiedReply(true);
    showToast('Suggested reply copied to clipboard!');
    setTimeout(() => setCopiedReply(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    if (!currentAnalysis?.suggestedReply) return;
    const phone = currentAnalysis.customerPhone ? currentAnalysis.customerPhone.replace(/\D/g, '') : '';
    const encoded = encodeURIComponent(currentAnalysis.suggestedReply);
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleAdjustReply = async (adjustmentType: 'shorter' | 'professional' | 'friendly' | 'cta' | 'pidgin') => {
    if (!currentAnalysis) return;
    try {
      setIsAdjusting(true);
      await adjustConversationReply(currentAnalysis.id, adjustmentType);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!currentAnalysis) return;
    const name = customerNameInput.trim() || currentAnalysis.customerName || 'WhatsApp Customer';
    const phone = customerPhoneInput.trim() || currentAnalysis.customerPhone || '';
    if (!phone) {
      showToast('Please provide a phone number for the customer', 'error');
      return;
    }

    await createCustomerFromConversation(currentAnalysis.id, {
      name,
      phone,
      location: customerLocationInput.trim(),
    });
    setShowCustomerModal(false);
  };

  const handleCreateOrder = async () => {
    if (!currentAnalysis) return;
    const items = currentAnalysis.orderItems && currentAnalysis.orderItems.length > 0
      ? currentAnalysis.orderItems
      : currentAnalysis.productsDetected
          .filter((p) => p.matchedInCatalog && p.productId)
          .map((p) => ({
            productId: p.productId!,
            productName: p.name,
            variantName: p.variantDiscussed || undefined,
            quantity: p.quantityDiscussed || 1,
            unitPrice: p.catalogPrice || 0,
          }));

    if (items.length === 0) {
      showToast('No catalog items found to create an order from', 'error');
      return;
    }

    await createOrderFromConversation(currentAnalysis.id, {
      customerId: currentAnalysis.customerId || undefined,
      customerName: customerNameInput.trim() || currentAnalysis.customerName || 'WhatsApp Customer',
      customerPhone: customerPhoneInput.trim() || currentAnalysis.customerPhone || '',
      items,
      deliveryFee: orderDeliveryFee,
      discount: orderDiscount,
      deliveryAddress: orderDeliveryAddress || 'Pending customer address confirmation',
    });
    setShowOrderModal(false);
  };

  const handleScheduleFollowUp = async () => {
    if (!currentAnalysis) return;
    await createFollowUpFromConversation(currentAnalysis.id, {
      customerId: currentAnalysis.customerId || undefined,
      customerName: customerNameInput.trim() || currentAnalysis.customerName || 'Customer',
      customerPhone: customerPhoneInput.trim() || currentAnalysis.customerPhone || '',
      reason: currentAnalysis.followUpReason || 'Follow up on WhatsApp inquiry',
      suggestedMessage: currentAnalysis.suggestedReply,
      dueDate: followUpDueDate,
    });
    setShowFollowUpModal(false);
  };

  // Helper colors for intents
  const getIntentBadge = (intent: string) => {
    switch (intent) {
      case 'purchase_intent':
        return { label: 'Purchase Intent', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'negotiation':
        return { label: 'Price Negotiation', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'availability_question':
        return { label: 'Stock Availability Check', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'price_question':
        return { label: 'Price Question', bg: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'delivery_question':
        return { label: 'Delivery & Shipping', bg: 'bg-cyan-100 text-cyan-800 border-cyan-300' };
      case 'complaint':
        return { label: 'Customer Support', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
      default:
        return { label: 'General Inquiry', bg: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const getLeadStageBadge = (stage: string) => {
    switch (stage) {
      case 'ready_to_buy':
        return { label: 'Ready to Buy 🔥', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'considering':
        return { label: 'Considering 🤔', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'interested':
        return { label: 'Interested ✨', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'purchased':
        return { label: 'Purchased ✅', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      default:
        return { label: 'New Lead 👤', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div id="conversation-analyzer-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold mb-3 border border-teal-500/30">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>WhatsApp Conversation → Sales Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Turn WhatsApp Conversations into Completed Sales
          </h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Paste raw customer chats from WhatsApp or Instagram. SellPilot instantly identifies the customer, matches catalog products, detects purchase readiness, writes a fact-grounded reply, and generates 1-click orders and follow-ups.
          </p>
        </div>
      </div>

      {/* Main Analyzer Input Card */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">Paste WhatsApp Conversation</h2>
          </div>

          {/* Tone Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Tone:</span>
            <select
              value={selectedTone}
              onChange={(e) => setSelectedTone(e.target.value as ResponseTone)}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="friendly">Friendly & Cheerful</option>
              <option value="nigerian_business">Nigerian Business</option>
              <option value="pidgin">Nigerian Pidgin</option>
              <option value="professional">Professional</option>
              <option value="persuasive">Persuasive</option>
              <option value="casual">Casual</option>
            </select>
          </div>
        </div>

        {/* Quick Scenario Samples for Instant Testing */}
        {scenariosToDisplay.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500">
              {isDemoStore ? 'Try a sample customer scenario:' : 'Try a sample scenario from your catalog:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {scenariosToDisplay.map((scenario, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectSample(scenario.text)}
                  className="text-xs font-medium bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg transition-all text-left flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  <span>{scenario.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Textarea Input */}
        <div className="relative">
          <textarea
            id="conversation-input-textarea"
            rows={4}
            value={conversationInput}
            onChange={(e) => setConversationInput(e.target.value)}
            placeholder={
              products && products.length > 0
                ? `Paste customer chat here...\n\nExample:\nCustomer: Hi, is the "${products[0].name}" in stock? How much is delivery to my address?`
                : `Paste customer chat here from WhatsApp or Instagram...\n\nExample:\nCustomer: Good day, I am interested in placing an order. How much is delivery?`
            }
            className="w-full text-sm p-4 bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400 font-mono resize-y"
          />
        </div>

        {/* Action Trigger */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400">
            {conversationInput.length > 0 ? `${conversationInput.length} characters` : 'Zero manual tagging required'}
          </span>

          <div className="flex items-center gap-2">
            {conversationInput && (
              <button
                type="button"
                onClick={() => setConversationInput('')}
                className="text-xs text-slate-500 hover:text-slate-800 px-3 py-2 rounded-xl transition-colors"
              >
                Clear
              </button>
            )}
            <button
              id="analyze-conversation-btn"
              type="button"
              disabled={isAnalyzing || !conversationInput.trim()}
              onClick={() => handleAnalyze()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Extracting Sales Intelligence...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Conversation</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Analysis Display */}
      {currentAnalysis && (
        <div id="analysis-results-container" className="space-y-6">
          {/* Intelligence Overview Bar */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Intent */}
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                  getIntentBadge(currentAnalysis.detectedIntent).bg
                }`}
              >
                {getIntentBadge(currentAnalysis.detectedIntent).label}
              </span>

              {/* Lead Stage */}
              <span
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  getLeadStageBadge(currentAnalysis.leadStage).bg
                }`}
              >
                {getLeadStageBadge(currentAnalysis.leadStage).label}
              </span>

              {/* Interest Level */}
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Interest: <strong className="uppercase">{currentAnalysis.interestLevel}</strong>
              </span>

              {/* Purchase Likelihood */}
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Purchase Likelihood: <strong className="uppercase">{currentAnalysis.purchaseLikelihood}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Grounded in store catalog & settings ({currentAnalysis.confidence}% confidence)</span>
            </div>
          </div>

          {/* Two-Column Intelligence Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Customer, Products & Context (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Customer Detection Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-bold text-slate-900">Customer Identification</h3>
                  </div>

                  {currentAnalysis.customerId ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Linked Store Customer
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerNameInput(currentAnalysis.customerName || '');
                        setCustomerPhoneInput(currentAnalysis.customerPhone || '');
                        setShowCustomerModal(true);
                      }}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Save as Customer</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">Customer Name</span>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {currentAnalysis.customerName || (
                        <span className="text-slate-400 font-normal italic">Not specified in chat</span>
                      )}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">Phone Number</span>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {currentAnalysis.customerPhone || (
                        <span className="text-slate-400 font-normal italic">Not specified in chat</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Product Detection & Catalog Match Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-bold text-slate-900">Detected Catalog Products</h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    {currentAnalysis.productsDetected.length} items detected
                  </span>
                </div>

                {currentAnalysis.productsDetected.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    No specific products mentioned in this conversation.
                  </p>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    {currentAnalysis.productsDetected.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          item.matchedInCatalog
                            ? 'bg-slate-50/70 border-slate-200'
                            : 'bg-amber-50/70 border-amber-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {item.matchedInCatalog ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            )}
                            <p className="text-sm font-bold text-slate-900">{item.name}</p>
                            {item.variantDiscussed && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                                {item.variantDiscussed}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pl-6">
                            {item.matchedInCatalog ? (
                              <>
                                <span>Catalog Price: <strong className="text-slate-800">{formatNaira(item.catalogPrice || 0)}</strong></span>
                                <span>•</span>
                                <span>Current Stock: <strong className="text-slate-800">{item.currentStock ?? 0} units</strong></span>
                                <span>•</span>
                                <span>Qty Discussed: <strong className="text-slate-800">{item.quantityDiscussed}</strong></span>
                              </>
                            ) : (
                              <span className="text-amber-800 font-semibold">
                                Item not listed in catalog. AI will strictly avoid claiming stock or quoting fake prices.
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          {item.matchedInCatalog ? (
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                item.isAvailable
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                              Unlisted Item
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inquiries, Objections & Missing Info Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm font-bold text-slate-900">Conversation Insights & Nuances</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Questions */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Questions Asked</span>
                    {currentAnalysis.questionsAsked.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">None identified</p>
                    ) : (
                      <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                        {currentAnalysis.questionsAsked.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Objections */}
                  <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-1">
                    <span className="text-[11px] font-bold text-amber-800 uppercase">Objections / Delays</span>
                    {currentAnalysis.objections.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No objections raised</p>
                    ) : (
                      <ul className="text-xs text-amber-900 space-y-1 list-disc list-inside">
                        {currentAnalysis.objections.map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Missing Info */}
                  <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-1">
                    <span className="text-[11px] font-bold text-blue-800 uppercase">Missing Information</span>
                    {currentAnalysis.missingInformation.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">All details present</p>
                    ) : (
                      <ul className="text-xs text-blue-900 space-y-1 list-disc list-inside">
                        {currentAnalysis.missingInformation.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Recommended Action Callout */}
              <div className="bg-teal-50 border border-teal-200 p-4 rounded-2xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wide">
                    Recommended Next Action
                  </h4>
                  <p className="text-sm font-semibold text-teal-800">
                    {currentAnalysis.recommendedAction}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Suggested Reply & 1-Click Action Triggers (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* WhatsApp Suggested Reply Bubble */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">Grounded Suggested Reply</h3>
                  </div>

                  {/* WhatsApp Brand Badge */}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                    WhatsApp Ready
                  </span>
                </div>

                {/* WhatsApp message bubble */}
                <div className="bg-[#E7F8EE] border border-[#D0F0DC] p-4 rounded-2xl text-slate-900 text-sm whitespace-pre-wrap leading-relaxed shadow-sm font-sans relative">
                  {currentAnalysis.suggestedReply}
                </div>

                {/* Action Buttons for Reply */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyReply}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                  >
                    {copiedReply ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedReply ? 'Copied!' : 'Copy Reply'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in WhatsApp</span>
                  </button>
                </div>

                {/* Quick Adjusters */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Adjust Response:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={isAdjusting}
                      onClick={() => handleAdjustReply('shorter')}
                      className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Shorter
                    </button>
                    <button
                      type="button"
                      disabled={isAdjusting}
                      onClick={() => handleAdjustReply('professional')}
                      className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Professional
                    </button>
                    <button
                      type="button"
                      disabled={isAdjusting}
                      onClick={() => handleAdjustReply('friendly')}
                      className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Friendly
                    </button>
                    <button
                      type="button"
                      disabled={isAdjusting}
                      onClick={() => handleAdjustReply('cta')}
                      className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Add CTA
                    </button>
                    <button
                      type="button"
                      disabled={isAdjusting}
                      onClick={() => handleAdjustReply('pidgin')}
                      className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Pidgin
                    </button>
                  </div>
                </div>
              </div>

              {/* The "Conversation → Action" Execution Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Execute Sales Actions</span>
                </h3>

                <p className="text-xs text-slate-500">
                  Turn this conversation directly into business records without manual data re-entry.
                </p>

                <div className="space-y-2.5 pt-1">
                  {/* Order Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerNameInput(currentAnalysis.customerName || '');
                      setCustomerPhoneInput(currentAnalysis.customerPhone || '');
                      setShowOrderModal(true);
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-900 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Create Order from Chat</p>
                        <p className="text-[11px] text-emerald-700">
                          {currentAnalysis.orderOpportunity
                            ? 'Ready to buy • In-stock items detected'
                            : 'Configure items, delivery fee and reserve stock'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Follow-Up Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerNameInput(currentAnalysis.customerName || '');
                      setCustomerPhoneInput(currentAnalysis.customerPhone || '');
                      setShowFollowUpModal(true);
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-teal-50 hover:bg-teal-100/80 border border-teal-200 text-teal-900 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Schedule Follow-up Reminder</p>
                        <p className="text-[11px] text-teal-700">
                          {currentAnalysis.followUpRecommended ? 'Recommended: Customer postponed or considering' : 'Keep lead warm and close sales'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Customer Button */}
                  {!currentAnalysis.customerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerNameInput(currentAnalysis.customerName || '');
                        setCustomerPhoneInput(currentAnalysis.customerPhone || '');
                        setShowCustomerModal(true);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-700 text-white flex items-center justify-center">
                          <UserPlus className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">Add to Customer Directory</p>
                          <p className="text-[11px] text-slate-500">Save profile and chat timeline</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History of Analyzed Conversations */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Analyzed Conversations History</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {conversations.length} total analyzed
          </span>
        </div>

        {conversations.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-3">No conversations analyzed yet.</p>
        ) : (
          <div className="space-y-2 pt-1">
            {conversations.map((c) => {
              const isSelected = activeConversation?.id === c.id;
              const intentInfo = getIntentBadge(c.detectedIntent);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConversation(c)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-500/20'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {c.customerName || 'Inquiry'}
                      </span>
                      {c.customerPhone && (
                        <span className="text-xs text-slate-500">({c.customerPhone})</span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${intentInfo.bg}`}>
                        {intentInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 italic">
                      "{c.rawConversation}"
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{formatDate(c.createdAt)}</span>
                    <ChevronDown className="w-4 h-4 -rotate-90 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* --- MODAL 1: CREATE ORDER FROM CONVERSATION --- */}
      {showOrderModal && currentAnalysis && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Create Order from Conversation</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              This will create a new order, calculate integer monetary totals, and automatically decrement product inventory.
            </p>

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Customer Name</label>
                <input
                  type="text"
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                  placeholder="e.g. Tunde Balogun"
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Phone Number</label>
                <input
                  type="text"
                  value={customerPhoneInput}
                  onChange={(e) => setCustomerPhoneInput(e.target.value)}
                  placeholder="e.g. 08031234567"
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
                />
              </div>
            </div>

            {/* Delivery Address */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase">Delivery Address</label>
              <input
                type="text"
                value={orderDeliveryAddress}
                onChange={(e) => setOrderDeliveryAddress(e.target.value)}
                placeholder="e.g. 14 Admiralty Way, Lekki Phase 1, Lagos"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
              />
            </div>

            {/* Financial Details */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Delivery Fee (₦)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={orderDeliveryFee}
                  onChange={(e) => setOrderDeliveryFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Discount (₦)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={orderDiscount}
                  onChange={(e) => setOrderDiscount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
                />
              </div>
            </div>

            {/* Items Summary */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Items Included</span>
              {currentAnalysis.productsDetected.filter((p) => p.matchedInCatalog).length === 0 ? (
                <p className="text-xs text-rose-600 font-semibold">
                  No catalog products available. Please add products to store first.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {currentAnalysis.productsDetected
                    .filter((p) => p.matchedInCatalog)
                    .map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">
                          {p.name} {p.variantDiscussed ? `(${p.variantDiscussed})` : ''} x {p.quantityDiscussed}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatNaira((p.catalogPrice || 0) * (p.quantityDiscussed || 1))}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrder}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                Confirm & Create Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: SCHEDULE FOLLOW-UP --- */}
      {showFollowUpModal && currentAnalysis && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">Schedule Follow-up Reminder</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFollowUpModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase">Customer Name</label>
              <input
                type="text"
                value={customerNameInput}
                onChange={(e) => setCustomerNameInput(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase">Follow-up Reason</label>
              <input
                type="text"
                defaultValue={currentAnalysis.followUpReason || 'Customer postponed decision'}
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase">Due Date</label>
              <input
                type="date"
                value={followUpDueDate}
                onChange={(e) => setFollowUpDueDate(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFollowUpModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleFollowUp}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-sm"
              >
                Schedule Follow-up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: SAVE AS CUSTOMER --- */}
      {showCustomerModal && currentAnalysis && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">Save as New Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase">Name</label>
              <input
                type="text"
                value={customerNameInput}
                onChange={(e) => setCustomerNameInput(e.target.value)}
                placeholder="e.g. Fatima Mohammed"
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase">Phone</label>
              <input
                type="text"
                value={customerPhoneInput}
                onChange={(e) => setCustomerPhoneInput(e.target.value)}
                placeholder="e.g. 08029876543"
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase">Location</label>
              <input
                type="text"
                value={customerLocationInput}
                onChange={(e) => setCustomerLocationInput(e.target.value)}
                placeholder="e.g. Abuja"
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl mt-1 text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-sm"
              >
                Save Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
