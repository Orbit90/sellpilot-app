export type SubscriptionPlanId = 'FREE_TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';

export type SubscriptionMetric = 'ai_analysis' | 'follow_up' | 'order' | 'customer' | 'product';

export type UserRole = 'merchant' | 'admin';

export interface PlanLimits {
  ai_analysis: number;
  follow_up: number;
  order: number;
  customer: number;
  product: number;
}

export interface PlanConfig {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  description?: string;
  priceNaira: number;
  billingInterval: '7_days' | 'monthly';
  durationDays?: number;
  limits: PlanLimits;
  features: string[];
  popular?: boolean;
}

export const PLAN_CONFIGS: Record<SubscriptionPlanId, PlanConfig> = {
  FREE_TRIAL: {
    id: 'FREE_TRIAL',
    name: '7-Day Free Trial',
    tagline: 'Complete access to test SellPilot on your WhatsApp chats',
    priceNaira: 0,
    billingInterval: '7_days',
    durationDays: 7,
    limits: {
      ai_analysis: 100,
      follow_up: 50,
      order: 50,
      customer: 100,
      product: 100,
    },
    features: [
      '7 days full access',
      '100 AI conversation analyses',
      '50 automated follow-up reminders',
      '50 order recordings & invoices',
      '100 customer profiles',
      '100 product catalog entries',
      'Instant WhatsApp reply generator',
    ],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Essential sales automation for growing Instagram & WhatsApp vendors',
    priceNaira: 5000,
    billingInterval: 'monthly',
    limits: {
      ai_analysis: 300,
      follow_up: 200,
      order: 500,
      customer: 1000,
      product: 500,
    },
    features: [
      '300 AI conversation analyses/month',
      '200 automated follow-ups/month',
      '500 orders/month',
      'Up to 1,000 saved customers',
      'Up to 500 product catalog items',
      'Nigerian Pidgin & English tone switcher',
      'WhatsApp invoice generation',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'High-volume deal closer for active social commerce stores',
    priceNaira: 10000,
    billingInterval: 'monthly',
    popular: true,
    limits: {
      ai_analysis: 1000,
      follow_up: 1000,
      order: 2000,
      customer: 5000,
      product: 2000,
    },
    features: [
      '1,000 AI conversation analyses/month',
      '1,000 automated follow-ups/month',
      '2,000 orders/month',
      'Up to 5,000 saved customers',
      'Up to 2,000 product catalog items',
      'Priority objection handling & AI closing',
      'Advanced customer purchase history',
      'Fast customer support',
    ],
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    tagline: 'Enterprise power & unlimited capacity for scale-up brands',
    priceNaira: 20000,
    billingInterval: 'monthly',
    limits: {
      ai_analysis: 5000,
      follow_up: 5000,
      order: 10000,
      customer: 25000,
      product: 10000,
    },
    features: [
      '5,000 AI conversation analyses/month',
      '5,000 automated follow-ups/month',
      '10,000 orders/month',
      'Up to 25,000 saved customers',
      'Up to 10,000 product catalog items',
      'Multi-team WhatsApp sales workflow',
      'High-throughput AI processing',
      'Dedicated account support',
    ],
  },
};

export const TRIAL_DURATION_DAYS = 7;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

export const PLAN_CONFIG_LIST: PlanConfig[] = Object.values(PLAN_CONFIGS);

export function getPlanConfig(planId?: string | null): PlanConfig {
  if (planId && planId in PLAN_CONFIGS) {
    return PLAN_CONFIGS[planId as SubscriptionPlanId];
  }
  return PLAN_CONFIGS.FREE_TRIAL;
}
