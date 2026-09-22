import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Business,
  BusinessSettings,
  ConversationAnalysis,
  Customer,
  FollowUp,
  Order,
  Product,
  ResponseTone,
  User,
} from '../types';
import { api, getAuthToken, setAuthToken } from '../services/api';

export type NavSection =
  | 'dashboard'
  | 'conversations'
  | 'products'
  | 'customers'
  | 'orders'
  | 'ai-assistant'
  | 'follow-ups'
  | 'settings';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  // Navigation
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;

  // Auth & Onboarding
  user: User | null;
  business: Business | null;
  isLoggedIn: boolean;
  isOnboarding: boolean;
  isInitialized: boolean;
  login: (email: string, password?: string) => Promise<void>;
  signup: (data: { name: string; email: string; password?: string; businessName: string; businessCategory?: string }) => Promise<void>;
  logout: () => Promise<void>;
  quickSwitchToDemo: () => Promise<void>;
  completeOnboarding: (data: any) => Promise<void>;

  // Data
  products: Product[];
  customers: Customer[];
  orders: Order[];
  followUps: FollowUp[];
  settings: BusinessSettings | null;
  isLoading: boolean;
  refreshData: () => Promise<void>;

  // Actions
  createProduct: (data: Partial<Product>) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  createCustomer: (data: Partial<Customer>) => Promise<Customer>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  createOrder: (data: any) => Promise<void>;
  updateOrder: (id: string, data: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;

  createFollowUp: (data: Partial<FollowUp>) => Promise<void>;
  updateFollowUp: (id: string, data: Partial<FollowUp>) => Promise<void>;
  deleteFollowUp: (id: string) => Promise<void>;

  updateBusinessProfile: (data: Partial<Business>) => Promise<void>;
  updateSettings: (data: Partial<BusinessSettings>) => Promise<void>;
  resetToDemoData: () => Promise<void>;

  // AI Helpers
  selectedCustomerForAI: Customer | null;
  setSelectedCustomerForAI: (cust: Customer | null) => void;
  draftCustomerMessage: string;
  setDraftCustomerMessage: (msg: string) => void;
  openAIAssistantWithMessage: (message: string, customer?: Customer) => void;

  // Customer Profile drawer
  viewingCustomer: Customer | null;
  setViewingCustomer: (cust: Customer | null) => void;

  // Conversations & Sales Intelligence
  conversations: ConversationAnalysis[];
  activeConversation: ConversationAnalysis | null;
  setActiveConversation: (conv: ConversationAnalysis | null) => void;
  analyzeConversation: (text: string, tone?: ResponseTone) => Promise<ConversationAnalysis>;
  createCustomerFromConversation: (
    convId: string,
    data: { name: string; phone: string; location?: string; notes?: string }
  ) => Promise<Customer>;
  createOrderFromConversation: (convId: string, data: any) => Promise<Order>;
  createFollowUpFromConversation: (convId: string, data: any) => Promise<FollowUp>;
  adjustConversationReply: (convId: string, adjustmentType: string) => Promise<string>;

  // Modals & UI helpers
  isAddProductOpen: boolean;
  setIsAddProductOpen: (open: boolean) => void;
  isAddOrderOpen: boolean;
  setIsAddOrderOpen: (open: boolean) => void;
  isAddCustomerOpen: boolean;
  setIsAddCustomerOpen: (open: boolean) => void;

  // Notifications
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [conversations, setConversations] = useState<ConversationAnalysis[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Selected customer for AI
  const [selectedCustomerForAI, setSelectedCustomerForAI] = useState<Customer | null>(null);
  const [draftCustomerMessage, setDraftCustomerMessage] = useState<string>('');
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Modal states
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch all data for current active tenant
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [pData, cData, oData, fData, bData, sData, convData] = await Promise.all([
        api.getProducts().catch(() => []),
        api.getCustomers().catch(() => []),
        api.getOrders().catch(() => []),
        api.getFollowUps().catch(() => []),
        api.getBusiness().catch(() => null),
        api.getSettings().catch(() => null),
        api.getConversations().catch(() => []),
      ]);

      setProducts(pData);
      setCustomers(cData);
      setOrders(oData);
      setFollowUps(fData);
      setConversations(convData);
      if (bData) {
        setBusiness(bData);
        if (!bData.onboardingCompleted) {
          setIsOnboarding(true);
        }
      }
      if (sData) setSettings(sData);
    } catch {
      showToast('Could not sync with server. Showing cached data.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Restore authenticated session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsLoggedIn(false);
        setIsInitialized(true);
        return;
      }

      try {
        const me = await api.getMe();
        setUser(me.user);
        setBusiness(me.business);
        setIsLoggedIn(true);
        if (!me.business.onboardingCompleted) {
          setIsOnboarding(true);
        }
        await refreshData();
      } catch (err: any) {
        // Token invalid or expired
        setAuthToken(null);
        setUser(null);
        setBusiness(null);
        setIsLoggedIn(false);
      } finally {
        setIsInitialized(true);
      }
    };

    initAuth();
  }, [refreshData]);

  const login = async (email: string, password?: string) => {
    try {
      const res = await api.login({ email, password });
      setAuthToken(res.token);
      setUser(res.user);
      setBusiness(res.business);
      setIsLoggedIn(true);
      if (!res.business.onboardingCompleted) {
        setIsOnboarding(true);
      } else {
        setIsOnboarding(false);
      }
      showToast(`Welcome back, ${res.user.name}!`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
      throw err;
    }
  };

  const signup = async (data: { name: string; email: string; password?: string; businessName: string; businessCategory?: string }) => {
    try {
      const res = await api.signup(data);
      setAuthToken(res.token);
      setUser(res.user);
      setBusiness(res.business);
      setIsLoggedIn(true);
      setIsOnboarding(true); // new signups trigger onboarding flow
      showToast(`Welcome to SellPilot, ${data.name}! Let's set up your store.`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Signup failed', 'error');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setBusiness(null);
    setProducts([]);
    setCustomers([]);
    setOrders([]);
    setFollowUps([]);
    setIsLoggedIn(false);
    setIsOnboarding(false);
    showToast('Signed out of SellPilot', 'info');
  };

  const quickSwitchToDemo = async () => {
    try {
      const res = await api.demoLogin();
      setAuthToken(res.token);
      setUser(res.user);
      setBusiness(res.business);
      setIsLoggedIn(true);
      setIsOnboarding(false);
      await refreshData();
      showToast('Welcome to the Zarah Styles demo store!');
    } catch {
      showToast('Failed to load demo workspace', 'error');
    }
  };

  const completeOnboarding = async (data: any) => {
    try {
      const res = await api.completeOnboarding(data);
      setBusiness(res.business);
      setIsOnboarding(false);
      showToast('🎉 Your business is ready to sell! Welcome to your dashboard.');
      setActiveSection('dashboard');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete onboarding', 'error');
      throw err;
    }
  };

  // Product Actions
  const createProduct = async (data: Partial<Product>) => {
    try {
      const newP = await api.createProduct(data);
      setProducts((prev) => [newP, ...prev]);
      showToast(`Product "${newP.name}" added successfully`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create product', 'error');
      throw err;
    }
  };

  const updateProduct = async (id: string, data: Partial<Product>) => {
    try {
      const updated = await api.updateProduct(id, data);
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      showToast(`Product "${updated.name}" updated`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update product', 'error');
      throw err;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast('Product deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete product', 'error');
      throw err;
    }
  };

  // Customer Actions
  const createCustomer = async (data: Partial<Customer>) => {
    try {
      const newC = await api.createCustomer(data);
      setCustomers((prev) => [newC, ...prev]);
      showToast(`Customer "${newC.name}" added`);
      return newC;
    } catch (err: any) {
      showToast(err.message || 'Failed to create customer', 'error');
      throw err;
    }
  };

  const updateCustomer = async (id: string, data: Partial<Customer>) => {
    try {
      const updated = await api.updateCustomer(id, data);
      setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
      if (viewingCustomer?.id === id) {
        setViewingCustomer(updated);
      }
      showToast(`Customer "${updated.name}" updated`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update customer', 'error');
      throw err;
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      await api.deleteCustomer(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (viewingCustomer?.id === id) setViewingCustomer(null);
      showToast('Customer record removed');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete customer', 'error');
      throw err;
    }
  };

  // Order Actions
  const createOrder = async (data: any) => {
    try {
      const newO = await api.createOrder(data);
      setOrders((prev) => [newO, ...prev]);
      showToast(`Order ${newO.id} created successfully!`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create order', 'error');
      throw err;
    }
  };

  const updateOrder = async (id: string, data: Partial<Order>) => {
    try {
      const updated = await api.updateOrder(id, data);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      showToast(`Order ${updated.id} status updated`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update order', 'error');
      throw err;
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      await api.deleteOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      showToast('Order removed');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete order', 'error');
      throw err;
    }
  };

  // Follow-up Actions
  const createFollowUp = async (data: Partial<FollowUp>) => {
    try {
      const newF = await api.createFollowUp(data);
      setFollowUps((prev) => [newF, ...prev]);
      showToast(`Follow-up reminder set for ${newF.customerName}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create follow-up', 'error');
      throw err;
    }
  };

  const updateFollowUp = async (id: string, data: Partial<FollowUp>) => {
    try {
      const updated = await api.updateFollowUp(id, data);
      setFollowUps((prev) => prev.map((f) => (f.id === id ? updated : f)));
      showToast(`Follow-up marked as ${updated.status}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update follow-up', 'error');
      throw err;
    }
  };

  const deleteFollowUp = async (id: string) => {
    try {
      await api.deleteFollowUp(id);
      setFollowUps((prev) => prev.filter((f) => f.id !== id));
      showToast('Follow-up deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete follow-up', 'error');
      throw err;
    }
  };

  // Settings & Business
  const updateBusinessProfile = async (data: Partial<Business>) => {
    try {
      const updated = await api.updateBusiness(data);
      setBusiness(updated);
      showToast('Business profile updated');
    } catch (err: any) {
      showToast(err.message || 'Failed to update business profile', 'error');
      throw err;
    }
  };

  const updateSettings = async (data: Partial<BusinessSettings>) => {
    try {
      const updated = await api.updateSettings(data);
      setSettings(updated);
      showToast('AI preferences saved');
    } catch (err: any) {
      showToast(err.message || 'Failed to update settings', 'error');
      throw err;
    }
  };

  const resetToDemoData = async () => {
    try {
      await api.resetDemoData();
      await refreshData();
      showToast('Sample demo data reloaded successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to reset demo data', 'error');
    }
  };

  const openAIAssistantWithMessage = (message: string, customer?: Customer) => {
    setDraftCustomerMessage(message);
    if (customer) {
      setSelectedCustomerForAI(customer);
    }
    setActiveSection('ai-assistant');
  };

  // --- CONVERSATION ANALYZER ACTIONS ---
  const analyzeConversation = async (text: string, tone?: ResponseTone): Promise<ConversationAnalysis> => {
    try {
      setIsLoading(true);
      const res = await api.analyzeConversation({ conversationText: text, tone });
      setConversations((prev) => [res, ...prev.filter((c) => c.id !== res.id)]);
      setActiveConversation(res);
      showToast('Conversation analyzed successfully!');
      return res;
    } catch (err: any) {
      showToast(err.message || 'Failed to analyze conversation', 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createCustomerFromConversation = async (
    convId: string,
    data: { name: string; phone: string; location?: string; notes?: string }
  ): Promise<Customer> => {
    try {
      const res = await api.createCustomerFromConversation(convId, data);
      setCustomers((prev) => [res.customer, ...prev.filter((c) => c.id !== res.customer.id)]);
      setConversations((prev) => prev.map((c) => (c.id === convId ? res.conversation : c)));
      if (activeConversation?.id === convId) {
        setActiveConversation(res.conversation);
      }
      showToast(`Customer ${res.customer.name} created!`);
      return res.customer;
    } catch (err: any) {
      showToast(err.message || 'Failed to create customer', 'error');
      throw err;
    }
  };

  const createOrderFromConversation = async (convId: string, data: any): Promise<Order> => {
    try {
      const res = await api.createOrderFromConversation(convId, data);
      setOrders((prev) => [res.order, ...prev.filter((o) => o.id !== res.order.id)]);
      setConversations((prev) => prev.map((c) => (c.id === convId ? res.conversation : c)));
      if (activeConversation?.id === convId) {
        setActiveConversation(res.conversation);
      }
      // Refresh products to show decremented inventory
      const pData = await api.getProducts().catch(() => []);
      setProducts(pData);
      showToast(`Order ${res.order.id} created! Total: ₦${res.order.total.toLocaleString()}`);
      return res.order;
    } catch (err: any) {
      showToast(err.message || 'Failed to create order', 'error');
      throw err;
    }
  };

  const createFollowUpFromConversation = async (convId: string, data: any): Promise<FollowUp> => {
    try {
      const res = await api.createFollowUpFromConversation(convId, data);
      setFollowUps((prev) => [res.followUp, ...prev.filter((f) => f.id !== res.followUp.id)]);
      setConversations((prev) => prev.map((c) => (c.id === convId ? res.conversation : c)));
      if (activeConversation?.id === convId) {
        setActiveConversation(res.conversation);
      }
      showToast('Follow-up scheduled!');
      return res.followUp;
    } catch (err: any) {
      showToast(err.message || 'Failed to schedule follow-up', 'error');
      throw err;
    }
  };

  const adjustConversationReply = async (convId: string, adjustmentType: string): Promise<string> => {
    try {
      const res = await api.adjustConversationReply(convId, { adjustmentType });
      setConversations((prev) => prev.map((c) => (c.id === convId ? res.conversation : c)));
      if (activeConversation?.id === convId) {
        setActiveConversation(res.conversation);
      }
      showToast('Reply adjusted!');
      return res.suggestedReply;
    } catch (err: any) {
      showToast(err.message || 'Failed to adjust reply', 'error');
      throw err;
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeSection,
        setActiveSection,
        user,
        business,
        isLoggedIn,
        isOnboarding,
        isInitialized,
        login,
        signup,
        logout,
        quickSwitchToDemo,
        completeOnboarding,
        products,
        customers,
        orders,
        followUps,
        settings,
        conversations,
        activeConversation,
        setActiveConversation,
        analyzeConversation,
        createCustomerFromConversation,
        createOrderFromConversation,
        createFollowUpFromConversation,
        adjustConversationReply,
        isLoading,
        refreshData,
        createProduct,
        updateProduct,
        deleteProduct,
        createCustomer,
        updateCustomer,
        deleteCustomer,
        createOrder,
        updateOrder,
        deleteOrder,
        createFollowUp,
        updateFollowUp,
        deleteFollowUp,
        updateBusinessProfile,
        updateSettings,
        resetToDemoData,
        selectedCustomerForAI,
        setSelectedCustomerForAI,
        draftCustomerMessage,
        setDraftCustomerMessage,
        openAIAssistantWithMessage,
        viewingCustomer,
        setViewingCustomer,
        isAddProductOpen,
        setIsAddProductOpen,
        isAddOrderOpen,
        setIsAddOrderOpen,
        isAddCustomerOpen,
        setIsAddCustomerOpen,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
