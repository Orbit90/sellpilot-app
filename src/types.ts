export type BusinessCategory =
  | 'fashion'
  | 'beauty'
  | 'food'
  | 'perfumes'
  | 'perfume'
  | 'phones'
  | 'accessories'
  | 'shoes'
  | 'hair'
  | 'other';

export type ResponseTone =
  | 'friendly'
  | 'professional'
  | 'persuasive'
  | 'casual'
  | 'nigerian_business'
  | 'pidgin'
  | 'nigerian_pidgin';

export type OrderStatus =
  | 'New'
  | 'Payment Pending'
  | 'Paid'
  | 'Processing'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus =
  | 'Unpaid'
  | 'Payment Pending'
  | 'Paid'
  | 'Refunded';

export type CustomerStatus =
  | 'New'
  | 'Interested'
  | 'Ordered'
  | 'Paid'
  | 'Repeat Customer'
  | 'VIP'
  | 'Follow-up Needed';

export type FollowUpStatus =
  | 'Pending'
  | 'Contacted'
  | 'Completed'
  | 'Cancelled';

export type {
  SubscriptionPlanId,
  SubscriptionStatus,
  SubscriptionMetric,
  UserRole,
  PlanLimits,
  PlanConfig,
} from './config/plans';
import type {
  SubscriptionPlanId,
  SubscriptionStatus,
  SubscriptionMetric,
  UserRole,
  PlanLimits,
  PlanConfig,
} from './config/plans';

export interface User {
  id: string;
  name: string;
  email: string;
  businessId: string;
  role?: UserRole;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  createdAt: string;
  passwordHash?: string;
  passwordSalt?: string;
}

export interface Subscription {
  id: string;
  businessId: string;
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  businessId: string;
  metric: SubscriptionMetric;
  periodStart: string;
  periodEnd: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionSummary {
  subscription: Subscription;
  planConfig: PlanConfig;
  isTrial: boolean;
  trialDaysLeft: number;
  isExpired: boolean;
  isActive: boolean;
  usage: Record<SubscriptionMetric, number>;
  limits: PlanLimits;
  isAdmin: boolean;
}

export interface Session {
  token: string;
  userId: string;
  businessId: string;
  createdAt: string;
  expiresAt: string;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  category: BusinessCategory;
  description: string;
  logo?: string;
  phone: string;
  location: string;
  currency: string; // '₦'
  deliveryInfo: string;
  returnPolicy: string;
  paymentInstructions: string;
  faqs?: Array<{ question: string; answer: string }>;
  createdAt: string;
  onboardingCompleted: boolean;
}

export interface ProductVariant {
  id: string;
  name: string; // e.g. "Size 42, Black"
  stock: number;
  sku?: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  price: number;
  category: string;
  description: string;
  images: string[];
  stockQuantity: number;
  sku: string;
  status: 'active' | 'inactive';
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInteraction {
  id: string;
  type: 'inquiry' | 'order' | 'followup' | 'note';
  summary: string;
  channel: 'WhatsApp' | 'Instagram' | 'Call' | 'Direct';
  timestamp: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email?: string;
  location: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate?: string;
  status: CustomerStatus;
  notes: string;
  dateAdded: string;
  interactions?: CustomerInteraction[];
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string; // e.g. "SP-1082"
  businessId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  productSubtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  deliveryAddress: string;
  notes?: string;
  createdDate: string;
}

export interface FollowUp {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  reason: string;
  suggestedMessage: string;
  status: FollowUpStatus;
  dueDate: string;
  createdAt: string;
}

export interface AIMessage {
  id: string;
  customerMessage: string;
  generatedReply: string;
  tone: ResponseTone;
  actionTaken?: 'copied' | 'adjusted' | 'sent';
  missingInfoFlag?: boolean;
  missingInfoNote?: string;
  timestamp: string;
}

export interface BusinessSettings {
  businessId: string;
  defaultTone: ResponseTone;
  language: string;
  pidginEnabled?: boolean;
  enablePidgin?: boolean;
  quickReplies: Array<{ title: string; template: string }>;
}

export interface DashboardStats {
  todaySales: number;
  totalOrders: number;
  pendingPaymentsCount: number;
  followUpsCount: number;
  lowStockCount: number;
  recentOrders: Order[];
  recentCustomers: Customer[];
}

export type ConversationIntent =
  | 'product_question'
  | 'price_question'
  | 'availability_question'
  | 'delivery_question'
  | 'payment_question'
  | 'purchase_intent'
  | 'complaint'
  | 'return_request'
  | 'negotiation'
  | 'general_question'
  | 'unclear';

export type LeadStage =
  | 'new_lead'
  | 'interested'
  | 'considering'
  | 'ready_to_buy'
  | 'purchased'
  | 'lost'
  | 'support';

export type InterestLevel = 'low' | 'medium' | 'high';

export interface DetectedProduct {
  name: string;
  productId?: string | null;
  matchedInCatalog: boolean;
  catalogPrice?: number | null;
  currentStock?: number | null;
  quantityDiscussed: number;
  variantDiscussed?: string | null;
  isAvailable: boolean;
}

export interface PotentialOrderItem {
  productId: string;
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ConversationAnalysis {
  id: string;
  businessId: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  rawConversation: string;
  detectedIntent: ConversationIntent;
  leadStage: LeadStage;
  interestLevel: InterestLevel;
  productsDetected: DetectedProduct[];
  questionsAsked: string[];
  objections: string[];
  missingInformation: string[];
  purchaseLikelihood: InterestLevel;
  recommendedAction: string;
  suggestedReply: string;
  followUpRecommended: boolean;
  followUpReason?: string;
  orderOpportunity: boolean;
  orderItems: PotentialOrderItem[];
  deliveryFeeEstimated?: number | null;
  deliveryFeeConfirmed?: boolean;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatusType = 'pending' | 'success' | 'failed' | 'abandoned';

export interface PaymentRecord {
  id: string;
  businessId: string;
  userId: string;
  plan: SubscriptionPlanId;
  amount: number; // In Kobo or Naira
  currency: string;
  reference: string;
  provider: 'PAYSTACK' | string;
  status: PaymentStatusType;
  authorizationUrl?: string | null;
  accessCode?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
