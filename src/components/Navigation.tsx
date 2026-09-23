import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingBag,
  Sparkles,
  MessageSquareText,
  Clock,
  Settings,
  Plus,
  LogOut,
  Building2,
  ChevronRight,
  Download,
  Share2,
  CheckCircle2,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { useApp, NavSection } from '../context/AppContext';
import { useSubscription } from '../context/SubscriptionContext';

export const Navigation: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    business,
    user,
    logout,
    orders,
    followUps,
    products,
    setIsAddOrderOpen,
    setIsAddProductOpen,
    showToast,
  } = useApp();

  const { subscription, openUpgradeModal, isTrialActive, trialDaysLeft, isAdmin } = useSubscription();

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (!installPrompt) {
      showToast('To install, tap your browser menu and choose "Add to Home screen"', 'info');
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      showToast('SellPilot installed successfully!');
    }
    setInstallPrompt(null);
  };

  const pendingPayments = orders.filter((o) => o.paymentStatus === 'Payment Pending').length;
  const pendingFollowUps = followUps.filter((f) => f.status === 'Pending').length;
  const lowStockProducts = products.filter((p) => p.stockQuantity <= 4).length;

  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'conversations',
      label: 'WhatsApp Intel',
      icon: MessageSquareText,
    },
    {
      id: 'ai-assistant',
      label: 'AI Assistant',
      icon: Sparkles,
    },
    {
      id: 'products',
      label: 'Products',
      icon: Package,
      badge: lowStockProducts > 0 ? lowStockProducts : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    { id: 'customers', label: 'Customers', icon: Users },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingBag,
      badge: pendingPayments > 0 ? pendingPayments : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'follow-ups',
      label: 'Follow-ups',
      icon: Clock,
      badge: pendingFollowUps > 0 ? pendingFollowUps : undefined,
      badgeColor: 'bg-teal-100 text-teal-800',
    },
    { id: 'settings', label: 'Settings', icon: Settings },
    ...(user?.role === 'admin'
      ? [
          {
            id: 'admin-dashboard' as NavSection,
            label: 'Admin Portal',
            icon: ShieldCheck,
            badge: undefined,
            badgeColor: 'bg-teal-500/20 text-teal-300',
          },
        ]
      : []),
  ];

  return (
    <>
      {/* --- DESKTOP / TABLET SIDEBAR --- */}
      <aside
        id="desktop-sidebar"
        className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 select-none"
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-950/40 text-white font-black text-xl">
              ₦
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg text-white tracking-tight">SellPilot</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  MVP
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Turn conversations into sales</p>
            </div>
          </div>

          {/* Active Business card */}
          {business && (
            <div className="mt-4 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-md bg-teal-900/60 border border-teal-700/50 flex items-center justify-center text-teal-300 shrink-0 font-bold text-xs">
                  {business.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{business.name}</p>
                  <p className="text-[10px] text-slate-400 capitalize truncate">{business.category} • {business.location.split(',')[0]}</p>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Active store" />
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const isAI = item.id === 'ai-assistant';

            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? isAI
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold shadow-md shadow-teal-950/50'
                      : 'bg-teal-700/20 text-teal-300 font-semibold border border-teal-600/30'
                    : isAI
                    ? 'text-teal-400 hover:bg-slate-800/80 hover:text-teal-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? (isAI ? 'text-white' : 'text-teal-400') : isAI ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Action & Install Button */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Subscription Tier Pill */}
          {subscription && (
            <div
              id="sidebar-subscription-card"
              onClick={() => openUpgradeModal('PRO')}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20 transition-colors">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    <span>{subscription.planConfig.name}</span>
                    {isTrialActive && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300">
                        {trialDaysLeft}d left
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isAdmin ? 'Unlimited Access' : 'Manage Subscription'}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </div>
          )}

          {installPrompt && (
            <button
              id="install-pwa-btn"
              onClick={handleInstallPWA}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install SellPilot App</span>
            </button>
          )}

          <button
            id="quick-new-order-btn"
            onClick={() => setIsAddOrderOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Order</span>
          </button>

          {/* User profile / Logout */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2 truncate">
              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-[10px]">
                {user?.name.charAt(0) || 'U'}
              </div>
              <span className="truncate font-medium text-slate-300">{user?.name}</span>
            </div>
            <button
              id="logout-btn-desktop"
              onClick={logout}
              title="Sign Out"
              className="p-1.5 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* --- MOBILE TOP HEADER --- */}
      <header
        id="mobile-header"
        className="md:hidden sticky top-0 z-30 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-white"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-extrabold text-base shadow-sm">
            ₦
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight">SellPilot</span>
              <span className="text-[9px] font-bold px-1 rounded bg-teal-500/20 text-teal-300">NG</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[140px]">
              {business?.name || 'Turn conversations into sales'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {subscription && (
            <button
              id="mobile-subscription-btn"
              onClick={() => openUpgradeModal('PRO')}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-800 text-teal-300 border border-teal-500/20 flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-teal-400" />
              <span>{subscription.planConfig.name}</span>
            </button>
          )}
          <button
            id="mobile-quick-order-btn"
            onClick={() => setIsAddOrderOpen(true)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Order</span>
          </button>
          <button
            id="mobile-settings-btn"
            onClick={() => setActiveSection('settings')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeSection === 'settings' ? 'text-teal-400 bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
          {user?.role === 'admin' && (
            <button
              id="mobile-admin-btn"
              onClick={() => setActiveSection('admin-dashboard')}
              title="Admin Portal"
              className={`p-1.5 rounded-lg transition-colors ${
                activeSection === 'admin-dashboard' ? 'text-teal-300 bg-teal-900/60 border border-teal-500/40' : 'text-teal-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* --- MOBILE BOTTOM NAVIGATION --- */}
      <nav
        id="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around text-[10px]"
      >
        <button
          id="m-nav-dashboard"
          onClick={() => setActiveSection('dashboard')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition-colors ${
            activeSection === 'dashboard' ? 'text-teal-400 font-bold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </button>

        <button
          id="m-nav-conversations"
          onClick={() => setActiveSection('conversations')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition-colors ${
            activeSection === 'conversations' ? 'text-teal-400 font-bold' : 'text-slate-400'
          }`}
        >
          <MessageSquareText className="w-5 h-5 mb-0.5" />
          <span>Chat Intel</span>
        </button>

        <button
          id="m-nav-products"
          onClick={() => setActiveSection('products')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-lg transition-colors relative ${
            activeSection === 'products' ? 'text-teal-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span>Products</span>
          {lowStockProducts > 0 && (
            <span className="absolute top-0.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        {/* Prominent Center AI Assistant Button */}
        <button
          id="m-nav-ai-assistant"
          onClick={() => setActiveSection('ai-assistant')}
          className="flex flex-col items-center -mt-4"
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
              activeSection === 'ai-assistant'
                ? 'bg-gradient-to-tr from-teal-500 to-emerald-400 text-white ring-4 ring-slate-900 shadow-teal-900/60'
                : 'bg-teal-600 text-white ring-4 ring-slate-900'
            }`}
          >
            <Sparkles className="w-6 h-6" />
          </div>
          <span
            className={`mt-0.5 text-[10px] font-bold ${
              activeSection === 'ai-assistant' ? 'text-teal-400' : 'text-slate-300'
            }`}
          >
            AI Reply
          </span>
        </button>

        <button
          id="m-nav-orders"
          onClick={() => setActiveSection('orders')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-lg transition-colors relative ${
            activeSection === 'orders' ? 'text-teal-400 font-bold' : 'text-slate-400'
          }`}
        >
          <ShoppingBag className="w-5 h-5 mb-0.5" />
          <span>Orders</span>
          {pendingPayments > 0 && (
            <span className="absolute top-0.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          id="m-nav-follow-ups"
          onClick={() => setActiveSection('follow-ups')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-lg transition-colors relative ${
            activeSection === 'follow-ups' ? 'text-teal-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Clock className="w-5 h-5 mb-0.5" />
          <span>Follow-up</span>
          {pendingFollowUps > 0 && (
            <span className="absolute top-0.5 right-1.5 w-2 h-2 rounded-full bg-teal-400" />
          )}
        </button>
      </nav>
    </>
  );
};
