import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { Navigation } from './components/Navigation';
import { ToastContainer } from './components/ToastContainer';
import { DashboardView } from './components/views/DashboardView';
import { ProductsView } from './components/views/ProductsView';
import { CustomersView } from './components/views/CustomersView';
import { OrdersView } from './components/views/OrdersView';
import { AIAssistantView } from './components/views/AIAssistantView';
import { ConversationAnalyzerView } from './components/views/ConversationAnalyzerView';
import { FollowUpsView } from './components/views/FollowUpsView';
import { SettingsView } from './components/views/SettingsView';
import { OnboardingModal } from './components/modals/OnboardingModal';
import { AuthModal } from './components/modals/AuthModal';
import { TrialBanner } from './components/subscription/TrialBanner';
import { UpgradeModal } from './components/subscription/UpgradeModal';
import { PaymentCallbackView } from './components/views/PaymentCallbackView';

const MainContent: React.FC = () => {
  const { activeSection, setActiveSection, isLoggedIn, isOnboarding, isInitialized } = useApp();
  const [isCallbackDismissed, setIsCallbackDismissed] = useState(false);

  // Check if current URL is the Paystack callback route
  const isPaymentCallback =
    !isCallbackDismissed &&
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/payment/callback') ||
      window.location.search.includes('payment=callback') ||
      (window.location.search.includes('reference=') &&
        (window.location.search.includes('trxref=') || window.location.search.includes('sp_'))));

  // Show clean spinner while restoring authenticated session
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-teal-900/30 animate-pulse">
            ₦
          </div>
          <p className="text-xs font-semibold text-slate-400">Loading SellPilot...</p>
        </div>
      </div>
    );
  }

  // Strict route protection: unauthenticated users never render protected dashboard data
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 antialiased">
        <AuthModal />
        <ToastContainer />
      </div>
    );
  }

  // Handle Paystack payment callback view
  if (isPaymentCallback) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
        <main className="flex-1 flex flex-col justify-center p-4 max-w-4xl w-full mx-auto">
          <PaymentCallbackView
            onDismiss={(targetSection = 'dashboard') => {
              try {
                window.history.replaceState({}, document.title, '/');
              } catch {
                // ignore
              }
              setIsCallbackDismissed(true);
              setActiveSection(targetSection);
            }}
          />
        </main>
        <ToastContainer />
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardView />;
      case 'conversations':
        return <ConversationAnalyzerView />;
      case 'products':
        return <ProductsView />;
      case 'customers':
        return <CustomersView />;
      case 'orders':
        return <OrdersView />;
      case 'ai-assistant':
        return <AIAssistantView />;
      case 'follow-ups':
        return <FollowUpsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row antialiased">
      {/* Navigation */}
      <Navigation />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          {/* Subscription / Free Trial Alert Banner */}
          <TrialBanner />
          {renderSection()}
        </div>
      </main>

      {/* Overlays and Modals */}
      {isOnboarding && <OnboardingModal />}
      <UpgradeModal />
      <ToastContainer />
    </div>
  );
};

const AppWithSubscription: React.FC = () => {
  const { isLoggedIn } = useApp();
  return (
    <SubscriptionProvider isLoggedIn={isLoggedIn}>
      <MainContent />
    </SubscriptionProvider>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppWithSubscription />
    </AppProvider>
  );
}
