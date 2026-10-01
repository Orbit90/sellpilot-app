import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Lock,
  Copy,
  Check,
  RefreshCw,
  Power,
  Sliders,
  Users,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { AutopilotSettings, ChannelConnection } from '../../types';

export const WhatsAppChannelSettings: React.FC = () => {
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [connection, setConnection] = useState<ChannelConnection | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [verifyTokenConfigured, setVerifyTokenConfigured] = useState(false);
  const [autopilotSettings, setAutopilotSettings] = useState<AutopilotSettings>({
    mode: 'autopilot',
    autoReplyProductQuestions: true,
    autoReplyAvailability: true,
    autoReplyDelivery: true,
    autoReplyPurchaseIntent: true,
    allowAutoNegotiation: false,
    autoHandoffComplaints: true,
    autoHandoffUncertain: true,
    maxConsecutiveAutoReplies: 5,
    debounceSeconds: 3,
  });

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [handoffCount, setHandoffCount] = useState(0);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getWhatsAppChannelStatus();
      setConfigured(res.configured);
      setConnection(res.connection);
      setWebhookUrl(res.webhookUrl);
      setVerifyTokenConfigured(res.verifyTokenConfigured);
      if (res.autopilotSettings) {
        setAutopilotSettings(res.autopilotSettings);
      }

      // Load pending handoffs count
      const handoffsRes = await api.getWhatsAppHandoffs();
      setHandoffCount(handoffsRes.handoffs?.length || 0);
    } catch (err: any) {
      console.error('Failed to load WhatsApp channel status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setConnectError(null);

    try {
      if (!phoneNumberId.trim()) {
        throw new Error('Meta WhatsApp Phone Number ID is required.');
      }
      if (!accessToken.trim() || accessToken.trim().length < 15) {
        throw new Error('A valid Meta System User or Permanent Access Token is required.');
      }

      const res = await api.connectWhatsAppChannel({
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim() || undefined,
        accessToken: accessToken.trim(),
        displayName: displayName.trim() || undefined,
      });

      showToast('Official WhatsApp Business account connected successfully!', 'success');
      setIsConnectModalOpen(false);
      setAccessToken('');
      await loadStatus();
    } catch (err: any) {
      setConnectError(err?.message || 'Failed to connect WhatsApp account.');
    } finally {
      setConnecting(false);
    }
  };

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const executeDisconnect = async () => {
    try {
      await api.disconnectWhatsAppChannel();
      showToast('WhatsApp Business account disconnected.', 'info');
      setShowDisconnectConfirm(false);
      await loadStatus();
    } catch (err: any) {
      showToast('Failed to disconnect WhatsApp account: ' + err.message, 'error');
    }
  };

  const handleUpdateAutopilot = async (updates: Partial<AutopilotSettings>) => {
    const updated = { ...autopilotSettings, ...updates };
    setAutopilotSettings(updated);

    try {
      setSavingSettings(true);
      await api.updateAutopilotSettings(updated);
      showToast('Automation settings updated.', 'success');
    } catch (err: any) {
      showToast('Failed to save settings: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
    showToast('Webhook URL copied to clipboard', 'info');
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-slate-200 flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 text-teal-600 animate-spin mr-2" />
        <span className="text-xs text-slate-500 font-medium">Checking WhatsApp Cloud API status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Channel Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0 shadow-sm">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">WhatsApp</h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Official WhatsApp Business Platform
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Direct integration with Meta&apos;s Official Cloud API for real-time customer chats, grounded AI replies, and order automation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {configured && connection?.status === 'connected' ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected: {connection.displayName || connection.externalPhoneNumberId}</span>
                </span>
                {showDisconnectConfirm ? (
                  <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-xl border border-red-200">
                    <span className="text-[11px] font-bold text-red-700 px-1">Disconnect?</span>
                    <button
                      type="button"
                      onClick={executeDisconnect}
                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-red-600 hover:bg-red-500 text-white transition-colors"
                    >
                      Yes, Disconnect
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDisconnectConfirm(false)}
                      className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                id="connect-whatsapp-btn"
                onClick={() => setIsConnectModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Connect WhatsApp</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Callout */}
        {!configured || connection?.status !== 'connected' ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800">
                  WhatsApp connection is not configured yet.
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  To connect your store to official WhatsApp, you need an eligible Meta WhatsApp Business Account (WABA), a Meta App with the WhatsApp product added, and a Permanent System User Access Token.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">1. Meta Developer App</span>
                <span className="text-slate-500 text-[11px]">Create an app on developers.facebook.com with the WhatsApp product.</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">2. Verified Phone Number</span>
                <span className="text-slate-500 text-[11px]">Add your Nigerian business phone number to the WhatsApp Cloud API.</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">3. System User Token</span>
                <span className="text-slate-500 text-[11px]">Generate a permanent token with <code>whatsapp_business_messaging</code> scope.</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-900">Official Connection Verified</span>
              <span className="text-emerald-700 font-mono">WABA ID: {connection?.externalAccountId || 'N/A'}</span>
            </div>
            <p className="text-xs text-emerald-800">
              Incoming WhatsApp messages sent to <strong>{connection?.displayName || connection?.externalPhoneNumberId}</strong> are processed by SellPilot&apos;s conversation engine in real time.
            </p>
          </div>
        )}

        {/* Webhook Configuration Guide */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Meta Webhook Callback URL
            </span>
            <span className="text-[11px] text-slate-500">
              {verifyTokenConfigured ? 'Verify token active on server' : 'Configure WHATSAPP_WEBHOOK_VERIFY_TOKEN in .env'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-700 select-all"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(webhookUrl)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1 transition-colors"
            >
              {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Paste this URL into Meta App Dashboard &gt; WhatsApp &gt; Configuration &gt; Webhook, and subscribe to <code>messages</code>.
          </p>
        </div>
      </div>

      {/* Mode & Automation Safety Rules */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">Operating Mode & Autopilot Safety Layer</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control when SellPilot replies autonomously vs when it requests human merchant takeover.
            </p>
          </div>
          {handoffCount > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <span>{handoffCount} Awaiting Human Review</span>
            </span>
          )}
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleUpdateAutopilot({ mode: 'copilot' })}
            className={`p-4 rounded-xl border text-left transition-all ${
              autopilotSettings.mode === 'copilot'
                ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-500/20 shadow-sm'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">1. Copilot Mode (Manual Approval)</span>
              {autopilotSettings.mode === 'copilot' && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              SellPilot analyzes incoming WhatsApp messages and drafts grounded responses. You review and click Send manually. Zero automated messages sent.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleUpdateAutopilot({ mode: 'autopilot' })}
            className={`p-4 rounded-xl border text-left transition-all ${
              autopilotSettings.mode === 'autopilot'
                ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-500/20 shadow-sm'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">2. Autopilot Mode (24/7 AI Sales)</span>
              {autopilotSettings.mode === 'autopilot' && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              SellPilot immediately answers customer inquiries about product prices, stock, delivery fees, and bank transfers, adhering to your strict safety rules below.
            </p>
          </button>
        </div>

        {/* Safety Rule Toggles */}
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            Autopilot Safety Decision Rules
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Rule 1: Product Questions */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 block">Product & Price Inquiries</span>
                <span className="text-slate-500 text-[11px] block">Auto-quote prices strictly from active catalog items.</span>
              </div>
              <input
                type="checkbox"
                checked={autopilotSettings.autoReplyProductQuestions}
                onChange={(e) => handleUpdateAutopilot({ autoReplyProductQuestions: e.target.checked })}
                className="w-4 h-4 accent-teal-600 cursor-pointer rounded"
              />
            </div>

            {/* Rule 2: Delivery Questions */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 block">Delivery Rates & Logistics</span>
                <span className="text-slate-500 text-[11px] block">Auto-quote Lagos Mainland, Island, and nationwide fees.</span>
              </div>
              <input
                type="checkbox"
                checked={autopilotSettings.autoReplyDelivery}
                onChange={(e) => handleUpdateAutopilot({ autoReplyDelivery: e.target.checked })}
                className="w-4 h-4 accent-teal-600 cursor-pointer rounded"
              />
            </div>

            {/* Rule 3: Negotiation (Safety Rule) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 block">Allow Automated Price Negotiation</span>
                <span className="text-slate-500 text-[11px] block">
                  {autopilotSettings.allowAutoNegotiation
                    ? 'AI can offer minor standard discounts.'
                    : 'Default: Hand off price bargaining to human merchant.'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={autopilotSettings.allowAutoNegotiation}
                onChange={(e) => handleUpdateAutopilot({ allowAutoNegotiation: e.target.checked })}
                className="w-4 h-4 accent-teal-600 cursor-pointer rounded"
              />
            </div>

            {/* Rule 4: Complaint Handoff */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 block">Complaint & Refund Handoff</span>
                <span className="text-slate-500 text-[11px] block">Immediately stop AI and notify human merchant on customer grievance.</span>
              </div>
              <input
                type="checkbox"
                checked={autopilotSettings.autoHandoffComplaints}
                onChange={(e) => handleUpdateAutopilot({ autoHandoffComplaints: e.target.checked })}
                className="w-4 h-4 accent-teal-600 cursor-pointer rounded"
              />
            </div>

            {/* Rule 5: Uncertain AI Handoff */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 block">Low Confidence Handoff</span>
                <span className="text-slate-500 text-[11px] block">Hand off to merchant if buyer requests unlisted items or query is ambiguous.</span>
              </div>
              <input
                type="checkbox"
                checked={autopilotSettings.autoHandoffUncertain}
                onChange={(e) => handleUpdateAutopilot({ autoHandoffUncertain: e.target.checked })}
                className="w-4 h-4 accent-teal-600 cursor-pointer rounded"
              />
            </div>

            {/* Rule 6: Max Consecutive Replies */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 block">Loop Throttling Limit</span>
                <span className="text-slate-500 text-[11px] block">Max consecutive automated replies per conversation before handoff.</span>
              </div>
              <select
                value={autopilotSettings.maxConsecutiveAutoReplies}
                onChange={(e) => handleUpdateAutopilot({ maxConsecutiveAutoReplies: Number(e.target.value) })}
                className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold"
              >
                <option value={3}>3 replies</option>
                <option value={5}>5 replies</option>
                <option value={8}>8 replies</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Connect WhatsApp Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black tracking-tight">Connect WhatsApp Cloud API</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your official Meta Developer Platform credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnect} className="p-6 space-y-4">
              {connectError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{connectError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp Phone Number ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 104592837261549"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Found in Meta App Dashboard &gt; WhatsApp &gt; API Setup &gt; Phone number ID.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp Business Account (WABA) ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 198273645281920"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  System User / Permanent Access Token *
                </label>
                <input
                  type="password"
                  required
                  placeholder="EAAG..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Token is encrypted with AES-256-GCM server-side. Never exposed or logged.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Display Phone Number (Optional label)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +234 803 123 4567"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {connecting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{connecting ? 'Verifying with Meta...' : 'Verify & Connect Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
