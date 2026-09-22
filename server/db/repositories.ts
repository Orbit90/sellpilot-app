import { query, withTransaction } from './pool';
import {
  Business,
  BusinessSettings,
  ConversationAnalysis,
  Customer,
  FollowUp,
  Order,
  OrderItem,
  Product,
  ProductVariant,
  Session,
  User,
  UserRole,
  Subscription,
  SubscriptionMetric,
  SubscriptionPlanId,
  SubscriptionStatus,
  UsageRecord,
  PaymentRecord,
} from '../../src/types';
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

// Helper to safely parse JSON or return default
function safeJsonParse<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

// ==========================================
// 1. USERS REPOSITORY
// ==========================================
export const usersRepo = {
  async findById(id: string): Promise<User | null> {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      businessId: r.business_id || '',
      role: (r.role as UserRole) || 'merchant',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      passwordHash: r.password_hash,
      passwordSalt: r.password_salt,
    };
  },

  async findByEmail(email: string): Promise<User | null> {
    const res = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      businessId: r.business_id || '',
      role: (r.role as UserRole) || 'merchant',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      passwordHash: r.password_hash,
      passwordSalt: r.password_salt,
    };
  },

  async create(user: User): Promise<User> {
    await query(
      `INSERT INTO users (id, name, email, business_id, role, password_hash, password_salt, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         business_id = EXCLUDED.business_id,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash,
         password_salt = EXCLUDED.password_salt,
         updated_at = NOW()`,
      [
        user.id,
        user.name,
        user.email.toLowerCase().trim(),
        user.businessId || null,
        user.role || 'merchant',
        user.passwordHash || null,
        user.passwordSalt || null,
        user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return user;
  },

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const existing = await usersRepo.findById(id);
    if (!existing) return null;

    const name = updates.name !== undefined ? updates.name : existing.name;
    const email = updates.email !== undefined ? updates.email.toLowerCase().trim() : existing.email;
    const businessId = updates.businessId !== undefined ? updates.businessId : existing.businessId;
    const role = updates.role !== undefined ? updates.role : existing.role || 'merchant';
    const passwordHash = updates.passwordHash !== undefined ? updates.passwordHash : existing.passwordHash;
    const passwordSalt = updates.passwordSalt !== undefined ? updates.passwordSalt : existing.passwordSalt;

    await query(
      `UPDATE users
       SET name = $1, email = $2, business_id = $3, role = $4, password_hash = $5, password_salt = $6, updated_at = NOW()
       WHERE id = $7`,
      [name, email, businessId || null, role, passwordHash || null, passwordSalt || null, id]
    );

    return usersRepo.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM users WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  },
};

// ==========================================
// 2. BUSINESSES REPOSITORY
// ==========================================
export const businessesRepo = {
  async findById(id: string): Promise<Business | null> {
    const res = await query('SELECT * FROM businesses WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
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
      faqs: safeJsonParse(r.faqs, []),
      onboardingCompleted: !!r.onboarding_completed,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  },

  async findByOwnerId(ownerId: string): Promise<Business | null> {
    const res = await query('SELECT * FROM businesses WHERE owner_id = $1', [ownerId]);
    if (res.rows.length === 0) return null;
    return businessesRepo.findById(res.rows[0].id);
  },

  async create(biz: Business): Promise<Business> {
    await query(
      `INSERT INTO businesses (
        id, owner_id, name, category, description, logo, phone, location,
        currency, delivery_info, return_policy, payment_instructions,
        faqs, onboarding_completed, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        phone = EXCLUDED.phone,
        location = EXCLUDED.location,
        delivery_info = EXCLUDED.delivery_info,
        return_policy = EXCLUDED.return_policy,
        payment_instructions = EXCLUDED.payment_instructions,
        faqs = EXCLUDED.faqs,
        onboarding_completed = EXCLUDED.onboarding_completed,
        updated_at = NOW()`,
      [
        biz.id,
        biz.ownerId,
        biz.name,
        biz.category || 'fashion',
        biz.description || '',
        biz.logo || null,
        biz.phone || '',
        biz.location || '',
        biz.currency || '₦',
        biz.deliveryInfo || '',
        biz.returnPolicy || '',
        biz.paymentInstructions || '',
        JSON.stringify(biz.faqs || []),
        !!biz.onboardingCompleted,
        biz.createdAt ? new Date(biz.createdAt).toISOString() : new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return biz;
  },

  async update(id: string, updates: Partial<Business>): Promise<Business | null> {
    const existing = await businessesRepo.findById(id);
    if (!existing) return null;

    const merged: Business = { ...existing, ...updates };

    await query(
      `UPDATE businesses SET
        name = $1,
        category = $2,
        description = $3,
        logo = $4,
        phone = $5,
        location = $6,
        currency = $7,
        delivery_info = $8,
        return_policy = $9,
        payment_instructions = $10,
        faqs = $11,
        onboarding_completed = $12,
        updated_at = NOW()
       WHERE id = $13`,
      [
        merged.name,
        merged.category,
        merged.description,
        merged.logo || null,
        merged.phone,
        merged.location,
        merged.currency,
        merged.deliveryInfo,
        merged.returnPolicy,
        merged.paymentInstructions,
        JSON.stringify(merged.faqs || []),
        merged.onboardingCompleted,
        id,
      ]
    );

    return businessesRepo.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM businesses WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  },
};

// ==========================================
// 3. SESSIONS REPOSITORY
// ==========================================
export const sessionsRepo = {
  async findByToken(token: string): Promise<Session | null> {
    const res = await query('SELECT * FROM sessions WHERE token = $1', [token]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    const exp = new Date(r.expires_at).getTime();
    if (Date.now() > exp) {
      await query('DELETE FROM sessions WHERE token = $1', [token]);
      return null;
    }
    return {
      token: r.token,
      userId: r.user_id,
      businessId: r.business_id,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : new Date().toISOString(),
    };
  },

  async create(session: Session): Promise<Session> {
    await query(
      `INSERT INTO sessions (token, user_id, business_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         business_id = EXCLUDED.business_id,
         expires_at = EXCLUDED.expires_at`,
      [
        session.token,
        session.userId,
        session.businessId,
        session.createdAt ? new Date(session.createdAt).toISOString() : new Date().toISOString(),
        session.expiresAt ? new Date(session.expiresAt).toISOString() : new Date().toISOString(),
      ]
    );
    return session;
  },

  async deleteByToken(token: string): Promise<boolean> {
    const res = await query('DELETE FROM sessions WHERE token = $1', [token]);
    return (res.rowCount || 0) > 0;
  },

  async deleteByUserId(userId: string): Promise<boolean> {
    const res = await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    return (res.rowCount || 0) > 0;
  },
};

// ==========================================
// 4. BUSINESS SETTINGS REPOSITORY
// ==========================================
export const settingsRepo = {
  async findByBusinessId(businessId: string): Promise<BusinessSettings> {
    const res = await query('SELECT * FROM business_settings WHERE business_id = $1', [businessId]);
    if (res.rows.length > 0) {
      const r = res.rows[0];
      return {
        businessId: r.business_id,
        defaultTone: r.default_tone || 'friendly',
        language: r.language || 'English (Nigerian)',
        pidginEnabled: r.pidgin_enabled ?? true,
        enablePidgin: r.pidgin_enabled ?? true,
        quickReplies: safeJsonParse(r.quick_replies, []),
      };
    }

    const defaultSettings: BusinessSettings = {
      businessId,
      defaultTone: 'friendly',
      language: 'English (Nigerian)',
      pidginEnabled: true,
      enablePidgin: true,
      quickReplies: [
        {
          title: 'Payment Details',
          template:
            'Here are our official bank payment details:\nPlease share your screenshot receipt once transferred so we can verify and dispatch immediately!',
        },
        {
          title: 'Delivery Details',
          template:
            'We deliver nationwide across Nigeria! Please reply with your exact address, LGA, and active phone number.',
        },
      ],
    };

    await query(
      `INSERT INTO business_settings (business_id, default_tone, language, pidgin_enabled, quick_replies)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (business_id) DO NOTHING`,
      [
        businessId,
        defaultSettings.defaultTone,
        defaultSettings.language,
        defaultSettings.pidginEnabled ?? true,
        JSON.stringify(defaultSettings.quickReplies),
      ]
    );

    return defaultSettings;
  },

  async update(businessId: string, updates: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const existing = await settingsRepo.findByBusinessId(businessId);
    const merged: BusinessSettings = { ...existing, ...updates };

    await query(
      `INSERT INTO business_settings (business_id, default_tone, language, pidgin_enabled, quick_replies, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (business_id) DO UPDATE SET
         default_tone = EXCLUDED.default_tone,
         language = EXCLUDED.language,
         pidgin_enabled = EXCLUDED.pidgin_enabled,
         quick_replies = EXCLUDED.quick_replies,
         updated_at = NOW()`,
      [
        businessId,
        merged.defaultTone,
        merged.language,
        merged.pidginEnabled ?? merged.enablePidgin ?? true,
        JSON.stringify(merged.quickReplies || []),
      ]
    );

    return settingsRepo.findByBusinessId(businessId);
  },
};

// ==========================================
// 5. PRODUCTS REPOSITORY (Multi-tenant scoped)
// ==========================================
export const productsRepo = {
  async findAllByBusinessId(businessId: string): Promise<Product[]> {
    const pRes = await query(
      'SELECT * FROM products WHERE business_id = $1 ORDER BY created_at DESC',
      [businessId]
    );
    const vRes = await query(
      'SELECT * FROM product_variants WHERE business_id = $1',
      [businessId]
    );

    const variantsByProdId = new Map<string, ProductVariant[]>();
    for (const v of vRes.rows) {
      const list = variantsByProdId.get(v.product_id) || [];
      list.push({
        id: v.id,
        name: v.name,
        stock: v.stock || 0,
        sku: v.sku || undefined,
      });
      variantsByProdId.set(v.product_id, list);
    }

    return pRes.rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      name: r.name,
      price: Number(r.price) || 0,
      category: r.category,
      description: r.description || '',
      images: safeJsonParse(r.images, []),
      stockQuantity: Number(r.stock_quantity) || 0,
      sku: r.sku || '',
      status: r.status as 'active' | 'inactive',
      variants: variantsByProdId.get(r.id) || [],
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }));
  },

  async findById(id: string, businessId: string): Promise<Product | null> {
    const res = await query(
      'SELECT * FROM products WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const vRes = await query(
      'SELECT * FROM product_variants WHERE product_id = $1 AND business_id = $2',
      [id, businessId]
    );

    return {
      id: r.id,
      businessId: r.business_id,
      name: r.name,
      price: Number(r.price) || 0,
      category: r.category,
      description: r.description || '',
      images: safeJsonParse(r.images, []),
      stockQuantity: Number(r.stock_quantity) || 0,
      sku: r.sku || '',
      status: r.status as 'active' | 'inactive',
      variants: vRes.rows.map((v) => ({
        id: v.id,
        name: v.name,
        stock: v.stock || 0,
        sku: v.sku || undefined,
      })),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  },

  async create(product: Product): Promise<Product> {
    const safePrice = Math.max(0, Math.round(Number(product.price) || 0));
    const safeStock = Math.max(0, Math.round(Number(product.stockQuantity) || 0));

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO products (
          id, business_id, name, price, category, description, images,
          stock_quantity, sku, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          images = EXCLUDED.images,
          stock_quantity = EXCLUDED.stock_quantity,
          sku = EXCLUDED.sku,
          status = EXCLUDED.status,
          updated_at = NOW()`,
        [
          product.id,
          product.businessId,
          product.name.trim(),
          safePrice,
          product.category || 'General',
          product.description || '',
          JSON.stringify(product.images || []),
          safeStock,
          product.sku || '',
          product.status || 'active',
          product.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
          product.updatedAt ? new Date(product.updatedAt).toISOString() : new Date().toISOString(),
        ]
      );

      // Clean up existing variants and re-insert
      await client.query(
        'DELETE FROM product_variants WHERE product_id = $1 AND business_id = $2',
        [product.id, product.businessId]
      );

      if (Array.isArray(product.variants)) {
        for (const v of product.variants) {
          await client.query(
            `INSERT INTO product_variants (
              id, product_id, business_id, name, stock, sku, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              v.id || `var_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              product.id,
              product.businessId,
              v.name.trim(),
              Math.max(0, Math.round(Number(v.stock) || 0)),
              v.sku || '',
            ]
          );
        }
      }
    });

    const created = await productsRepo.findById(product.id, product.businessId);
    return created || product;
  },

  async update(id: string, businessId: string, updates: Partial<Product>): Promise<Product | null> {
    const existing = await productsRepo.findById(id, businessId);
    if (!existing) return null;

    const merged = { ...existing, ...updates };
    const safePrice = Math.max(0, Math.round(Number(merged.price) || 0));
    const safeStock = Math.max(0, Math.round(Number(merged.stockQuantity) || 0));

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE products SET
          name = $1,
          price = $2,
          category = $3,
          description = $4,
          images = $5,
          stock_quantity = $6,
          sku = $7,
          status = $8,
          updated_at = NOW()
        WHERE id = $9 AND business_id = $10`,
        [
          merged.name.trim(),
          safePrice,
          merged.category,
          merged.description,
          JSON.stringify(merged.images || []),
          safeStock,
          merged.sku,
          merged.status,
          id,
          businessId,
        ]
      );

      if (updates.variants !== undefined && Array.isArray(updates.variants)) {
        await client.query(
          'DELETE FROM product_variants WHERE product_id = $1 AND business_id = $2',
          [id, businessId]
        );
        for (const v of updates.variants) {
          await client.query(
            `INSERT INTO product_variants (
              id, product_id, business_id, name, stock, sku, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              v.id || `var_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              id,
              businessId,
              v.name.trim(),
              Math.max(0, Math.round(Number(v.stock) || 0)),
              v.sku || '',
            ]
          );
        }
      }
    });

    return productsRepo.findById(id, businessId);
  },

  async delete(id: string, businessId: string): Promise<boolean> {
    const res = await query(
      'DELETE FROM products WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    return (res.rowCount || 0) > 0;
  },
};

// ==========================================
// 6. CUSTOMERS REPOSITORY (Multi-tenant scoped)
// ==========================================
export const customersRepo = {
  async findAllByBusinessId(businessId: string): Promise<Customer[]> {
    const res = await query(
      'SELECT * FROM customers WHERE business_id = $1 ORDER BY created_at DESC',
      [businessId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      name: r.name,
      phone: r.phone,
      email: r.email || undefined,
      location: r.location || '',
      ordersCount: Number(r.orders_count) || 0,
      totalSpent: Number(r.total_spent) || 0,
      lastOrderDate: r.last_order_date ? new Date(r.last_order_date).toISOString() : undefined,
      status: r.status as Customer['status'],
      notes: r.notes || '',
      dateAdded: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      interactions: safeJsonParse(r.interactions, []),
    }));
  },

  async findById(id: string, businessId: string): Promise<Customer | null> {
    const res = await query(
      'SELECT * FROM customers WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      businessId: r.business_id,
      name: r.name,
      phone: r.phone,
      email: r.email || undefined,
      location: r.location || '',
      ordersCount: Number(r.orders_count) || 0,
      totalSpent: Number(r.total_spent) || 0,
      lastOrderDate: r.last_order_date ? new Date(r.last_order_date).toISOString() : undefined,
      status: r.status as Customer['status'],
      notes: r.notes || '',
      dateAdded: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      interactions: safeJsonParse(r.interactions, []),
    };
  },

  async findByPhone(phone: string, businessId: string): Promise<Customer | null> {
    const cleanPhone = phone.trim();
    if (!cleanPhone) return null;
    const res = await query(
      'SELECT * FROM customers WHERE business_id = $1 AND phone = $2',
      [businessId, cleanPhone]
    );
    if (res.rows.length === 0) return null;
    return customersRepo.findById(res.rows[0].id, businessId);
  },

  async create(customer: Customer): Promise<Customer> {
    const safeOrdersCount = Math.max(0, Math.round(Number(customer.ordersCount) || 0));
    const safeTotalSpent = Math.max(0, Math.round(Number(customer.totalSpent) || 0));

    await query(
      `INSERT INTO customers (
        id, business_id, name, phone, email, location, orders_count,
        total_spent, last_order_date, status, notes, interactions,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        location = EXCLUDED.location,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = NOW()`,
      [
        customer.id,
        customer.businessId,
        customer.name.trim(),
        customer.phone.trim(),
        customer.email?.trim() || null,
        customer.location?.trim() || '',
        safeOrdersCount,
        safeTotalSpent,
        customer.lastOrderDate ? new Date(customer.lastOrderDate).toISOString() : null,
        customer.status || 'New',
        customer.notes || '',
        JSON.stringify(customer.interactions || []),
        customer.dateAdded ? new Date(customer.dateAdded).toISOString() : new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    const created = await customersRepo.findById(customer.id, customer.businessId);
    return created || customer;
  },

  async update(id: string, businessId: string, updates: Partial<Customer>): Promise<Customer | null> {
    const existing = await customersRepo.findById(id, businessId);
    if (!existing) return null;

    const merged = { ...existing, ...updates };

    await query(
      `UPDATE customers SET
        name = $1,
        phone = $2,
        email = $3,
        location = $4,
        orders_count = $5,
        total_spent = $6,
        last_order_date = $7,
        status = $8,
        notes = $9,
        interactions = $10,
        updated_at = NOW()
      WHERE id = $11 AND business_id = $12`,
      [
        merged.name.trim(),
        merged.phone.trim(),
        merged.email?.trim() || null,
        merged.location.trim(),
        Math.max(0, Math.round(Number(merged.ordersCount) || 0)),
        Math.max(0, Math.round(Number(merged.totalSpent) || 0)),
        merged.lastOrderDate ? new Date(merged.lastOrderDate).toISOString() : null,
        merged.status,
        merged.notes,
        JSON.stringify(merged.interactions || []),
        id,
        businessId,
      ]
    );

    return customersRepo.findById(id, businessId);
  },

  async addInteraction(
    customerId: string,
    businessId: string,
    interaction: {
      id?: string;
      type: 'inquiry' | 'order' | 'followup' | 'note';
      summary: string;
      channel: 'WhatsApp' | 'Instagram' | 'Call' | 'Direct';
      timestamp?: string;
    }
  ): Promise<boolean> {
    const customer = await customersRepo.findById(customerId, businessId);
    if (!customer) return false;

    const interactions = customer.interactions || [];
    interactions.unshift({
      id: interaction.id || `act_${Date.now()}`,
      type: interaction.type,
      summary: interaction.summary,
      channel: interaction.channel,
      timestamp: interaction.timestamp || new Date().toISOString(),
    });

    await customersRepo.update(customerId, businessId, { interactions });
    return true;
  },

  async delete(id: string, businessId: string): Promise<boolean> {
    const res = await query(
      'DELETE FROM customers WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    return (res.rowCount || 0) > 0;
  },
};

// ==========================================
// 7. ORDERS REPOSITORY (Atomic Transactions & Concurrency Protection)
// ==========================================
/**
 * Ensures the order sequence exists and is synchronized with existing orders.
 */
export async function syncOrderSequence(client?: any): Promise<void> {
  const runner = client || { query };
  try {
    await runner.query('CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001;');
    const maxRes = await runner.query(`
      SELECT COALESCE(
        MAX(
          CASE 
            WHEN id ~ '^SP-[0-9]+$' THEN SUBSTRING(id FROM 4)::BIGINT 
            ELSE 0 
          END
        ), 1000
      ) as max_val FROM orders;
    `);
    const maxVal = Math.max(1000, Number(maxRes.rows[0]?.max_val || 1000));
    await runner.query(`SELECT setval('order_number_seq', $1, true);`, [maxVal]);
  } catch (err: any) {
    console.warn('Order sequence sync warning:', err.message);
  }
}

export const ordersRepo = {
  async generateNextOrderId(client?: any): Promise<string> {
    const runner = client || { query };
    for (let attempt = 0; attempt < 50; attempt++) {
      let nextNum: number;
      try {
        const seqRes = await runner.query("SELECT nextval('order_number_seq') as next_val;");
        nextNum = Number(seqRes.rows[0]?.next_val);
      } catch {
        await syncOrderSequence(client);
        const seqRes = await runner.query("SELECT nextval('order_number_seq') as next_val;");
        nextNum = Number(seqRes.rows[0]?.next_val);
      }

      if (!nextNum || isNaN(nextNum)) {
        nextNum = 1000 + attempt + 1;
      }

      const candidateId = `SP-${nextNum}`;
      // Verify global uniqueness across the entire orders table
      const existsRes = await runner.query('SELECT 1 FROM orders WHERE id = $1 LIMIT 1;', [candidateId]);
      if (existsRes.rows.length === 0) {
        return candidateId;
      }
      // If candidate already exists in orders, advance sequence beyond max and retry
      await syncOrderSequence(client);
    }
    // High-entropy timestamp fallback to prevent any deadlock
    return `SP-${Date.now()}`;
  },

  async findAllByBusinessId(businessId: string): Promise<Order[]> {
    const oRes = await query(
      'SELECT * FROM orders WHERE business_id = $1 ORDER BY created_date DESC',
      [businessId]
    );
    const iRes = await query(
      'SELECT * FROM order_items WHERE business_id = $1',
      [businessId]
    );

    const itemsByOrderId = new Map<string, OrderItem[]>();
    for (const it of iRes.rows) {
      const list = itemsByOrderId.get(it.order_id) || [];
      list.push({
        id: it.id,
        productId: it.product_id || '',
        productName: it.product_name,
        variantName: it.variant_name || undefined,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unit_price) || 0,
        totalPrice: Number(it.total_price) || 0,
      });
      itemsByOrderId.set(it.order_id, list);
    }

    return oRes.rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      customerId: r.customer_id || '',
      customerName: r.customer_name,
      customerPhone: r.customer_phone || '',
      items: itemsByOrderId.get(r.id) || [],
      productSubtotal: Number(r.product_subtotal) || 0,
      deliveryFee: Number(r.delivery_fee) || 0,
      discount: Number(r.discount) || 0,
      total: Number(r.total) || 0,
      paymentStatus: r.payment_status as Order['paymentStatus'],
      orderStatus: r.order_status as Order['orderStatus'],
      deliveryAddress: r.delivery_address || '',
      notes: r.notes || '',
      createdDate: r.created_date ? new Date(r.created_date).toISOString() : new Date().toISOString(),
    }));
  },

  async findById(id: string, businessId: string): Promise<Order | null> {
    const oRes = await query(
      'SELECT * FROM orders WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    if (oRes.rows.length === 0) return null;
    const r = oRes.rows[0];

    const iRes = await query(
      'SELECT * FROM order_items WHERE order_id = $1 AND business_id = $2',
      [id, businessId]
    );

    return {
      id: r.id,
      businessId: r.business_id,
      customerId: r.customer_id || '',
      customerName: r.customer_name,
      customerPhone: r.customer_phone || '',
      items: iRes.rows.map((it) => ({
        id: it.id,
        productId: it.product_id || '',
        productName: it.product_name,
        variantName: it.variant_name || undefined,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unit_price) || 0,
        totalPrice: Number(it.total_price) || 0,
      })),
      productSubtotal: Number(r.product_subtotal) || 0,
      deliveryFee: Number(r.delivery_fee) || 0,
      discount: Number(r.discount) || 0,
      total: Number(r.total) || 0,
      paymentStatus: r.payment_status as Order['paymentStatus'],
      orderStatus: r.order_status as Order['orderStatus'],
      deliveryAddress: r.delivery_address || '',
      notes: r.notes || '',
      createdDate: r.created_date ? new Date(r.created_date).toISOString() : new Date().toISOString(),
    };
  },

  /**
   * ATOMIC ORDER CREATION (Transactions & Concurrency Protection)
   * 1. Validate product
   * 2. Lock & validate stock
   * 3. Compute integer totals: total = max(0, subtotal + deliveryFee - discount)
   * 4. Create order row
   * 5. Create order items
   * 6. Atomically decrement inventory:
   *    UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND business_id = $3 AND stock_quantity >= $1
   * 7. Update customer statistics
   * Rollback everything if any step fails.
   */
  async create(order: Order, options?: { skipStockDecrement?: boolean }): Promise<Order> {
    return withTransaction(async (client) => {
      // 0. Double Order Idempotency & Primary Key collision guard
      if (!order.id) {
        order.id = await ordersRepo.generateNextOrderId(client);
      } else {
        const existingOrder = await client.query(
          'SELECT id, business_id FROM orders WHERE id = $1',
          [order.id]
        );
        if (existingOrder.rows.length > 0) {
          if (existingOrder.rows[0].business_id === order.businessId) {
            throw new Error(`Order ${order.id} already exists. Double-submission prevented.`);
          } else {
            // ID already taken globally by another business; assign next safe unique ID
            order.id = await ordersRepo.generateNextOrderId(client);
          }
        }
      }

      // 1 & 2. Validate products & lock stock
      const safeItems: OrderItem[] = [];
      let calculatedSubtotal = 0;

      for (let i = 0; i < order.items.length; i++) {
        const it = order.items[i];
        const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
        const uPrice = Math.max(0, Math.round(Number(it.unitPrice) || 0));
        const tPrice = uPrice * qty;
        calculatedSubtotal += tPrice;

        if (it.productId) {
          // Lock the product row FOR UPDATE scoped strictly by business_id
          const pRes = await client.query(
            'SELECT * FROM products WHERE id = $1 AND business_id = $2 FOR UPDATE',
            [it.productId, order.businessId]
          );

          if (pRes.rows.length === 0) {
            throw new Error(`Product not found or access denied: ${it.productName || it.productId}`);
          }

          const product = pRes.rows[0];
          const currentStock = Number(product.stock_quantity) || 0;

          if (!options?.skipStockDecrement && currentStock < qty) {
            throw new Error(
              `Insufficient stock for "${product.name}". Requested: ${qty}, Available: ${currentStock}.`
            );
          }

          // Check variant if specified
          if (it.variantName) {
            const vRes = await client.query(
              'SELECT * FROM product_variants WHERE product_id = $1 AND business_id = $2 AND name = $3 FOR UPDATE',
              [it.productId, order.businessId, it.variantName]
            );
            if (vRes.rows.length > 0) {
              const variantStock = Number(vRes.rows[0].stock) || 0;
              if (!options?.skipStockDecrement && variantStock < qty) {
                throw new Error(
                  `Insufficient stock for variant "${it.variantName}" of "${product.name}". Requested: ${qty}, Available: ${variantStock}.`
                );
              }
            }
          }
        }

        safeItems.push({
          id: it.id || `item_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
          productId: it.productId || '',
          productName: (it.productName || 'Item').trim(),
          variantName: it.variantName ? String(it.variantName).trim() : undefined,
          quantity: qty,
          unitPrice: uPrice,
          totalPrice: tPrice,
        });
      }

      // 3. Integer Naira Arithmetic
      const deliveryFee = Math.max(0, Math.round(Number(order.deliveryFee) || 0));
      const discount = Math.max(0, Math.round(Number(order.discount) || 0));
      const finalTotal = Math.max(0, calculatedSubtotal + deliveryFee - discount);

      // Verify customer foreign key
      let customerId: string | null = order.customerId && order.customerId.trim().length > 0 ? order.customerId : null;
      if (customerId) {
        const cCheck = await client.query(
          'SELECT id FROM customers WHERE id = $1 AND business_id = $2',
          [customerId, order.businessId]
        );
        if (cCheck.rows.length === 0) {
          customerId = null;
        }
      }

      // 4. Insert Order
      const orderDate = order.createdDate ? new Date(order.createdDate).toISOString() : new Date().toISOString();
      await client.query(
        `INSERT INTO orders (
          id, business_id, customer_id, customer_name, customer_phone,
          product_subtotal, delivery_fee, discount, total,
          payment_status, order_status, delivery_address, notes,
          created_date, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
        [
          order.id,
          order.businessId,
          customerId,
          order.customerName.trim(),
          order.customerPhone?.trim() || '',
          calculatedSubtotal,
          deliveryFee,
          discount,
          finalTotal,
          order.paymentStatus || 'Unpaid',
          order.orderStatus || 'New',
          order.deliveryAddress?.trim() || '',
          order.notes?.trim() || '',
          orderDate,
        ]
      );

      // 5. Insert Order Items & 6. Atomic Inventory Decrement
      for (const it of safeItems) {
        await client.query(
          `INSERT INTO order_items (
            id, order_id, business_id, product_id, product_name,
            variant_name, quantity, unit_price, total_price, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            it.id,
            order.id,
            order.businessId,
            it.productId || null,
            it.productName,
            it.variantName || null,
            it.quantity,
            it.unitPrice,
            it.totalPrice,
          ]
        );

        if (it.productId && !options?.skipStockDecrement) {
          // Atomic decrement with safety check: stock_quantity >= qty
          const decResult = await client.query(
            `UPDATE products
             SET stock_quantity = stock_quantity - CAST($1 AS INTEGER), updated_at = NOW()
             WHERE id = $2 AND business_id = $3 AND stock_quantity >= CAST($1 AS INTEGER)
             RETURNING stock_quantity`,
            [it.quantity, it.productId, order.businessId]
          );

          if (decResult.rowCount === 0) {
            throw new Error(
              `Concurrent stock conflict: "${it.productName}" was purchased by another buyer.`
            );
          }

          if (it.variantName) {
            await client.query(
              `UPDATE product_variants
               SET stock = stock - CAST($1 AS INTEGER), updated_at = NOW()
               WHERE product_id = $2 AND business_id = $3 AND name = $4 AND stock >= CAST($1 AS INTEGER)`,
              [it.quantity, it.productId, order.businessId, it.variantName]
            );
          }
        }
      }

      // 7. Update Customer Metrics
      if (customerId) {
        await client.query(
          `UPDATE customers
           SET orders_count = orders_count + 1,
               total_spent = total_spent + CAST($1 AS BIGINT),
               last_order_date = $2,
               status = CASE WHEN status = 'New' THEN 'Ordered' ELSE status END,
               updated_at = NOW()
           WHERE id = $3 AND business_id = $4`,
          [finalTotal, orderDate, customerId, order.businessId]
        );
      }

      const completedOrder: Order = {
        id: order.id,
        businessId: order.businessId,
        customerId: customerId || '',
        customerName: order.customerName.trim(),
        customerPhone: order.customerPhone?.trim() || '',
        items: safeItems,
        productSubtotal: calculatedSubtotal,
        deliveryFee,
        discount,
        total: finalTotal,
        paymentStatus: order.paymentStatus || 'Unpaid',
        orderStatus: order.orderStatus || 'New',
        deliveryAddress: order.deliveryAddress?.trim() || '',
        notes: order.notes?.trim() || '',
        createdDate: orderDate,
      };

      return completedOrder;
    });
  },

  async update(id: string, businessId: string, updates: Partial<Order>): Promise<Order | null> {
    const existing = await ordersRepo.findById(id, businessId);
    if (!existing) return null;

    const merged = { ...existing, ...updates };

    await query(
      `UPDATE orders SET
        customer_name = $1,
        customer_phone = $2,
        payment_status = $3,
        order_status = $4,
        delivery_address = $5,
        notes = $6,
        updated_at = NOW()
      WHERE id = $7 AND business_id = $8`,
      [
        merged.customerName,
        merged.customerPhone,
        merged.paymentStatus,
        merged.orderStatus,
        merged.deliveryAddress,
        merged.notes,
        id,
        businessId,
      ]
    );

    return ordersRepo.findById(id, businessId);
  },

  async delete(id: string, businessId: string): Promise<boolean> {
    return withTransaction(async (client) => {
      const oRes = await client.query(
        'SELECT * FROM orders WHERE id = $1 AND business_id = $2',
        [id, businessId]
      );
      if (oRes.rows.length === 0) return false;
      const order = oRes.rows[0];

      // If not cancelled, restore inventory
      if (order.order_status !== 'Cancelled') {
        const iRes = await client.query(
          'SELECT * FROM order_items WHERE order_id = $1 AND business_id = $2',
          [id, businessId]
        );
        for (const it of iRes.rows) {
          if (it.product_id) {
            await client.query(
              `UPDATE products
               SET stock_quantity = stock_quantity + $1, updated_at = NOW()
               WHERE id = $2 AND business_id = $3`,
              [it.quantity, it.product_id, businessId]
            );

            if (it.variant_name) {
              await client.query(
                `UPDATE product_variants
                 SET stock = stock + $1, updated_at = NOW()
                 WHERE product_id = $2 AND business_id = $3 AND name = $4`,
                [it.quantity, it.product_id, businessId, it.variant_name]
              );
            }
          }
        }
      }

      // Adjust customer stats
      if (order.customer_id) {
        await client.query(
          `UPDATE customers
           SET orders_count = GREATEST(0, orders_count - 1),
               total_spent = GREATEST(0, total_spent - $1),
               updated_at = NOW()
           WHERE id = $2 AND business_id = $3`,
          [order.total, order.customer_id, businessId]
        );
      }

      await client.query('DELETE FROM orders WHERE id = $1 AND business_id = $2', [id, businessId]);
      return true;
    });
  },
};

// ==========================================
// 8. FOLLOW-UPS REPOSITORY
// ==========================================
export const followUpsRepo = {
  async findAllByBusinessId(businessId: string): Promise<FollowUp[]> {
    const res = await query(
      'SELECT * FROM follow_ups WHERE business_id = $1 ORDER BY due_date ASC',
      [businessId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      customerId: r.customer_id || '',
      customerName: r.customer_name,
      customerPhone: r.customer_phone || '',
      reason: r.reason,
      suggestedMessage: r.suggested_message || '',
      status: r.status as FollowUp['status'],
      dueDate: r.due_date ? new Date(r.due_date).toISOString() : new Date().toISOString(),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  },

  async findById(id: string, businessId: string): Promise<FollowUp | null> {
    const res = await query(
      'SELECT * FROM follow_ups WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      businessId: r.business_id,
      customerId: r.customer_id || '',
      customerName: r.customer_name,
      customerPhone: r.customer_phone || '',
      reason: r.reason,
      suggestedMessage: r.suggested_message || '',
      status: r.status as FollowUp['status'],
      dueDate: r.due_date ? new Date(r.due_date).toISOString() : new Date().toISOString(),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  },

  async create(fu: FollowUp): Promise<FollowUp> {
    let customerId: string | null = fu.customerId && fu.customerId.trim().length > 0 ? fu.customerId : null;
    if (customerId) {
      const cCheck = await query('SELECT id FROM customers WHERE id = $1 AND business_id = $2', [
        customerId,
        fu.businessId,
      ]);
      if (cCheck.rows.length === 0) customerId = null;
    }

    await query(
      `INSERT INTO follow_ups (
        id, business_id, customer_id, customer_name, customer_phone,
        reason, suggested_message, status, due_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (id) DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        reason = EXCLUDED.reason,
        suggested_message = EXCLUDED.suggested_message,
        status = EXCLUDED.status,
        due_date = EXCLUDED.due_date,
        updated_at = NOW()`,
      [
        fu.id,
        fu.businessId,
        customerId,
        fu.customerName.trim(),
        fu.customerPhone?.trim() || '',
        fu.reason.trim(),
        fu.suggestedMessage?.trim() || '',
        fu.status || 'Pending',
        fu.dueDate ? new Date(fu.dueDate).toISOString() : new Date().toISOString(),
        fu.createdAt ? new Date(fu.createdAt).toISOString() : new Date().toISOString(),
      ]
    );

    const created = await followUpsRepo.findById(fu.id, fu.businessId);
    return created || fu;
  },

  async update(id: string, businessId: string, updates: Partial<FollowUp>): Promise<FollowUp | null> {
    const existing = await followUpsRepo.findById(id, businessId);
    if (!existing) return null;

    const merged = { ...existing, ...updates };

    await query(
      `UPDATE follow_ups SET
        customer_name = $1,
        customer_phone = $2,
        reason = $3,
        suggested_message = $4,
        status = $5,
        due_date = $6,
        updated_at = NOW()
      WHERE id = $7 AND business_id = $8`,
      [
        merged.customerName,
        merged.customerPhone,
        merged.reason,
        merged.suggestedMessage,
        merged.status,
        merged.dueDate ? new Date(merged.dueDate).toISOString() : new Date().toISOString(),
        id,
        businessId,
      ]
    );

    return followUpsRepo.findById(id, businessId);
  },

  async delete(id: string, businessId: string): Promise<boolean> {
    const res = await query(
      'DELETE FROM follow_ups WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    return (res.rowCount || 0) > 0;
  },
};

// ==========================================
// 9. CONVERSATION ANALYSES REPOSITORY
// ==========================================
export const conversationsRepo = {
  async findAllByBusinessId(businessId: string): Promise<ConversationAnalysis[]> {
    const res = await query(
      'SELECT * FROM conversation_analyses WHERE business_id = $1 ORDER BY created_at DESC',
      [businessId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      customerId: r.customer_id || undefined,
      customerName: r.customer_name || undefined,
      customerPhone: r.customer_phone || undefined,
      rawConversation: r.raw_conversation,
      detectedIntent: r.detected_intent,
      leadStage: r.lead_stage,
      interestLevel: r.interest_level,
      productsDetected: safeJsonParse(r.products_detected, []),
      questionsAsked: safeJsonParse(r.questions_asked, []),
      objections: safeJsonParse(r.objections, []),
      missingInformation: safeJsonParse(r.missing_information, []),
      purchaseLikelihood: r.purchase_likelihood,
      recommendedAction: r.recommended_action,
      suggestedReply: r.suggested_reply,
      followUpRecommended: !!r.follow_up_recommended,
      followUpReason: r.follow_up_reason || undefined,
      orderOpportunity: !!r.order_opportunity,
      orderItems: safeJsonParse(r.order_items, []),
      deliveryFeeEstimated: r.delivery_fee_estimated != null ? Number(r.delivery_fee_estimated) : null,
      deliveryFeeConfirmed: !!r.delivery_fee_confirmed,
      confidence: Number(r.confidence) || 0,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }));
  },

  async findById(id: string, businessId: string): Promise<ConversationAnalysis | null> {
    const res = await query(
      'SELECT * FROM conversation_analyses WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      businessId: r.business_id,
      customerId: r.customer_id || undefined,
      customerName: r.customer_name || undefined,
      customerPhone: r.customer_phone || undefined,
      rawConversation: r.raw_conversation,
      detectedIntent: r.detected_intent,
      leadStage: r.lead_stage,
      interestLevel: r.interest_level,
      productsDetected: safeJsonParse(r.products_detected, []),
      questionsAsked: safeJsonParse(r.questions_asked, []),
      objections: safeJsonParse(r.objections, []),
      missingInformation: safeJsonParse(r.missing_information, []),
      purchaseLikelihood: r.purchase_likelihood,
      recommendedAction: r.recommended_action,
      suggestedReply: r.suggested_reply,
      followUpRecommended: !!r.follow_up_recommended,
      followUpReason: r.follow_up_reason || undefined,
      orderOpportunity: !!r.order_opportunity,
      orderItems: safeJsonParse(r.order_items, []),
      deliveryFeeEstimated: r.delivery_fee_estimated != null ? Number(r.delivery_fee_estimated) : null,
      deliveryFeeConfirmed: !!r.delivery_fee_confirmed,
      confidence: Number(r.confidence) || 0,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  },

  async findByCustomerId(customerId: string, businessId: string): Promise<ConversationAnalysis[]> {
    const res = await query(
      'SELECT * FROM conversation_analyses WHERE customer_id = $1 AND business_id = $2 ORDER BY created_at DESC',
      [customerId, businessId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      customerId: r.customer_id || undefined,
      customerName: r.customer_name || undefined,
      customerPhone: r.customer_phone || undefined,
      rawConversation: r.raw_conversation,
      detectedIntent: r.detected_intent,
      leadStage: r.lead_stage,
      interestLevel: r.interest_level,
      productsDetected: safeJsonParse(r.products_detected, []),
      questionsAsked: safeJsonParse(r.questions_asked, []),
      objections: safeJsonParse(r.objections, []),
      missingInformation: safeJsonParse(r.missing_information, []),
      purchaseLikelihood: r.purchase_likelihood,
      recommendedAction: r.recommended_action,
      suggestedReply: r.suggested_reply,
      followUpRecommended: !!r.follow_up_recommended,
      followUpReason: r.follow_up_reason || undefined,
      orderOpportunity: !!r.order_opportunity,
      orderItems: safeJsonParse(r.order_items, []),
      deliveryFeeEstimated: r.delivery_fee_estimated != null ? Number(r.delivery_fee_estimated) : null,
      deliveryFeeConfirmed: !!r.delivery_fee_confirmed,
      confidence: Number(r.confidence) || 0,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }));
  },

  async create(conv: ConversationAnalysis): Promise<ConversationAnalysis> {
    let customerId: string | null = conv.customerId && conv.customerId.trim().length > 0 ? conv.customerId : null;
    if (customerId) {
      const cCheck = await query('SELECT id FROM customers WHERE id = $1 AND business_id = $2', [
        customerId,
        conv.businessId,
      ]);
      if (cCheck.rows.length === 0) customerId = null;
    }

    await query(
      `INSERT INTO conversation_analyses (
        id, business_id, customer_id, customer_name, customer_phone,
        raw_conversation, detected_intent, lead_stage, interest_level,
        products_detected, questions_asked, objections, missing_information,
        purchase_likelihood, recommended_action, suggested_reply,
        follow_up_recommended, follow_up_reason, order_opportunity,
        order_items, delivery_fee_estimated, delivery_fee_confirmed,
        confidence, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW())
      ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        lead_stage = EXCLUDED.lead_stage,
        interest_level = EXCLUDED.interest_level,
        products_detected = EXCLUDED.products_detected,
        recommended_action = EXCLUDED.recommended_action,
        suggested_reply = EXCLUDED.suggested_reply,
        follow_up_recommended = EXCLUDED.follow_up_recommended,
        follow_up_reason = EXCLUDED.follow_up_reason,
        order_opportunity = EXCLUDED.order_opportunity,
        order_items = EXCLUDED.order_items,
        updated_at = NOW()`,
      [
        conv.id,
        conv.businessId,
        customerId,
        conv.customerName || null,
        conv.customerPhone || null,
        conv.rawConversation,
        conv.detectedIntent,
        conv.leadStage,
        conv.interestLevel,
        JSON.stringify(conv.productsDetected || []),
        JSON.stringify(conv.questionsAsked || []),
        JSON.stringify(conv.objections || []),
        JSON.stringify(conv.missingInformation || []),
        conv.purchaseLikelihood,
        conv.recommendedAction,
        conv.suggestedReply,
        !!conv.followUpRecommended,
        conv.followUpReason || null,
        !!conv.orderOpportunity,
        JSON.stringify(conv.orderItems || []),
        conv.deliveryFeeEstimated != null ? Math.round(Number(conv.deliveryFeeEstimated)) : null,
        !!conv.deliveryFeeConfirmed,
        conv.confidence || 0,
        conv.createdAt ? new Date(conv.createdAt).toISOString() : new Date().toISOString(),
      ]
    );

    const created = await conversationsRepo.findById(conv.id, conv.businessId);
    return created || conv;
  },

  async update(
    id: string,
    businessId: string,
    updates: Partial<ConversationAnalysis>
  ): Promise<ConversationAnalysis | null> {
    const existing = await conversationsRepo.findById(id, businessId);
    if (!existing) return null;

    const merged = { ...existing, ...updates };

    await query(
      `UPDATE conversation_analyses SET
        customer_id = $1,
        customer_name = $2,
        customer_phone = $3,
        lead_stage = $4,
        interest_level = $5,
        products_detected = $6,
        recommended_action = $7,
        suggested_reply = $8,
        follow_up_recommended = $9,
        follow_up_reason = $10,
        order_opportunity = $11,
        order_items = $12,
        delivery_fee_estimated = $13,
        delivery_fee_confirmed = $14,
        confidence = $15,
        updated_at = NOW()
      WHERE id = $16 AND business_id = $17`,
      [
        merged.customerId || null,
        merged.customerName || null,
        merged.customerPhone || null,
        merged.leadStage,
        merged.interestLevel,
        JSON.stringify(merged.productsDetected || []),
        merged.recommendedAction,
        merged.suggestedReply,
        !!merged.followUpRecommended,
        merged.followUpReason || null,
        !!merged.orderOpportunity,
        JSON.stringify(merged.orderItems || []),
        merged.deliveryFeeEstimated != null ? Math.round(Number(merged.deliveryFeeEstimated)) : null,
        !!merged.deliveryFeeConfirmed,
        merged.confidence || 0,
        id,
        businessId,
      ]
    );

    return conversationsRepo.findById(id, businessId);
  },

  async delete(id: string, businessId: string): Promise<boolean> {
    const res = await query(
      'DELETE FROM conversation_analyses WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    return (res.rowCount || 0) > 0;
  },
};

// ==========================================
// 10. SUBSCRIPTIONS REPOSITORY
// ==========================================
export const subscriptionsRepo = {
  async findByBusinessId(businessId: string): Promise<Subscription | null> {
    const res = await query('SELECT * FROM subscriptions WHERE business_id = $1', [businessId]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      businessId: r.business_id,
      plan: (r.plan as SubscriptionPlanId) || 'FREE_TRIAL',
      status: (r.status as SubscriptionStatus) || 'trialing',
      trialStartedAt: r.trial_started_at ? new Date(r.trial_started_at).toISOString() : null,
      trialEndsAt: r.trial_ends_at ? new Date(r.trial_ends_at).toISOString() : null,
      currentPeriodStart: r.current_period_start ? new Date(r.current_period_start).toISOString() : new Date().toISOString(),
      currentPeriodEnd: r.current_period_end ? new Date(r.current_period_end).toISOString() : new Date().toISOString(),
      cancelledAt: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  },

  async create(sub: Subscription): Promise<Subscription> {
    await query(
      `INSERT INTO subscriptions (
        id, business_id, plan, status, trial_started_at, trial_ends_at,
        current_period_start, current_period_end, cancelled_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (business_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        trial_started_at = EXCLUDED.trial_started_at,
        trial_ends_at = EXCLUDED.trial_ends_at,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancelled_at = EXCLUDED.cancelled_at,
        updated_at = NOW()`,
      [
        sub.id,
        sub.businessId,
        sub.plan,
        sub.status,
        sub.trialStartedAt ? new Date(sub.trialStartedAt).toISOString() : null,
        sub.trialEndsAt ? new Date(sub.trialEndsAt).toISOString() : null,
        new Date(sub.currentPeriodStart).toISOString(),
        new Date(sub.currentPeriodEnd).toISOString(),
        sub.cancelledAt ? new Date(sub.cancelledAt).toISOString() : null,
        sub.createdAt ? new Date(sub.createdAt).toISOString() : new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    return sub;
  },

  async update(businessId: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    const existing = await subscriptionsRepo.findByBusinessId(businessId);
    if (!existing) return null;

    const merged = { ...existing, ...updates };

    await query(
      `UPDATE subscriptions SET
        plan = $1,
        status = $2,
        trial_started_at = $3,
        trial_ends_at = $4,
        current_period_start = $5,
        current_period_end = $6,
        cancelled_at = $7,
        updated_at = NOW()
      WHERE business_id = $8`,
      [
        merged.plan,
        merged.status,
        merged.trialStartedAt ? new Date(merged.trialStartedAt).toISOString() : null,
        merged.trialEndsAt ? new Date(merged.trialEndsAt).toISOString() : null,
        new Date(merged.currentPeriodStart).toISOString(),
        new Date(merged.currentPeriodEnd).toISOString(),
        merged.cancelledAt ? new Date(merged.cancelledAt).toISOString() : null,
        businessId,
      ]
    );

    return subscriptionsRepo.findByBusinessId(businessId);
  },

  async findAll(): Promise<Subscription[]> {
    const res = await query('SELECT * FROM subscriptions ORDER BY created_at DESC');
    return res.rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      plan: (r.plan as SubscriptionPlanId) || 'FREE_TRIAL',
      status: (r.status as SubscriptionStatus) || 'trialing',
      trialStartedAt: r.trial_started_at ? new Date(r.trial_started_at).toISOString() : null,
      trialEndsAt: r.trial_ends_at ? new Date(r.trial_ends_at).toISOString() : null,
      currentPeriodStart: r.current_period_start ? new Date(r.current_period_start).toISOString() : new Date().toISOString(),
      currentPeriodEnd: r.current_period_end ? new Date(r.current_period_end).toISOString() : new Date().toISOString(),
      cancelledAt: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }));
  },
};

// ==========================================
// 11. USAGE REPOSITORY
// ==========================================
export const usageRepo = {
  async getUsage(
    businessId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<Record<SubscriptionMetric, number>> {
    const pStart = new Date(periodStart).toISOString();
    const pEnd = new Date(periodEnd).toISOString();

    // 1. Customers (cumulative active count)
    const custRes = await query('SELECT COUNT(*) as count FROM customers WHERE business_id = $1', [businessId]);
    const customerCount = parseInt(custRes.rows[0]?.count || '0', 10);

    // 2. Products (cumulative active count)
    const prodRes = await query('SELECT COUNT(*) as count FROM products WHERE business_id = $1', [businessId]);
    const productCount = parseInt(prodRes.rows[0]?.count || '0', 10);

    // 3. AI Analyses (usage_records + conversation_analyses count)
    const aiUsageRes = await query(
      `SELECT COALESCE(MAX(cnt), 0) as count FROM (
        SELECT usage_count as cnt FROM usage_records 
        WHERE business_id = $1 AND metric = 'ai_analysis' AND period_start = $2 AND period_end = $3
        UNION ALL
        SELECT COUNT(*) as cnt FROM conversation_analyses 
        WHERE business_id = $1 AND created_at >= $2 AND created_at <= $3
      ) q`,
      [businessId, pStart, pEnd]
    );
    const aiAnalysisCount = parseInt(aiUsageRes.rows[0]?.count || '0', 10);

    // 4. Follow-ups in billing period
    const fuUsageRes = await query(
      `SELECT COALESCE(MAX(cnt), 0) as count FROM (
        SELECT usage_count as cnt FROM usage_records 
        WHERE business_id = $1 AND metric = 'follow_up' AND period_start = $2 AND period_end = $3
        UNION ALL
        SELECT COUNT(*) as cnt FROM follow_ups 
        WHERE business_id = $1 AND created_at >= $2 AND created_at <= $3
      ) q`,
      [businessId, pStart, pEnd]
    );
    const followUpCount = parseInt(fuUsageRes.rows[0]?.count || '0', 10);

    // 5. Orders in billing period
    const ordUsageRes = await query(
      `SELECT COALESCE(MAX(cnt), 0) as count FROM (
        SELECT usage_count as cnt FROM usage_records 
        WHERE business_id = $1 AND metric = 'order' AND period_start = $2 AND period_end = $3
        UNION ALL
        SELECT COUNT(*) as cnt FROM orders 
        WHERE business_id = $1 AND created_date >= $2 AND created_date <= $3
      ) q`,
      [businessId, pStart, pEnd]
    );
    const orderCount = parseInt(ordUsageRes.rows[0]?.count || '0', 10);

    return {
      ai_analysis: aiAnalysisCount,
      follow_up: followUpCount,
      order: orderCount,
      customer: customerCount,
      product: productCount,
    };
  },

  async incrementUsage(
    businessId: string,
    metric: SubscriptionMetric,
    periodStart: string,
    periodEnd: string,
    count: number = 1
  ): Promise<number> {
    const pStart = new Date(periodStart).toISOString();
    const pEnd = new Date(periodEnd).toISOString();
    const id = `use_${businessId}_${metric}_${Date.now()}`;

    const res = await query(
      `INSERT INTO usage_records (
        id, business_id, metric, period_start, period_end, usage_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (business_id, metric, period_start, period_end)
      DO UPDATE SET usage_count = usage_records.usage_count + $6, updated_at = NOW()
      RETURNING usage_count`,
      [id, businessId, metric, pStart, pEnd, count]
    );

    return res.rows[0]?.usage_count || count;
  },

  async setUsageCount(
    businessId: string,
    metric: SubscriptionMetric,
    periodStart: string,
    periodEnd: string,
    count: number
  ): Promise<number> {
    const pStart = new Date(periodStart).toISOString();
    const pEnd = new Date(periodEnd).toISOString();
    const id = `use_${businessId}_${metric}_${Date.now()}`;

    const res = await query(
      `INSERT INTO usage_records (
        id, business_id, metric, period_start, period_end, usage_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (business_id, metric, period_start, period_end)
      DO UPDATE SET usage_count = $6, updated_at = NOW()
      RETURNING usage_count`,
      [id, businessId, metric, pStart, pEnd, count]
    );

    return res.rows[0]?.usage_count ?? count;
  },
};

// ==========================================
// 12. DEMO RESET (Strict Isolation: Only affects Demo Account)
// ==========================================
export async function resetDemoData(targetBusinessId = DEMO_BUSINESS_ID): Promise<void> {
  await withTransaction(async (client) => {
    console.log(`Resetting demo data for business ${targetBusinessId}...`);
    // Delete only records owned by DEMO_BUSINESS_ID
    await client.query('DELETE FROM order_items WHERE business_id = $1', [targetBusinessId]);
    await client.query('DELETE FROM orders WHERE business_id = $1', [targetBusinessId]);
    await client.query('DELETE FROM product_variants WHERE business_id = $1', [targetBusinessId]);
    await client.query('DELETE FROM products WHERE business_id = $1', [targetBusinessId]);
    await client.query('DELETE FROM follow_ups WHERE business_id = $1', [targetBusinessId]);
    await client.query('DELETE FROM conversation_analyses WHERE business_id = $1', [targetBusinessId]);
    await client.query('DELETE FROM customers WHERE business_id = $1', [targetBusinessId]);
    await client.query('DELETE FROM business_settings WHERE business_id = $1', [targetBusinessId]);

    // Re-seed demo records
    await client.query(
      `INSERT INTO businesses (
        id, owner_id, name, category, description, phone, location, currency,
        delivery_info, return_policy, payment_instructions, faqs, onboarding_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        phone = EXCLUDED.phone,
        location = EXCLUDED.location,
        delivery_info = EXCLUDED.delivery_info,
        return_policy = EXCLUDED.return_policy,
        payment_instructions = EXCLUDED.payment_instructions,
        faqs = EXCLUDED.faqs,
        onboarding_completed = EXCLUDED.onboarding_completed`,
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

    await client.query(
      `INSERT INTO business_settings (business_id, default_tone, language, pidgin_enabled, quick_replies)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (business_id) DO UPDATE SET
         default_tone = EXCLUDED.default_tone,
         language = EXCLUDED.language,
         pidgin_enabled = EXCLUDED.pidgin_enabled,
         quick_replies = EXCLUDED.quick_replies`,
      [
        demoSettings.businessId,
        demoSettings.defaultTone,
        demoSettings.language,
        demoSettings.pidginEnabled ?? true,
        JSON.stringify(demoSettings.quickReplies || []),
      ]
    );

    for (const p of demoProducts) {
      await client.query(
        `INSERT INTO products (
          id, business_id, name, price, category, description, images, stock_quantity, sku, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          category = EXCLUDED.category,
          stock_quantity = EXCLUDED.stock_quantity,
          sku = EXCLUDED.sku,
          status = EXCLUDED.status`,
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
            `INSERT INTO product_variants (id, product_id, business_id, name, stock, sku)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET stock = EXCLUDED.stock`,
            [v.id, p.id, p.businessId, v.name, v.stock, v.sku || '']
          );
        }
      }
    }

    for (const c of demoCustomers) {
      await client.query(
        `INSERT INTO customers (
          id, business_id, name, phone, email, location, orders_count, total_spent, last_order_date, status, notes, interactions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          orders_count = EXCLUDED.orders_count,
          total_spent = EXCLUDED.total_spent,
          status = EXCLUDED.status`,
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

    for (const f of demoFollowUps) {
      await client.query(
        `INSERT INTO follow_ups (
          id, business_id, customer_id, customer_name, customer_phone, reason, suggested_message, status, due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
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
}

// ==========================================
// 12. PAYMENTS REPOSITORY
// ==========================================
export const paymentsRepo = {
  async create(data: {
    id: string;
    businessId: string;
    userId: string;
    plan: SubscriptionPlanId;
    amount: number;
    currency?: string;
    reference: string;
    provider?: string;
    status?: string;
    authorizationUrl?: string | null;
    accessCode?: string | null;
    metadata?: Record<string, any>;
  }): Promise<PaymentRecord> {
    const res = await query(
      `INSERT INTO payments (
        id, business_id, user_id, plan, amount, currency, reference, provider, status,
        authorization_url, access_code, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        data.id,
        data.businessId,
        data.userId,
        data.plan,
        data.amount,
        data.currency || 'NGN',
        data.reference,
        data.provider || 'PAYSTACK',
        data.status || 'pending',
        data.authorizationUrl || null,
        data.accessCode || null,
        JSON.stringify(data.metadata || {}),
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      businessId: r.business_id,
      userId: r.user_id,
      plan: r.plan as SubscriptionPlanId,
      amount: Number(r.amount),
      currency: r.currency,
      reference: r.reference,
      provider: r.provider,
      status: r.status,
      authorizationUrl: r.authorization_url,
      accessCode: r.access_code,
      metadata: safeJsonParse(r.metadata, {}),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  },

  async findByReference(reference: string): Promise<PaymentRecord | null> {
    const res = await query('SELECT * FROM payments WHERE reference = $1', [reference]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      businessId: r.business_id,
      userId: r.user_id,
      plan: r.plan as SubscriptionPlanId,
      amount: Number(r.amount),
      currency: r.currency,
      reference: r.reference,
      provider: r.provider,
      status: r.status,
      authorizationUrl: r.authorization_url,
      accessCode: r.access_code,
      metadata: safeJsonParse(r.metadata, {}),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  },

  async findByBusinessId(businessId: string): Promise<PaymentRecord[]> {
    const res = await query('SELECT * FROM payments WHERE business_id = $1 ORDER BY created_at DESC', [businessId]);
    return res.rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      userId: r.user_id,
      plan: r.plan as SubscriptionPlanId,
      amount: Number(r.amount),
      currency: r.currency,
      reference: r.reference,
      provider: r.provider,
      status: r.status,
      authorizationUrl: r.authorization_url,
      accessCode: r.access_code,
      metadata: safeJsonParse(r.metadata, {}),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  },

  async updateStatus(
    reference: string,
    status: string,
    extra?: { authorizationUrl?: string | null; accessCode?: string | null; metadata?: Record<string, any> }
  ): Promise<PaymentRecord | null> {
    const existing = await query('SELECT * FROM payments WHERE reference = $1', [reference]);
    if (existing.rows.length === 0) return null;
    const current = existing.rows[0];

    const newAuthUrl = extra?.authorizationUrl !== undefined ? extra.authorizationUrl : current.authorization_url;
    const newAccessCode = extra?.accessCode !== undefined ? extra.accessCode : current.access_code;
    const mergedMetadata = extra?.metadata ? { ...safeJsonParse(current.metadata, {}), ...extra.metadata } : safeJsonParse(current.metadata, {});

    const res = await query(
      `UPDATE payments
       SET status = $1, authorization_url = $2, access_code = $3, metadata = $4, updated_at = NOW()
       WHERE reference = $5
       RETURNING *`,
      [status, newAuthUrl, newAccessCode, JSON.stringify(mergedMetadata), reference]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      businessId: r.business_id,
      userId: r.user_id,
      plan: r.plan as SubscriptionPlanId,
      amount: Number(r.amount),
      currency: r.currency,
      reference: r.reference,
      provider: r.provider,
      status: r.status,
      authorizationUrl: r.authorization_url,
      accessCode: r.access_code,
      metadata: safeJsonParse(r.metadata, {}),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  },
};
