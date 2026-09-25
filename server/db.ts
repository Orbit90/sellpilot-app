import {
  usersRepo,
  businessesRepo,
  sessionsRepo,
  settingsRepo,
  productsRepo,
  customersRepo,
  ordersRepo,
  followUpsRepo,
  conversationsRepo,
  subscriptionsRepo,
  usageRepo,
  paymentsRepo,
  verificationTokensRepo,
  passwordResetTokensRepo,
  resetDemoData,
} from './db/repositories';
import { runMigrations, createRelationalSnapshot } from './db/migrate';
import { getPool, query, withTransaction, isExternalPostgres } from './db/pool';
import { DEMO_BUSINESS_ID, DEMO_USER_ID } from '../src/data/demoData';

export const db = {
  // Lifecycle & Pool
  init: async () => {
    await runMigrations();
  },
  persist: async () => {
    await createRelationalSnapshot();
  },
  resetDemo: async (businessId = DEMO_BUSINESS_ID) => {
    await resetDemoData(businessId);
    await createRelationalSnapshot();
  },
  isPostgresConnected: () => isExternalPostgres(),
  query,
  withTransaction,

  // Repositories
  users: {
    ...usersRepo,
    findAll: async () => {
      const res = await query('SELECT * FROM users');
      return res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role || 'merchant',
        businessId: r.business_id || '',
        emailVerified: r.email_verified === undefined || r.email_verified === null ? true : !!r.email_verified,
        emailVerifiedAt: r.email_verified_at ? new Date(r.email_verified_at).toISOString() : null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        passwordHash: r.password_hash,
        passwordSalt: r.password_salt,
      }));
    },
  },
  businesses: {
    ...businessesRepo,
    findAll: async () => {
      const res = await query('SELECT * FROM businesses');
      return res.rows.map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        name: r.name,
        category: r.category,
        description: r.description || '',
        logo: r.logo || undefined,
        phone: r.phone || '',
        location: r.location || '',
        currency: r.currency || '₦',
        deliveryInfo: r.delivery_info || '',
        returnPolicy: r.return_policy || '',
        paymentInstructions: r.payment_instructions || '',
        faqs: typeof r.faqs === 'string' ? JSON.parse(r.faqs) : r.faqs || [],
        onboardingCompleted: !!r.onboarding_completed,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));
    },
  },
  sessions: sessionsRepo,
  settings: settingsRepo,
  products: productsRepo,
  customers: customersRepo,
  orders: ordersRepo,
  followUps: followUpsRepo,
  conversations: conversationsRepo,
  subscriptions: subscriptionsRepo,
  usage: usageRepo,
  payments: paymentsRepo,
  verificationTokens: verificationTokensRepo,
  passwordResetTokens: passwordResetTokensRepo,

  // Legacy state accessor for quick demo bootstrap
  getState: () => {
    return {
      users: [{ id: DEMO_USER_ID, name: 'Amina Bello', email: 'amina@bellaluxe.ng', businessId: DEMO_BUSINESS_ID }],
      businesses: [{ id: DEMO_BUSINESS_ID, ownerId: DEMO_USER_ID, name: 'Bella Luxe Wears', category: 'fashion' }],
    };
  },
};

export { getPool, query, withTransaction };
