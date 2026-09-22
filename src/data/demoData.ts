import { Business, Customer, FollowUp, Order, Product, User, BusinessSettings } from '../types';

export const DEMO_USER_ID = 'usr_zarah_01';
export const DEMO_BUSINESS_ID = 'biz_zarah_styles';

export const demoUser: User = {
  id: DEMO_USER_ID,
  name: 'Zarah Alabi',
  email: 'zarah@zarahstyles.ng',
  businessId: DEMO_BUSINESS_ID,
  createdAt: '2026-08-01T08:00:00.000Z',
};

export const demoBusiness: Business = {
  id: DEMO_BUSINESS_ID,
  ownerId: DEMO_USER_ID,
  name: 'Zarah Styles',
  category: 'fashion',
  description: 'Premium curated footwear, luxury leather bags, and contemporary afro-urban fashion for modern Nigerian trendsetters.',
  phone: '+234 803 456 7890',
  location: 'Lekki Phase 1, Lagos, Nigeria',
  currency: '₦',
  deliveryInfo: '• Lagos Mainland: ₦2,500 (Same day or Next day delivery)\n• Lagos Island (Lekki, VI, Ikoyi, Ajah): ₦3,000 (Dispatch rider)\n• Abuja & Port Harcourt: ₦4,500 (2-3 business days via GIG Logistics)\n• Other States: ₦5,000 via courier\n• Free delivery on orders above ₦100,000',
  returnPolicy: 'We allow size exchanges and returns within 48 hours of receipt. Items must be unworn with original tags attached. Customer covers return dispatch fee unless item was damaged.',
  paymentInstructions: 'Bank Transfer Details:\nBank: GTBank\nAccount Number: 0258941230\nAccount Name: Zarah Styles Retail Ltd\n*Please send payment receipt screenshot on WhatsApp for instant order confirmation.*',
  faqs: [
    { question: 'Do you have physical pickup in Lagos?', answer: 'Yes! Pickup is available at our Lekki Phase 1 studio between 10am and 6pm Mondays to Saturdays.' },
    { question: 'Can I pay on delivery (POD)?', answer: 'Pay on delivery is currently only available for verified return customers within Lagos Island with a ₦2,000 commitment dispatch fee.' },
    { question: 'What sizes are available for sneakers?', answer: 'We stock European shoe sizes 38 through 45.' }
  ],
  createdAt: '2026-08-01T08:00:00.000Z',
  onboardingCompleted: true,
};

export const demoSettings: BusinessSettings = {
  businessId: DEMO_BUSINESS_ID,
  defaultTone: 'friendly',
  language: 'English',
  pidginEnabled: true,
  quickReplies: [
    { title: 'Payment Details', template: 'Here are our payment details:\nBank: GTBank\nAccount: 0258941230\nName: Zarah Styles Retail Ltd\nKindly share your receipt once done so we can dispatch immediately! 🚀' },
    { title: 'Delivery Rates', template: 'We deliver nationwide! 🚚\nLagos Mainland: ₦2,500 | Lagos Island: ₦3,000\nAbuja & Port Harcourt: ₦4,500 (2-3 days)\nWhat is your preferred delivery location?' },
    { title: 'Order Confirmation', template: 'Payment confirmed with thanks! 🎉 Your order is being packed. Our dispatch rider will contact you upon arrival.' },
  ],
};

export const demoProducts: Product[] = [
  {
    id: 'prod_001',
    businessId: DEMO_BUSINESS_ID,
    name: 'Black Leather Sneaker',
    price: 35000,
    category: 'Shoes',
    description: 'Handcrafted top-grain black calfskin sneakers with cushioned memory-foam insole and durable rubber outsole. Perfect for smart-casual outings and daily comfort.',
    images: [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=600&q=80'
    ],
    stockQuantity: 4, // low stock!
    sku: 'ZS-SH-BLK-01',
    status: 'active',
    variants: [
      { id: 'var_01_39', name: 'Size 39', stock: 1 },
      { id: 'var_01_40', name: 'Size 40', stock: 0 },
      { id: 'var_01_41', name: 'Size 41', stock: 1 },
      { id: 'var_01_42', name: 'Size 42', stock: 1 },
      { id: 'var_01_43', name: 'Size 43', stock: 1 },
    ],
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-09-15T14:30:00.000Z',
  },
  {
    id: 'prod_002',
    businessId: DEMO_BUSINESS_ID,
    name: 'Classic Handbag',
    price: 45000,
    category: 'Bags',
    description: 'Structured genuine leather tote bag with gold-tone hardware, detachable shoulder strap, and interior zippered compartments. Available in warm tan and noir.',
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=600&q=80'
    ],
    stockQuantity: 2, // low stock!
    sku: 'ZS-BG-CLS-02',
    status: 'active',
    variants: [
      { id: 'var_02_tan', name: 'Caramel Tan', stock: 1 },
      { id: 'var_02_blk', name: 'Midnight Black', stock: 1 },
    ],
    createdAt: '2026-08-12T11:00:00.000Z',
    updatedAt: '2026-09-17T09:15:00.000Z',
  },
  {
    id: 'prod_003',
    businessId: DEMO_BUSINESS_ID,
    name: 'Premium T-Shirt',
    price: 18000,
    category: 'Apparel',
    description: 'Heavyweight 240 GSM combed cotton crewneck t-shirt with reinforced ribbed collar. Pre-shrunk and exceptionally soft with subtle tonal chest embroidery.',
    images: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&q=80'
    ],
    stockQuantity: 28,
    sku: 'ZS-TS-PRM-03',
    status: 'active',
    variants: [
      { id: 'var_03_s', name: 'White / S', stock: 6 },
      { id: 'var_03_m', name: 'White / M', stock: 8 },
      { id: 'var_03_l', name: 'White / L', stock: 9 },
      { id: 'var_03_xl', name: 'Black / M', stock: 5 },
    ],
    createdAt: '2026-08-15T12:00:00.000Z',
    updatedAt: '2026-09-18T10:00:00.000Z',
  },
  {
    id: 'prod_004',
    businessId: DEMO_BUSINESS_ID,
    name: 'Casual Sneakers',
    price: 42000,
    category: 'Shoes',
    description: 'Chunky white and emerald silhouette with premium mesh and suede overlays. Breathable lining and responsive high-rebound cushioning.',
    images: [
      'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=600&q=80'
    ],
    stockQuantity: 3, // low stock!
    sku: 'ZS-SH-CSL-04',
    status: 'active',
    variants: [
      { id: 'var_04_41', name: 'Size 41', stock: 1 },
      { id: 'var_04_42', name: 'Size 42', stock: 1 },
      { id: 'var_04_43', name: 'Size 43', stock: 1 },
    ],
    createdAt: '2026-08-20T14:00:00.000Z',
    updatedAt: '2026-09-18T11:00:00.000Z',
  },
  {
    id: 'prod_005',
    businessId: DEMO_BUSINESS_ID,
    name: 'Ankara Modern Midi Dress',
    price: 28000,
    category: 'Apparel',
    description: 'Sophisticated contemporary wrap midi dress crafted from vibrant, non-bleeding 100% Hollandis Ankara wax print with flattering waist tie.',
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80'
    ],
    stockQuantity: 12,
    sku: 'ZS-DR-ANK-05',
    status: 'active',
    variants: [
      { id: 'var_05_m', name: 'Medium (UK 10-12)', stock: 7 },
      { id: 'var_05_l', name: 'Large (UK 14-16)', stock: 5 },
    ],
    createdAt: '2026-08-25T15:00:00.000Z',
    updatedAt: '2026-09-10T16:00:00.000Z',
  }
];

export const demoCustomers: Customer[] = [
  {
    id: 'cust_001',
    businessId: DEMO_BUSINESS_ID,
    name: 'Chidinma Eze',
    phone: '+234 802 345 6789',
    email: 'chidinma.eze@gmail.com',
    location: 'Wuse 2, Abuja',
    ordersCount: 3,
    totalSpent: 112000,
    lastOrderDate: '2026-09-18T14:30:00.000Z',
    status: 'VIP',
    notes: 'Prefers Abuja delivery via GIG Wuse terminal. Loves genuine leather bags and always pays promptly via GTBank.',
    dateAdded: '2026-08-15T09:00:00.000Z',
    interactions: [
      { id: 'int_1', type: 'order', summary: 'Ordered Classic Handbag (Tan) + Delivery to Abuja', channel: 'WhatsApp', timestamp: '2026-09-18T14:30:00.000Z' },
      { id: 'int_2', type: 'inquiry', summary: 'Asked about handbag stock and delivery duration to Abuja', channel: 'WhatsApp', timestamp: '2026-09-18T13:10:00.000Z' },
    ]
  },
  {
    id: 'cust_002',
    businessId: DEMO_BUSINESS_ID,
    name: 'Oluwaseun Adeyemi',
    phone: '+234 813 987 6543',
    email: 'seun.adeyemi@yahoo.com',
    location: 'Lekki Phase 1, Lagos',
    ordersCount: 2,
    totalSpent: 73000,
    lastOrderDate: '2026-09-18T11:15:00.000Z',
    status: 'Repeat Customer',
    notes: 'Frequent buyer for shoe size 42. Needs prompt morning dispatch.',
    dateAdded: '2026-08-20T10:00:00.000Z',
    interactions: [
      { id: 'int_3', type: 'order', summary: 'Purchased Black Leather Sneaker (Size 42)', channel: 'Instagram', timestamp: '2026-09-18T11:15:00.000Z' }
    ]
  },
  {
    id: 'cust_003',
    businessId: DEMO_BUSINESS_ID,
    name: 'Fatima Mohammed',
    phone: '+234 809 112 3344',
    email: 'fatima.m@outlook.com',
    location: 'Gwarinpa, Abuja',
    ordersCount: 1,
    totalSpent: 49500,
    lastOrderDate: '2026-09-17T16:45:00.000Z',
    status: 'Follow-up Needed',
    notes: 'Placed order for Casual Sneakers. Has not sent transfer receipt yet.',
    dateAdded: '2026-09-16T12:00:00.000Z',
    interactions: [
      { id: 'int_4', type: 'inquiry', summary: 'Inquired about size 41 and transfer details', channel: 'WhatsApp', timestamp: '2026-09-17T16:20:00.000Z' }
    ]
  },
  {
    id: 'cust_004',
    businessId: DEMO_BUSINESS_ID,
    name: 'Emeka Okonkwo',
    phone: '+234 703 555 8899',
    email: 'emeka.okonkwo@gmail.com',
    location: 'GRA Phase 2, Port Harcourt',
    ordersCount: 0,
    totalSpent: 0,
    status: 'Interested',
    notes: 'DMed asking about wholesale pricing on Premium T-Shirts. Sent catalog.',
    dateAdded: '2026-09-17T08:30:00.000Z',
    interactions: [
      { id: 'int_5', type: 'inquiry', summary: 'Asked about bulk discount for 10 units', channel: 'WhatsApp', timestamp: '2026-09-17T08:30:00.000Z' }
    ]
  },
  {
    id: 'cust_005',
    businessId: DEMO_BUSINESS_ID,
    name: 'Zainab Bello',
    phone: '+234 816 777 2211',
    email: 'zainab.bello@gmail.com',
    location: 'Ikeja GRA, Lagos',
    ordersCount: 1,
    totalSpent: 30500,
    lastOrderDate: '2026-09-16T10:00:00.000Z',
    status: 'Follow-up Needed',
    notes: 'Bought Ankara dress last month; asked about matching bag 2 days ago but stopped replying.',
    dateAdded: '2026-08-05T14:00:00.000Z',
    interactions: [
      { id: 'int_6', type: 'inquiry', summary: 'Asked if Classic Handbag in Tan matches her Ankara wrap dress', channel: 'Instagram', timestamp: '2026-09-16T14:10:00.000Z' }
    ]
  },
  {
    id: 'cust_006',
    businessId: DEMO_BUSINESS_ID,
    name: 'Tunde Bakare',
    phone: '+234 805 443 2190',
    email: 'tundebakare@gmail.com',
    location: 'Yaba, Lagos',
    ordersCount: 1,
    totalSpent: 37500,
    lastOrderDate: '2026-09-18T09:00:00.000Z',
    status: 'Paid',
    notes: 'Paid via GTBank for Black Leather Sneaker size 41. Delivery scheduled for today.',
    dateAdded: '2026-09-17T18:00:00.000Z',
  }
];

export const demoOrders: Order[] = [
  {
    id: 'SP-1082',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_001',
    customerName: 'Chidinma Eze',
    customerPhone: '+234 802 345 6789',
    items: [
      {
        id: 'item_1',
        productId: 'prod_002',
        productName: 'Classic Handbag',
        variantName: 'Caramel Tan',
        quantity: 1,
        unitPrice: 45000,
        totalPrice: 45000,
      }
    ],
    productSubtotal: 45000,
    deliveryFee: 4500,
    discount: 0,
    total: 49500,
    paymentStatus: 'Paid',
    orderStatus: 'Processing',
    deliveryAddress: 'Plot 414 Ahmadu Bello Way, Wuse 2, Abuja (Opposite Zenith Bank)',
    notes: 'Customer requested fast courier dispatch. GTBank transfer confirmed.',
    createdDate: '2026-09-18T14:30:00.000Z',
  },
  {
    id: 'SP-1081',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_002',
    customerName: 'Oluwaseun Adeyemi',
    customerPhone: '+234 813 987 6543',
    items: [
      {
        id: 'item_2',
        productId: 'prod_001',
        productName: 'Black Leather Sneaker',
        variantName: 'Size 42',
        quantity: 1,
        unitPrice: 35000,
        totalPrice: 35000,
      }
    ],
    productSubtotal: 35000,
    deliveryFee: 3000,
    discount: 0,
    total: 38000,
    paymentStatus: 'Paid',
    orderStatus: 'Delivered',
    deliveryAddress: 'Block 12, Admiralty Way, Lekki Phase 1, Lagos',
    notes: 'Delivered by internal dispatch rider at 1:15pm.',
    createdDate: '2026-09-18T11:15:00.000Z',
  },
  {
    id: 'SP-1080',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_006',
    customerName: 'Tunde Bakare',
    customerPhone: '+234 805 443 2190',
    items: [
      {
        id: 'item_3',
        productId: 'prod_001',
        productName: 'Black Leather Sneaker',
        variantName: 'Size 41',
        quantity: 1,
        unitPrice: 35000,
        totalPrice: 35000,
      }
    ],
    productSubtotal: 35000,
    deliveryFee: 2500,
    discount: 0,
    total: 37500,
    paymentStatus: 'Paid',
    orderStatus: 'Processing',
    deliveryAddress: 'Herbert Macaulay Way, Yaba, Lagos (Near Tejuosho Market)',
    notes: 'Dispatched with Mainland dispatch team.',
    createdDate: '2026-09-18T09:00:00.000Z',
  },
  {
    id: 'SP-1079',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_003',
    customerName: 'Fatima Mohammed',
    customerPhone: '+234 809 112 3344',
    items: [
      {
        id: 'item_4',
        productId: 'prod_004',
        productName: 'Casual Sneakers',
        variantName: 'Size 41',
        quantity: 1,
        unitPrice: 42000,
        totalPrice: 42000,
      }
    ],
    productSubtotal: 42000,
    deliveryFee: 4500,
    discount: 0,
    total: 46500,
    paymentStatus: 'Payment Pending',
    orderStatus: 'Payment Pending',
    deliveryAddress: '1st Avenue, Gwarinpa Estate, Abuja',
    notes: 'Waiting for transfer receipt confirmation.',
    createdDate: '2026-09-17T16:45:00.000Z',
  },
  {
    id: 'SP-1078',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_005',
    customerName: 'Zainab Bello',
    customerPhone: '+234 816 777 2211',
    items: [
      {
        id: 'item_5',
        productId: 'prod_005',
        productName: 'Ankara Modern Midi Dress',
        variantName: 'Medium (UK 10-12)',
        quantity: 1,
        unitPrice: 28000,
        totalPrice: 28000,
      }
    ],
    productSubtotal: 28000,
    deliveryFee: 2500,
    discount: 0,
    total: 30500,
    paymentStatus: 'Paid',
    orderStatus: 'Delivered',
    deliveryAddress: 'Isaac John Street, GRA Ikeja, Lagos',
    notes: 'Loved the dress, left glowing feedback on Instagram.',
    createdDate: '2026-09-16T10:00:00.000Z',
  },
  {
    id: 'SP-1077',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_001',
    customerName: 'Chidinma Eze',
    customerPhone: '+234 802 345 6789',
    items: [
      {
        id: 'item_6',
        productId: 'prod_003',
        productName: 'Premium T-Shirt',
        variantName: 'White / M',
        quantity: 3,
        unitPrice: 18000,
        totalPrice: 54000,
      }
    ],
    productSubtotal: 54000,
    deliveryFee: 4500,
    discount: 5000,
    total: 53500,
    paymentStatus: 'Paid',
    orderStatus: 'Delivered',
    deliveryAddress: 'Plot 414 Ahmadu Bello Way, Wuse 2, Abuja',
    notes: 'Applied repeat customer promo discount of ₦5,000.',
    createdDate: '2026-09-10T11:20:00.000Z',
  }
];

export const demoFollowUps: FollowUp[] = [
  {
    id: 'fu_001',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_003',
    customerName: 'Fatima Mohammed',
    customerPhone: '+234 809 112 3344',
    reason: 'Customer requested order for Casual Sneakers (Size 41) but hasn’t completed payment.',
    suggestedMessage: 'Hi Fatima 👋 Just following up on your Casual Sneakers order (₦46,500 including Abuja delivery). We have only 1 pair left in Size 41, so please let me know if you would like us to reserve it with payment confirmation today! 😊',
    status: 'Pending',
    dueDate: '2026-09-19T10:00:00.000Z',
    createdAt: '2026-09-17T18:00:00.000Z',
  },
  {
    id: 'fu_002',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_004',
    customerName: 'Emeka Okonkwo',
    customerPhone: '+234 703 555 8899',
    reason: 'Customer asked about bulk discount on Premium T-Shirts yesterday.',
    suggestedMessage: 'Hello Emeka 👋 Hope your day is going well! Regarding your inquiry on our Premium T-Shirts, we can offer 10% off for orders of 10 pieces or more (₦16,200 per shirt instead of ₦18,000). Would you like me to send over the available color combinations?',
    status: 'Pending',
    dueDate: '2026-09-19T12:00:00.000Z',
    createdAt: '2026-09-17T09:00:00.000Z',
  },
  {
    id: 'fu_003',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_005',
    customerName: 'Zainab Bello',
    customerPhone: '+234 816 777 2211',
    reason: 'Customer asked about the Classic Handbag in Tan to match her Ankara dress.',
    suggestedMessage: 'Hi Zainab 👋 Just checking in about the Classic Handbag in Caramel Tan you asked about yesterday! We have only 2 pieces remaining in stock right now. Would you still like us to pack one for delivery to Ikeja? ✨',
    status: 'Pending',
    dueDate: '2026-09-18T16:00:00.000Z',
    createdAt: '2026-09-16T15:00:00.000Z',
  },
  {
    id: 'fu_004',
    businessId: DEMO_BUSINESS_ID,
    customerId: 'cust_002',
    customerName: 'Oluwaseun Adeyemi',
    customerPhone: '+234 813 987 6543',
    reason: 'Confirm receipt of Black Leather Sneaker delivered this afternoon.',
    suggestedMessage: 'Hi Seun 👋 Your Black Leather Sneakers should have arrived with our rider in Lekki! Hope they fit perfectly. Please let us know how you like them, and thank you for shopping with Zarah Styles! 👟🔥',
    status: 'Contacted',
    dueDate: '2026-09-18T15:00:00.000Z',
    createdAt: '2026-09-18T12:00:00.000Z',
  }
];
