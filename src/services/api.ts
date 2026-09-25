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
  SubscriptionSummary,
  PlanConfig,
} from '../types';

const TOKEN_KEY = 'sellpilot_auth_token';

let authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

export function getAuthToken(): string | null {
  if (!authToken && typeof window !== 'undefined') {
    authToken = localStorage.getItem(TOKEN_KEY);
  }
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = 'Request failed';
    let errorCode: string | undefined;
    try {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
      errorCode = data.code;
    } catch {
      // ignore
    }

    if (res.status === 402 && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sellpilot:quota_exceeded', { detail: { message: errorMsg } })
      );
    }

    if (res.status === 403 && (errorCode === 'EMAIL_VERIFICATION_REQUIRED' || errorMsg.includes('verify your email')) && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sellpilot:email_verification_required', { detail: { message: errorMsg } })
      );
    }

    const err = new Error(errorMsg) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = errorCode;
    throw err;
  }

  return res.json();
}

export const api = {
  // Auth
  signup: (data: { name: string; email: string; password?: string; businessName: string; businessCategory?: string }) =>
    request<{ user: User; business: Business; token: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password?: string }) =>
    request<{ user: User; business: Business; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  demoLogin: () =>
    request<{ user: User; business: Business; token: string }>('/api/auth/demo', {
      method: 'POST',
    }),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getMe: () => request<{ user: User; business: Business }>('/api/auth/me'),

  resetPassword: (email: string) =>
    request<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  confirmResetPassword: (token: string, password: string) =>
    request<{ success: boolean; message: string }>('/api/auth/confirm-reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  verifyEmail: (token: string) =>
    request<{ success: boolean; message: string; user?: User }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  resendVerification: (email?: string) =>
    request<{ success: boolean; message: string; alreadyVerified?: boolean }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  completeOnboarding: (data: any) =>
    request<{ business: Business }>('/api/business/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Business
  getBusiness: () => request<Business>('/api/business/profile'),
  updateBusiness: (data: Partial<Business>) =>
    request<Business>('/api/business/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Settings
  getSettings: () => request<BusinessSettings>('/api/settings'),
  updateSettings: (data: Partial<BusinessSettings>) =>
    request<BusinessSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Products
  getProducts: () => request<Product[]>('/api/products'),
  createProduct: (data: Partial<Product>) =>
    request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProduct: (id: string, data: Partial<Product>) =>
    request<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProduct: (id: string) =>
    request<{ success: boolean }>(`/api/products/${id}`, {
      method: 'DELETE',
    }),

  // Customers
  getCustomers: () => request<Customer[]>('/api/customers'),
  createCustomer: (data: Partial<Customer>) =>
    request<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCustomer: (id: string, data: Partial<Customer>) =>
    request<Customer>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCustomer: (id: string) =>
    request<{ success: boolean }>(`/api/customers/${id}`, {
      method: 'DELETE',
    }),

  // Orders
  getOrders: () => request<Order[]>('/api/orders'),
  createOrder: (data: any) =>
    request<Order>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateOrder: (id: string, data: Partial<Order>) =>
    request<Order>(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteOrder: (id: string) =>
    request<{ success: boolean }>(`/api/orders/${id}`, {
      method: 'DELETE',
    }),

  // Follow-ups
  getFollowUps: () => request<FollowUp[]>('/api/follow-ups'),
  createFollowUp: (data: Partial<FollowUp>) =>
    request<FollowUp>('/api/follow-ups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateFollowUp: (id: string, data: Partial<FollowUp>) =>
    request<FollowUp>(`/api/follow-ups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteFollowUp: (id: string) =>
    request<{ success: boolean }>(`/api/follow-ups/${id}`, {
      method: 'DELETE',
    }),

  // AI Assistant
  generateReply: (data: { customerMessage: string; tone: ResponseTone; customerId?: string }) =>
    request<{ reply: string; tone: ResponseTone; source: string; missingInfoFlag?: boolean; missingInfoNote?: string }>(
      '/api/ai/generate-reply',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  adjustReply: (data: {
    customerMessage?: string;
    tone: ResponseTone;
    adjustmentType: 'shorter' | 'professional' | 'friendly' | 'cta';
    existingDraft: string;
  }) =>
    request<{ reply: string; tone: ResponseTone; source: string }>('/api/ai/adjust-reply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateFollowUp: (data: { customerName: string; customerId?: string; reason: string; tone?: ResponseTone }) =>
    request<{ message: string }>('/api/ai/generate-followup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Conversation Analyzer & Sales Intelligence
  getConversations: () => request<ConversationAnalysis[]>('/api/conversations'),

  getConversation: (id: string) => request<ConversationAnalysis>(`/api/conversations/${id}`),

  analyzeConversation: (data: { conversationText: string; tone?: ResponseTone }) =>
    request<ConversationAnalysis>('/api/conversations/analyze', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createCustomerFromConversation: (
    id: string,
    data: { name: string; phone: string; location?: string; notes?: string }
  ) =>
    request<{ customer: Customer; conversation: ConversationAnalysis }>(
      `/api/conversations/${id}/customer`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  createOrderFromConversation: (id: string, data: any) =>
    request<{ order: Order; conversation: ConversationAnalysis }>(
      `/api/conversations/${id}/order`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  createFollowUpFromConversation: (id: string, data: any) =>
    request<{ followUp: FollowUp; conversation: ConversationAnalysis }>(
      `/api/conversations/${id}/follow-up`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  adjustConversationReply: (id: string, data: { adjustmentType: string; tone?: ResponseTone }) =>
    request<{ suggestedReply: string; conversation: ConversationAnalysis }>(
      `/api/conversations/${id}/adjust-reply`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  // Subscription & Commercial Layer
  getSubscription: () => request<SubscriptionSummary>('/api/subscription'),

  getPlans: () => request<PlanConfig[]>('/api/plans'),

  getSubscriptionUsage: () =>
    request<{
      usage: Record<string, number>;
      limits: Record<string, number>;
      plan: string;
      planName: string;
    }>('/api/subscription/usage'),

  initiateCheckout: (planId: string) =>
    request<{
      checkoutUrl?: string;
      reference?: string;
      provider: string;
      status: string;
      message: string;
      amountNaira: number;
    }>('/api/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),

  getPaystackStatus: () =>
    request<{
      configured: boolean;
      mode: string;
      provider: string;
      message: string;
    }>('/api/paystack/status'),

  initializePaystackPayment: (plan: 'STARTER' | 'PRO' | 'BUSINESS') =>
    request<{
      status: boolean;
      message: string;
      data: {
        authorization_url: string;
        access_code: string;
        reference: string;
      };
    }>('/api/payments/paystack/initialize', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),

  verifyPaystackPayment: (reference: string) =>
    request<{
      status: boolean;
      message: string;
      alreadyProcessed?: boolean;
      data: {
        payment: any;
        subscription: any;
      };
    }>(`/api/payments/paystack/verify/${encodeURIComponent(reference)}`),

  // Admin APIs (Admin role only)
  getAdminSubscriptions: () => request<any[]>('/api/admin/subscriptions'),
  getAdminUsers: () => request<any[]>('/api/admin/users'),

  updateAdminUserSubscription: (
    userId: string,
    updates: { plan?: string; status?: string; durationDays?: number }
  ) =>
    request<any>(`/api/admin/users/${userId}/subscription`, {
      method: 'POST',
      body: JSON.stringify(updates),
    }),

  updateAdminSubscription: (businessId: string, updates: { plan?: string; status?: string; extendDays?: number }) =>
    request<any>(`/api/admin/subscriptions/${businessId}`, {
      method: 'POST',
      body: JSON.stringify(updates),
    }),

  setAdminUsage: (businessId: string, metric: string, count: number) =>
    request<any>(`/api/admin/subscriptions/${businessId}/set-usage`, {
      method: 'POST',
      body: JSON.stringify({ metric, count }),
    }),

  getAdminStats: () => request<any>('/api/admin/stats'),

  // Reset Demo Data
  resetDemoData: () =>
    request<{ success: boolean; message: string }>('/api/data/reset-demo', {
      method: 'POST',
    }),
};
