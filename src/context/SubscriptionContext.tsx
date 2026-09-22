import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  SubscriptionSummary,
  PlanConfig,
  SubscriptionPlanId,
  SubscriptionMetric,
} from '../types';
import { api } from '../services/api';
import { PLAN_CONFIG_LIST, getPlanConfig } from '../config/plans';

interface SubscriptionContextType {
  subscription: SubscriptionSummary | null;
  plans: PlanConfig[];
  isLoading: boolean;
  isUpgradeModalOpen: boolean;
  selectedUpgradePlan: SubscriptionPlanId | null;
  openUpgradeModal: (planId?: SubscriptionPlanId) => void;
  closeUpgradeModal: () => void;
  refreshSubscription: () => Promise<void>;
  initiateCheckout: (planId: SubscriptionPlanId) => Promise<any>;
  isAdmin: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  trialDaysLeft: number;
  canPerformAction: (metric: SubscriptionMetric) => boolean;
  getUsagePercent: (metric: SubscriptionMetric) => number;
  getRemainingAllowance: (metric: SubscriptionMetric) => number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{
  children: React.ReactNode;
  isLoggedIn: boolean;
}> = ({ children, isLoggedIn }) => {
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [plans, setPlans] = useState<PlanConfig[]>(PLAN_CONFIG_LIST);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<SubscriptionPlanId | null>(null);

  const openUpgradeModal = useCallback((planId?: SubscriptionPlanId) => {
    if (planId) {
      setSelectedUpgradePlan(planId);
    } else {
      // Default to PRO recommendation
      setSelectedUpgradePlan('PRO');
    }
    setIsUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(false);
    setSelectedUpgradePlan(null);
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!isLoggedIn) {
      setSubscription(null);
      return;
    }
    try {
      setIsLoading(true);
      const data = await api.getSubscription();
      setSubscription(data);
    } catch (err) {
      console.error('Failed to load subscription summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      refreshSubscription();
      api.getPlans().then(setPlans).catch(() => setPlans(PLAN_CONFIG_LIST));
    } else {
      setSubscription(null);
    }

    const handleQuotaExceeded = () => {
      refreshSubscription();
      openUpgradeModal('PRO');
    };

    window.addEventListener('sellpilot:quota_exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('sellpilot:quota_exceeded', handleQuotaExceeded);
    };
  }, [isLoggedIn, refreshSubscription, openUpgradeModal]);

  const initiateCheckout = useCallback(async (planId: SubscriptionPlanId) => {
    if (planId === 'FREE_TRIAL') {
      throw new Error('Free trial cannot be purchased.');
    }
    const result = await api.initializePaystackPayment(planId as 'STARTER' | 'PRO' | 'BUSINESS');
    if (result && result.status && result.data?.authorization_url) {
      window.location.href = result.data.authorization_url;
    }
    return result;
  }, []);

  const isAdmin = subscription?.isAdmin || false;
  const isTrialActive = !isAdmin && subscription?.isTrial === true && !subscription?.isExpired;
  const isTrialExpired = !isAdmin && subscription?.isTrial === true && subscription?.isExpired === true;
  const trialDaysLeft = subscription?.trialDaysLeft || 0;

  const canPerformAction = useCallback(
    (metric: SubscriptionMetric): boolean => {
      if (!subscription) return true;
      if (isAdmin) return true;
      if (subscription.isExpired) return false;

      const limit = subscription.limits[metric];
      if (limit === Infinity || limit === -1) return true;
      const current = subscription.usage[metric] || 0;
      return current < limit;
    },
    [subscription, isAdmin]
  );

  const getUsagePercent = useCallback(
    (metric: SubscriptionMetric): number => {
      if (!subscription) return 0;
      const limit = subscription.limits[metric];
      if (limit === Infinity || limit === -1 || limit === 0) return 0;
      const current = subscription.usage[metric] || 0;
      return Math.min(100, Math.round((current / limit) * 100));
    },
    [subscription]
  );

  const getRemainingAllowance = useCallback(
    (metric: SubscriptionMetric): number => {
      if (!subscription) return Infinity;
      if (isAdmin) return Infinity;
      const limit = subscription.limits[metric];
      if (limit === Infinity || limit === -1) return Infinity;
      const current = subscription.usage[metric] || 0;
      return Math.max(0, limit - current);
    },
    [subscription, isAdmin]
  );

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plans,
        isLoading,
        isUpgradeModalOpen,
        selectedUpgradePlan,
        openUpgradeModal,
        closeUpgradeModal,
        refreshSubscription,
        initiateCheckout,
        isAdmin,
        isTrialActive,
        isTrialExpired,
        trialDaysLeft,
        canPerformAction,
        getUsagePercent,
        getRemainingAllowance,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
