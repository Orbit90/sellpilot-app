import fs from 'fs';
import path from 'path';
import { getPool, initPool, query, withTransaction, isExternalPostgres, createEmbeddedPool } from './pool';
import {
  demoBusiness,
  demoCustomers,
  demoFollowUps,
  demoOrders,
  demoProducts,
  demoSettings,
  demoUser,
  DEMO_BUSINESS_ID,
  DEMO_USER_ID,
} from '../../src/data/demoData';
import { hashPassword } from '../auth';
import { syncOrderSequence } from './repositories';

const DATA_DIR = path.join(process.cwd(), 'data');
const JSON_DB_FILE = path.join(DATA_DIR, 'database.json');
const RELATIONAL_BACKUP_FILE = path.join(DATA_DIR, 'postgres_backup.json');

const demoCredentials = hashPassword('sellpilot123', 'demopilotsalt');

export async function runMigrations(): Promise<void> {
  // Initialize pool with connection test & graceful fallback
  let pool = await initPool();

  console.log('Running PostgreSQL database migrations...');

  const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
  let schemaSql = '';
  if (fs.existsSync(schemaPath)) {
    schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  }

  // Pre-schema column additions to ensure existing tables have required columns before indices are created
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
          ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'merchant';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
      END
      $$;
    `);
  } catch {
    // Non-fatal if table doesn't exist yet or if using non-standard dialect
  }

  if (schemaSql) {
    try {
      await pool.query(schemaSql);
      console.log('PostgreSQL schema applied successfully.');
    } catch (err: any) {
      if (isExternalPostgres()) {
        console.warn(`External PostgreSQL schema migration failed: ${err.message}. Seamlessly switching to embedded relational engine.`);
        pool = createEmbeddedPool();
        await pool.query(schemaSql);
        console.log('Embedded PostgreSQL schema applied successfully.');
      } else {
        throw err;
      }
    }
  }

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check if users table already has data
  const usersCheck = await query('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(usersCheck.rows[0]?.count || '0', 10);

  if (userCount === 0) {
    console.log('Database is empty. Checking for existing JSON data to migrate...');
    const imported = await importFromExistingJson();
    if (!imported) {
      console.log('No existing JSON data found. Seeding initial demo merchant data...');
      await seedInitialData();
    }
  } else {
    console.log(`Database already populated with ${userCount} user(s).`);
  }

  // Always ensure order sequence is synchronized with current orders
  await syncOrderSequence(pool);
  console.log('Order sequence synchronized with database.');

  // Ensure subscription schema, existing tenant subscriptions, and admin account
  await ensureSubscriptionsAndAdmin(pool);
  console.log('Subscription infrastructure and admin architecture synchronized.');

  // Ensure email verification schema & migration for existing users
  await ensureEmailVerificationSchema(pool);
  console.log('Email verification architecture synchronized.');

  // Ensure password reset schema
  await ensurePasswordResetSchema(pool);
  console.log('Password reset architecture synchronized.');
}

async function ensurePasswordResetSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);
  `);
}

async function ensureEmailVerificationSchema(pool: any): Promise<void> {
  // 1. Ensure email verification columns exist on users table
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT NOW();
  `);

  // 2. Ensure email_verification_tokens table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_evt_token_hash ON email_verification_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_evt_user_id ON email_verification_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
  `);
}

async function ensureSubscriptionsAndAdmin(pool: any): Promise<void> {
  // 1. Ensure columns exist on tables if schema was already created earlier
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'merchant'");

  // 2. Ensure subscriptions and usage_records exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'FREE_TRIAL',
      status TEXT NOT NULL DEFAULT 'trialing',
      trial_started_at TIMESTAMPTZ,
      trial_ends_at TIMESTAMPTZ,
      current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      current_period_end TIMESTAMPTZ NOT NULL,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_business_subscription UNIQUE (business_id)
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      metric TEXT NOT NULL,
      period_start TIMESTAMPTZ NOT NULL,
      period_end TIMESTAMPTZ NOT NULL,
      usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_biz_metric_period UNIQUE (business_id, metric, period_start, period_end)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL,
      amount BIGINT NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'NGN',
      reference TEXT UNIQUE NOT NULL,
      provider TEXT NOT NULL DEFAULT 'PAYSTACK',
      status TEXT NOT NULL DEFAULT 'pending',
      authorization_url TEXT,
      access_code TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_payments_business_id ON payments(business_id);
    CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  `);

  // 3. Ensure existing businesses have subscriptions
  const bizRows = await pool.query('SELECT id, created_at FROM businesses');
  for (const b of bizRows.rows) {
    const existing = await pool.query('SELECT id FROM subscriptions WHERE business_id = $1', [b.id]);
    if (existing.rows.length === 0) {
      const isDemo = b.id === DEMO_BUSINESS_ID;
      const now = new Date();
      const trialStart = b.created_at ? new Date(b.created_at) : now;
      const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const isExpired = !isDemo && now.getTime() > trialEnd.getTime();

      await pool.query(
        `INSERT INTO subscriptions (
          id, business_id, plan, status, trial_started_at, trial_ends_at,
          current_period_start, current_period_end, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (business_id) DO NOTHING`,
        [
          `sub_${b.id}_${Date.now()}`,
          b.id,
          isDemo ? 'BUSINESS' : 'FREE_TRIAL',
          isDemo ? 'active' : (isExpired ? 'expired' : 'trialing'),
          trialStart.toISOString(),
          trialEnd.toISOString(),
          trialStart.toISOString(),
          isDemo ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : trialEnd.toISOString(),
        ]
      );
    }
  }

  // 4. Ensure admin user exists if configured
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@sellpilot.ng').toLowerCase().trim();
  const existingAdmin = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR role = 'admin'", [adminEmail]);
  if (existingAdmin.rows.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();
    if (!adminPassword) {
      console.log('Skipping initial admin account creation: ADMIN_PASSWORD environment variable is not configured.');
    } else {
      const adminId = 'usr_admin_sellpilot';
      const { hash, salt } = hashPassword(adminPassword);
      
      const adminBizId = 'biz_admin_sellpilot';
      await pool.query(
        `INSERT INTO businesses (id, owner_id, name, category, description, onboarding_completed)
         VALUES ($1, $2, 'SellPilot Administration', 'other', 'System Admin Operations', TRUE)
         ON CONFLICT (id) DO UPDATE SET onboarding_completed = TRUE`,
        [adminBizId, adminId]
      );

      await pool.query(
        `INSERT INTO users (id, name, email, business_id, role, password_hash, password_salt)
         VALUES ($1, 'SellPilot Admin', $2, $3, 'admin', $4, $5)
         ON CONFLICT (id) DO UPDATE SET role = 'admin'`,
        [adminId, adminEmail, adminBizId, hash, salt]
      );

      await pool.query(
        `INSERT INTO subscriptions (id, business_id, plan, status, current_period_start, current_period_end)
         VALUES ($1, $2, 'BUSINESS', 'active', NOW(), NOW() + INTERVAL '10 years')
         ON CONFLICT (business_id) DO NOTHING`,
        [`sub_${adminBizId}`, adminBizId]
      );
      console.log(`Initial administrator user provisioned successfully for ${adminEmail}.`);
    }
  }
}

/**
 * Migrates data from existing data/database.json into the PostgreSQL schema.
 */
export async function importFromExistingJson(): Promise<boolean> {
  // Check if relational backup or database.json exists
  let sourceFile = '';
  if (fs.existsSync(RELATIONAL_BACKUP_FILE)) {
    sourceFile = RELATIONAL_BACKUP_FILE;
  } else if (fs.existsSync(JSON_DB_FILE)) {
    sourceFile = JSON_DB_FILE;
  } else {
    return false;
  }

  try {
    const raw = fs.readFileSync(sourceFile, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.users || !data.businesses) {
      return false;
    }

    console.log(`Importing existing data from ${sourceFile} into PostgreSQL...`);

    await withTransaction(async (client) => {
      // 1. Businesses
      for (const b of data.businesses || []) {
        await client.query(
          `INSERT INTO businesses (
            id, owner_id, name, category, description, logo, phone, location,
            currency, delivery_info, return_policy, payment_instructions,
            faqs, onboarding_completed, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING`,
          [
            b.id,
            b.ownerId || b.owner_id || 'usr_demo',
            b.name,
            b.category || 'fashion',
            b.description || '',
            b.logo || null,
            b.phone || '',
            b.location || '',
            b.currency || '₦',
            b.deliveryInfo || b.delivery_info || '',
            b.returnPolicy || b.return_policy || '',
            b.paymentInstructions || b.payment_instructions || '',
            JSON.stringify(b.faqs || []),
            !!(b.onboardingCompleted ?? b.onboarding_completed),
            b.createdAt || b.created_at || new Date().toISOString(),
            b.updatedAt || b.updated_at || new Date().toISOString(),
          ]
        );
      }

      // 2. Users
      for (const u of data.users || []) {
        await client.query(
          `INSERT INTO users (
            id, name, email, business_id, password_hash, password_salt, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING`,
          [
            u.id,
            u.name,
            u.email.toLowerCase().trim(),
            u.businessId || u.business_id || null,
            u.passwordHash || u.password_hash || demoCredentials.hash,
            u.passwordSalt || u.password_salt || demoCredentials.salt,
            u.createdAt || u.created_at || new Date().toISOString(),
            u.updatedAt || u.updated_at || new Date().toISOString(),
          ]
        );
      }

      // 3. Sessions
      for (const s of data.sessions || []) {
        await client.query(
          `INSERT INTO sessions (
            token, user_id, business_id, created_at, expires_at
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (token) DO NOTHING`,
          [
            s.token,
            s.userId || s.user_id,
            s.businessId || s.business_id,
            s.createdAt || s.created_at || new Date().toISOString(),
            s.expiresAt || s.expires_at,
          ]
        );
      }

      // 4. Business Settings
      for (const set of data.settings || []) {
        await client.query(
          `INSERT INTO business_settings (
            business_id, default_tone, language, pidgin_enabled, quick_replies, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (business_id) DO NOTHING`,
          [
            set.businessId || set.business_id,
            set.defaultTone || set.default_tone || 'friendly',
            set.language || 'English (Nigerian)',
            set.pidginEnabled ?? set.pidgin_enabled ?? true,
            JSON.stringify(set.quickReplies || set.quick_replies || []),
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        );
      }

      // 5. Products & Variants
      for (const p of data.products || []) {
        await client.query(
          `INSERT INTO products (
            id, business_id, name, price, category, description, images,
            stock_quantity, sku, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
            p.businessId || p.business_id,
            p.name,
            Math.max(0, Math.round(Number(p.price) || 0)),
            p.category || 'General',
            p.description || '',
            JSON.stringify(p.images || []),
            Math.max(0, Math.round(Number(p.stockQuantity ?? p.stock_quantity) || 0)),
            p.sku || '',
            p.status || 'active',
            p.createdAt || p.created_at || new Date().toISOString(),
            p.updatedAt || p.updated_at || new Date().toISOString(),
          ]
        );

        if (Array.isArray(p.variants)) {
          for (const v of p.variants) {
            await client.query(
              `INSERT INTO product_variants (
                id, product_id, business_id, name, stock, sku, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (id) DO NOTHING`,
              [
                v.id || `var_${Math.random().toString(36).substr(2, 9)}`,
                p.id,
                p.businessId || p.business_id,
                v.name,
                Math.max(0, Math.round(Number(v.stock) || 0)),
                v.sku || '',
                p.createdAt || p.created_at || new Date().toISOString(),
                p.updatedAt || p.updated_at || new Date().toISOString(),
              ]
            );
          }
        }
      }

      // 6. Customers
      for (const c of data.customers || []) {
        await client.query(
          `INSERT INTO customers (
            id, business_id, name, phone, email, location, orders_count,
            total_spent, last_order_date, status, notes, interactions,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING`,
          [
            c.id,
            c.businessId || c.business_id,
            c.name,
            c.phone,
            c.email || null,
            c.location || '',
            Math.max(0, Math.round(Number(c.ordersCount ?? c.orders_count) || 0)),
            Math.max(0, Math.round(Number(c.totalSpent ?? c.total_spent) || 0)),
            (c.lastOrderDate || c.last_order_date) ? new Date(c.lastOrderDate || c.last_order_date).toISOString() : null,
            c.status || 'New',
            c.notes || '',
            JSON.stringify(c.interactions || []),
            c.dateAdded || c.created_at || new Date().toISOString(),
            c.dateAdded || c.updated_at || new Date().toISOString(),
          ]
        );
      }

      // 7. Orders & Items
      for (const o of data.orders || []) {
        // Ensure customer foreign key is valid or NULL
        let custId: string | null = (o.customerId || o.customer_id)?.trim() || null;
        if (custId) {
          const custCheck = await client.query('SELECT 1 FROM customers WHERE id = $1', [custId]);
          if (custCheck.rowCount === 0) {
            custId = null;
          }
        }

        const subtotal = Math.max(0, Math.round(Number(o.productSubtotal ?? o.product_subtotal) || 0));
        const deliveryFee = Math.max(0, Math.round(Number(o.deliveryFee ?? o.delivery_fee) || 0));
        const discount = Math.max(0, Math.round(Number(o.discount) || 0));
        const total = Math.max(0, subtotal + deliveryFee - discount);

        await client.query(
          `INSERT INTO orders (
            id, business_id, customer_id, customer_name, customer_phone,
            product_subtotal, delivery_fee, discount, total,
            payment_status, order_status, delivery_address, notes,
            created_date, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO NOTHING`,
          [
            o.id,
            o.businessId || o.business_id,
            custId,
            o.customerName || o.customer_name,
            o.customerPhone || o.customer_phone || '',
            subtotal,
            deliveryFee,
            discount,
            total,
            o.paymentStatus || o.payment_status || 'Unpaid',
            o.orderStatus || o.order_status || 'New',
            o.deliveryAddress || o.delivery_address || '',
            o.notes || '',
            o.createdDate || o.created_date || new Date().toISOString(),
            o.createdDate || o.created_date || new Date().toISOString(),
          ]
        );

        if (Array.isArray(o.items)) {
          for (let i = 0; i < o.items.length; i++) {
            const it = o.items[i];
            const uPrice = Math.max(0, Math.round(Number(it.unitPrice ?? it.unit_price) || 0));
            const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
            const tPrice = uPrice * qty;

            let pId: string | null = (it.productId || it.product_id) || null;
            if (pId) {
              const pCheck = await client.query('SELECT 1 FROM products WHERE id = $1', [pId]);
              if (pCheck.rowCount === 0) pId = null;
            }

            await client.query(
              `INSERT INTO order_items (
                id, order_id, business_id, product_id, product_name,
                variant_name, quantity, unit_price, total_price, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (id) DO NOTHING`,
              [
                it.id || `item_${o.id}_${i}`,
                o.id,
                o.businessId || o.business_id,
                pId,
                it.productName || it.product_name || 'Item',
                it.variantName || it.variant_name || null,
                qty,
                uPrice,
                tPrice,
                o.createdDate || o.created_date || new Date().toISOString(),
              ]
            );
          }
        }
      }

      // 8. Follow-ups
      for (const f of data.followUps || data.follow_ups || []) {
        let custId: string | null = (f.customerId || f.customer_id)?.trim() || null;
        if (custId) {
          const cCheck = await client.query('SELECT 1 FROM customers WHERE id = $1', [custId]);
          if (cCheck.rowCount === 0) custId = null;
        }

        await client.query(
          `INSERT INTO follow_ups (
            id, business_id, customer_id, customer_name, customer_phone,
            reason, suggested_message, status, due_date, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING`,
          [
            f.id,
            f.businessId || f.business_id,
            custId,
            f.customerName || f.customer_name,
            f.customerPhone || f.customer_phone || '',
            f.reason,
            f.suggestedMessage || f.suggested_message || '',
            f.status || 'Pending',
            f.dueDate || f.due_date || new Date().toISOString(),
            f.createdAt || f.created_at || new Date().toISOString(),
            f.createdAt || f.created_at || new Date().toISOString(),
          ]
        );
      }

      // 9. Conversation Analyses
      for (const ca of data.conversationAnalyses || data.conversation_analyses || []) {
        let custId: string | null = (ca.customerId || ca.customer_id)?.trim() || null;
        if (custId) {
          const cCheck = await client.query('SELECT 1 FROM customers WHERE id = $1', [custId]);
          if (cCheck.rowCount === 0) custId = null;
        }

        await client.query(
          `INSERT INTO conversation_analyses (
            id, business_id, customer_id, customer_name, customer_phone,
            raw_conversation, detected_intent, lead_stage, interest_level,
            products_detected, questions_asked, objections, missing_information,
            purchase_likelihood, recommended_action, suggested_reply,
            follow_up_recommended, follow_up_reason, order_opportunity,
            order_items, delivery_fee_estimated, delivery_fee_confirmed,
            confidence, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
          ON CONFLICT (id) DO NOTHING`,
          [
            ca.id,
            ca.businessId || ca.business_id,
            custId,
            ca.customerName || ca.customer_name || null,
            ca.customerPhone || ca.customer_phone || null,
            ca.rawConversation || ca.raw_conversation,
            ca.detectedIntent || ca.detected_intent,
            ca.leadStage || ca.lead_stage,
            ca.interestLevel || ca.interest_level,
            JSON.stringify(ca.productsDetected || ca.products_detected || []),
            JSON.stringify(ca.questionsAsked || ca.questions_asked || []),
            JSON.stringify(ca.objections || []),
            JSON.stringify(ca.missingInformation || ca.missing_information || []),
            ca.purchaseLikelihood || ca.purchase_likelihood,
            ca.recommendedAction || ca.recommended_action,
            ca.suggestedReply || ca.suggested_reply,
            !!(ca.followUpRecommended ?? ca.follow_up_recommended),
            ca.followUpReason || ca.follow_up_reason || null,
            !!(ca.orderOpportunity ?? ca.order_opportunity),
            JSON.stringify(ca.orderItems || ca.order_items || []),
            ca.deliveryFeeEstimated ?? ca.delivery_fee_estimated ?? null,
            !!(ca.deliveryFeeConfirmed ?? ca.delivery_fee_confirmed),
            ca.confidence || 0,
            ca.createdAt || ca.created_at || new Date().toISOString(),
            ca.updatedAt || ca.updated_at || new Date().toISOString(),
          ]
        );
      }
    });

    console.log('Migration from JSON to PostgreSQL completed successfully.');
    return true;
  } catch (err) {
    console.error('Failed to import JSON data to PostgreSQL:', err);
    return false;
  }
}

/**
 * Seeds initial demo data if database is clean
 */
export async function seedInitialData(): Promise<void> {
  await withTransaction(async (client) => {
    // 1. Demo Business
    await client.query(
      `INSERT INTO businesses (
        id, owner_id, name, category, description, phone, location, currency,
        delivery_info, return_policy, payment_instructions, faqs, onboarding_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO NOTHING`,
      [
        demoBusiness.id,
        demoBusiness.ownerId,
        demoBusiness.name,
        demoBusiness.category,
        demoBusiness.description,
        demoBusiness.phone,
        demoBusiness.location,
        demoBusiness.currency,
        demoBusiness.deliveryInfo,
        demoBusiness.returnPolicy,
        demoBusiness.paymentInstructions,
        JSON.stringify(demoBusiness.faqs || []),
        demoBusiness.onboardingCompleted,
      ]
    );

    // 2. Demo User
    await client.query(
      `INSERT INTO users (
        id, name, email, business_id, password_hash, password_salt
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING`,
      [
        demoUser.id,
        demoUser.name,
        demoUser.email.toLowerCase().trim(),
        demoUser.businessId,
        demoCredentials.hash,
        demoCredentials.salt,
      ]
    );

    // 3. Demo Settings
    await client.query(
      `INSERT INTO business_settings (
        business_id, default_tone, language, pidgin_enabled, quick_replies
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (business_id) DO NOTHING`,
      [
        demoSettings.businessId,
        demoSettings.defaultTone,
        demoSettings.language,
        demoSettings.pidginEnabled ?? true,
        JSON.stringify(demoSettings.quickReplies || []),
      ]
    );

    // 4. Demo Products & Variants
    for (const p of demoProducts) {
      await client.query(
        `INSERT INTO products (
          id, business_id, name, price, category, description, images, stock_quantity, sku, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING`,
        [
          p.id,
          p.businessId,
          p.name,
          p.price,
          p.category,
          p.description,
          JSON.stringify(p.images || []),
          p.stockQuantity,
          p.sku,
          p.status,
        ]
      );

      if (Array.isArray(p.variants)) {
        for (const v of p.variants) {
          await client.query(
            `INSERT INTO product_variants (
              id, product_id, business_id, name, stock, sku
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING`,
            [v.id, p.id, p.businessId, v.name, v.stock, v.sku || '']
          );
        }
      }
    }

    // 5. Demo Customers
    for (const c of demoCustomers) {
      await client.query(
        `INSERT INTO customers (
          id, business_id, name, phone, email, location, orders_count, total_spent, last_order_date, status, notes, interactions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING`,
        [
          c.id,
          c.businessId,
          c.name,
          c.phone,
          c.email || null,
          c.location,
          c.ordersCount,
          c.totalSpent,
          c.lastOrderDate ? new Date(c.lastOrderDate).toISOString() : null,
          c.status,
          c.notes,
          JSON.stringify(c.interactions || []),
        ]
      );
    }

    // 6. Demo Orders & Items
    for (const o of demoOrders) {
      await client.query(
        `INSERT INTO orders (
          id, business_id, customer_id, customer_name, customer_phone,
          product_subtotal, delivery_fee, discount, total, payment_status,
          order_status, delivery_address, notes, created_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO NOTHING`,
        [
          o.id,
          o.businessId,
          o.customerId || null,
          o.customerName,
          o.customerPhone,
          o.productSubtotal,
          o.deliveryFee,
          o.discount,
          o.total,
          o.paymentStatus,
          o.orderStatus,
          o.deliveryAddress,
          o.notes || '',
          o.createdDate,
        ]
      );

      if (Array.isArray(o.items)) {
        for (let i = 0; i < o.items.length; i++) {
          const it = o.items[i];
          await client.query(
            `INSERT INTO order_items (
              id, order_id, business_id, product_id, product_name, variant_name, quantity, unit_price, total_price
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING`,
            [
              it.id || `item_${o.id}_${i}`,
              o.id,
              o.businessId,
              it.productId || null,
              it.productName,
              it.variantName || null,
              it.quantity,
              it.unitPrice,
              it.totalPrice,
            ]
          );
        }
      }
    }

    // 7. Demo Follow-ups
    for (const f of demoFollowUps) {
      await client.query(
        `INSERT INTO follow_ups (
          id, business_id, customer_id, customer_name, customer_phone, reason, suggested_message, status, due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING`,
        [
          f.id,
          f.businessId,
          f.customerId || null,
          f.customerName,
          f.customerPhone,
          f.reason,
          f.suggestedMessage,
          f.status,
          f.dueDate,
        ]
      );
    }
  });

  console.log('Seeded initial demo merchant data into PostgreSQL.');
}

/**
 * Creates a JSON snapshot of the relational database
 */
export async function createRelationalSnapshot(): Promise<void> {
  try {
    const users = (await query('SELECT * FROM users')).rows;
    const businesses = (await query('SELECT * FROM businesses')).rows;
    const products = (await query('SELECT * FROM products')).rows;
    const variants = (await query('SELECT * FROM product_variants')).rows;
    const customers = (await query('SELECT * FROM customers')).rows;
    const orders = (await query('SELECT * FROM orders')).rows;
    const orderItems = (await query('SELECT * FROM order_items')).rows;
    const followUps = (await query('SELECT * FROM follow_ups')).rows;
    const settings = (await query('SELECT * FROM business_settings')).rows;
    const sessions = (await query('SELECT * FROM sessions')).rows;
    const conversationAnalyses = (await query('SELECT * FROM conversation_analyses')).rows;
    let passwordResetTokens: any[] = [];
    try {
      passwordResetTokens = (await query('SELECT * FROM password_reset_tokens')).rows;
    } catch {
      // Non-fatal if table not created yet
    }

    const backup = {
      users,
      businesses,
      products,
      variants,
      customers,
      orders,
      orderItems,
      followUps,
      settings,
      sessions,
      conversationAnalyses,
      passwordResetTokens,
      exportedAt: new Date().toISOString(),
    };

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(RELATIONAL_BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to create relational snapshot:', err);
  }
}
