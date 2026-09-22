import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  MessageCircle,
  RefreshCw,
  Send,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Package,
  CreditCard,
  Truck,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { formatNaira, formatPhoneForWhatsApp } from '../../utils/formatters';
import { ResponseTone } from '../../types';

export const AIAssistantView: React.FC = () => {
  const {
    business,
    products,
    customers,
    selectedCustomerForAI,
    draftCustomerMessage,
    setDraftCustomerMessage,
    setSelectedCustomerForAI,
    showToast,
  } = useApp();

  const [customerMessage, setCustomerMessage] = useState(draftCustomerMessage || '');
  const [tone, setTone] = useState<ResponseTone>('friendly');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    selectedCustomerForAI?.id || ''
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReply, setGeneratedReply] = useState<string>('');
  const [replySource, setReplySource] = useState<string>('');
  const [missingInfoFlag, setMissingInfoFlag] = useState<boolean>(false);
  const [missingInfoNote, setMissingInfoNote] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [showCatalogContext, setShowCatalogContext] = useState(false);

  // Sync draft message from context if updated from other views
  useEffect(() => {
    if (draftCustomerMessage) {
      setCustomerMessage(draftCustomerMessage);
    }
  }, [draftCustomerMessage]);

  useEffect(() => {
    if (selectedCustomerForAI) {
      setSelectedCustomerId(selectedCustomerForAI.id);
    }
  }, [selectedCustomerForAI]);

  // Tone definitions
  const toneOptions: Array<{
    id: ResponseTone;
    label: string;
    description: string;
    badge: string;
  }> = [
    {
      id: 'friendly',
      label: 'Friendly',
      description: 'Warm, welcoming & cheerful with pleasant emojis',
      badge: '😊 Popular',
    },
    {
      id: 'nigerian_business',
      label: 'Nigerian Business',
      description: 'Courteous, respectful & polite commercial tone ("Good day", "Yes please")',
      badge: '🇳🇬 Local',
    },
    {
      id: 'nigerian_pidgin',
      label: 'Nigerian Pidgin',
      description: 'Natural Nigerian Pidgin ("How far? The shoe dey available...")',
      badge: '🗣️ Street smart',
    },
    {
      id: 'persuasive',
      label: 'Persuasive',
      description: 'Highlights scarcity, quality & drives fast WhatsApp conversions',
      badge: '🎯 High conversion',
    },
    {
      id: 'professional',
      label: 'Professional',
      description: 'Formal, concise, corporate & direct communication',
      badge: '👔 Corporate',
    },
    {
      id: 'casual',
      label: 'Casual',
      description: 'Relaxed, modern conversational tone for young buyers',
      badge: '💬 Chill',
    },
  ];

  // Preset realistic Nigerian WhatsApp inquiries for instant 1-tap testing
  const presetQueries = [
    {
      title: 'Price & Abuja Delivery',
      text: 'Good day, how much is the Casual Sneakers and do you deliver to Abuja?',
    },
    {
      title: 'Size & Payment on Delivery',
      text: 'Do you have size 42 in the Chelsea Boots? Can I pay on delivery in Lekki?',
    },
    {
      title: 'Bank Transfer Account',
      text: 'I want to take the Silk Wrap Dress. Please send your bank account details so I can transfer right now.',
    },
    {
      title: 'Return Policy Query',
      text: 'Hi, what happens if the dress does not fit me when it arrives? Can I exchange it?',
    },
    {
      title: 'Unlisted Item',
      text: 'Do you have wedding suits or traditional agbada in stock?',
    },
  ];

  const handleGenerateReply = async () => {
    if (!customerMessage.trim()) {
      showToast('Please enter or paste a customer message first', 'error');
      return;
    }

    try {
      setIsGenerating(true);
      setMissingInfoFlag(false);
      setMissingInfoNote(undefined);

      const result = await api.generateReply({
        customerMessage: customerMessage.trim(),
        tone,
        customerId: selectedCustomerId || undefined,
      });

      setGeneratedReply(result.reply);
      setReplySource(result.source);
      if (result.missingInfoFlag) {
        setMissingInfoFlag(true);
        setMissingInfoNote(result.missingInfoNote);
      }
      showToast('Reply generated successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate AI reply', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdjustment = async (adjustmentType: 'shorter' | 'professional' | 'friendly' | 'cta') => {
    if (!generatedReply) return;

    try {
      setIsGenerating(true);
      const result = await api.adjustReply({
        customerMessage,
        tone,
        adjustmentType,
        existingDraft: generatedReply,
      });

      setGeneratedReply(result.reply);
      showToast(`Adjusted: "${adjustmentType}"`);
    } catch (err: any) {
      showToast('Adjustment failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyReply = () => {
    if (!generatedReply) return;
    navigator.clipboard.writeText(generatedReply);
    setCopied(true);
    showToast('Reply copied to clipboard! Paste directly into WhatsApp');
    setTimeout(() => setCopied(false), 2500);
  };

  const selectedCustomerObj = customers.find((c) => c.id === selectedCustomerId);
  const targetPhone = selectedCustomerObj?.phone ? formatPhoneForWhatsApp(selectedCustomerObj.phone) : '';

  return (
    <div id="ai-assistant-view" className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-950 text-white p-6 rounded-3xl border border-teal-800/40 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Core Conversion Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">AI Sales Reply Assistant</h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Paste your customer's WhatsApp or Instagram DM. SellPilot crafts the highest-converting reply strictly backed by your real product prices in ₦, stock counts, and delivery guidelines.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-teal-300 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Anti-Hallucination Active</span>
          </div>
        </div>
      </div>

      {/* Preset Realistic Inquiry Chips */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <span>Quick Test Inquiries (Click to test):</span>
          </span>
          <span className="text-[11px] text-slate-400">Nigerian customer scenarios</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {presetQueries.map((pq, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCustomerMessage(pq.text);
                setDraftCustomerMessage(pq.text);
              }}
              className="text-left px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-50 hover:bg-teal-50 hover:text-teal-900 border border-slate-200 hover:border-teal-300 transition-all text-slate-700 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span>{pq.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Form: Input & Tone Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Message and Tone Options */}
        <div className="lg:col-span-7 space-y-4">
          {/* Customer Selection (Optional link to CRM) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Link to Customer (Optional):
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                const found = customers.find((c) => c.id === e.target.value);
                setSelectedCustomerForAI(found || null);
              }}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">General incoming inquiry (Unregistered)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) - {c.status}
                </option>
              ))}
            </select>
          </div>

          {/* Paste Message Textarea */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-teal-600" />
                <span>Customer's Incoming Message *</span>
              </label>
              {customerMessage && (
                <button
                  onClick={() => setCustomerMessage('')}
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            <textarea
              id="customer-message-input"
              rows={4}
              placeholder="Paste the message from WhatsApp, Instagram DM, or SMS here..."
              value={customerMessage}
              onChange={(e) => {
                setCustomerMessage(e.target.value);
                setDraftCustomerMessage(e.target.value);
              }}
              className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all leading-relaxed"
            />
          </div>

          {/* Tone Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Choose Response Tone:
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {toneOptions.map((t) => {
                const isSelected = tone === t.id;
                return (
                  <button
                    key={t.id}
                    id={`tone-btn-${t.id}`}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-600 ring-2 ring-teal-500/20 text-teal-900 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">{t.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">
                        {t.description}
                      </p>
                    </div>
                    <span className="text-[9px] font-bold text-teal-700 mt-2 inline-block">
                      {t.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            id="generate-ai-reply-btn"
            onClick={handleGenerateReply}
            disabled={isGenerating || !customerMessage.trim()}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-sm shadow-md shadow-teal-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>SellPilot is drafting reply...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Reply</span>
              </>
            )}
          </button>
        </div>

        {/* Right column: Generated Response & Quick Action Buttons */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Suggested Response</span>
              </span>
              {replySource && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {replySource === 'gemini' ? 'Gemini 3.8 Flash' : 'Grounding Rules'}
                </span>
              )}
            </div>

            {/* Missing Info Warning Callout if unlisted item */}
            {missingInfoFlag && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Missing Information Detected</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {missingInfoNote || 'This product or question is not in your current catalogue. SellPilot politely asked for clarification rather than hallucinating.'}
                  </p>
                </div>
              </div>
            )}

            {/* Reply Text Display / Editable Area */}
            {generatedReply ? (
              <div className="space-y-3">
                <textarea
                  id="generated-reply-text"
                  rows={8}
                  value={generatedReply}
                  onChange={(e) => setGeneratedReply(e.target.value)}
                  className="w-full p-4 text-sm bg-slate-50 border border-teal-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800 leading-relaxed font-sans"
                />

                {/* Quick Action Adjustment Buttons */}
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Refine & Adjust Draft:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="adjust-shorter-btn"
                      onClick={() => handleAdjustment('shorter')}
                      disabled={isGenerating}
                      className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 text-center transition-colors"
                    >
                      ✂️ Make Shorter
                    </button>
                    <button
                      id="adjust-prof-btn"
                      onClick={() => handleAdjustment('professional')}
                      disabled={isGenerating}
                      className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 text-center transition-colors"
                    >
                      👔 More Professional
                    </button>
                    <button
                      id="adjust-friendly-btn"
                      onClick={() => handleAdjustment('friendly')}
                      disabled={isGenerating}
                      className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 text-center transition-colors"
                    >
                      😊 More Friendly
                    </button>
                    <button
                      id="adjust-cta-btn"
                      onClick={() => handleAdjustment('cta')}
                      disabled={isGenerating}
                      className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 text-center transition-colors"
                    >
                      🚀 Add Call To Action
                    </button>
                  </div>
                </div>

                {/* Primary Copy & Send Actions */}
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    id="copy-reply-btn"
                    onClick={handleCopyReply}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Reply (1-Tap)</span>
                      </>
                    )}
                  </button>

                  <a
                    id="open-whatsapp-reply-btn"
                    href={
                      targetPhone
                        ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(generatedReply)}`
                        : `https://wa.me/?text=${encodeURIComponent(generatedReply)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-sm transition-colors text-center"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send to WhatsApp</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl p-6">
                <Sparkles className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500">
                  Your customized AI sales reply will appear here ready to review, adjust, and copy.
                </p>
              </div>
            )}
          </div>

          {/* Business Knowledge Grounding Accordion */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowCatalogContext(!showCatalogContext)}
              className="w-full p-4 text-left flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Store Knowledge Grounding ({products.length} Products Loaded)</span>
              </div>
              {showCatalogContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showCatalogContext && (
              <div className="p-4 pt-0 border-t border-slate-100 text-xs text-slate-600 space-y-3 bg-slate-50">
                <div>
                  <span className="font-bold text-slate-800 block mb-1">Active Catalog Prices:</span>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {products.map((p) => (
                      <div key={p.id} className="flex justify-between bg-white p-1.5 rounded border border-slate-200">
                        <span className="truncate pr-2">{p.name} ({p.stockQuantity} in stock)</span>
                        <span className="font-bold text-slate-900 shrink-0">{formatNaira(p.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-800 block mb-0.5">Delivery Policy:</span>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {business?.deliveryInfo || 'Nationwide delivery available via dispatch and courier.'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-800 block mb-0.5">Bank Payment Info:</span>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {business?.paymentInstructions || 'Direct bank transfer.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
