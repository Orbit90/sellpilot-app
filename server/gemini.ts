import { GoogleGenAI } from '@google/genai';
import {
  Business,
  ConversationAnalysis,
  ConversationIntent,
  Customer,
  DetectedProduct,
  InterestLevel,
  LeadStage,
  PotentialOrderItem,
  Product,
  ResponseTone,
} from '../src/types';

// Lazy-initialized GoogleGenAI client
let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Resilient model cascade: if primary model experiences 503 high demand or 429 rate limit, fallback gracefully
const PRIMARY_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];

async function generateWithModelFallback(params: {
  contents: any;
  config?: any;
}): Promise<string | null> {
  const ai = getGenAI();
  if (!ai) return null;

  for (let i = 0; i < PRIMARY_MODELS.length; i++) {
    const model = PRIMARY_MODELS[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      const text = response.text?.trim();
      if (text) return text;
    } catch (err: any) {
      const isCapacityError =
        err?.status === 503 ||
        err?.code === 503 ||
        err?.status === 429 ||
        err?.message?.includes('503') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.message?.includes('429') ||
        err?.message?.includes('resource_exhausted') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('quota');

      if (isCapacityError && i < PRIMARY_MODELS.length - 1) {
        console.warn(`Model ${model} experienced temporary demand spike, failing over to ${PRIMARY_MODELS[i + 1]}...`);
        // Short pause before failover
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      console.warn(`Gemini generation on ${model} failed:`, err?.message || err);
      // If last model failed with capacity error or another error, continue to try next or exit
    }
  }
  return null;
}

export interface AIReplyRequest {
  customerMessage: string;
  tone: ResponseTone;
  business: Business;
  products: Product[];
  customer?: Customer | null;
  adjustmentType?: 'shorter' | 'professional' | 'friendly' | 'cta' | null;
  existingDraft?: string;
}

export interface AIReplyResult {
  reply: string;
  tone: ResponseTone;
  source: 'gemini' | 'local_heuristic';
  missingInfoFlag?: boolean;
  missingInfoNote?: string;
}

export async function generateAIReply(params: AIReplyRequest): Promise<AIReplyResult> {
  const { customerMessage, tone, business, products, customer, adjustmentType, existingDraft } = params;

  // Active products in catalog
  const activeProducts = products.filter((p) => p.status === 'active');
  const catalogList = activeProducts
    .map((p) => {
      const variantStr =
        p.variants && p.variants.length > 0
          ? ` [Variants: ${p.variants.map((v) => `${v.name} (Stock: ${v.stock})`).join(', ')}]`
          : '';
      return `- Product: "${p.name}" | Price: ₦${p.price.toLocaleString()} | Available Stock: ${p.stockQuantity} units | Category: ${p.category}${variantStr} | Description: ${p.description}`;
    })
    .join('\n');

  const businessContext = `
STORE CONTEXT (ONLY RELY ON THESE FACTS):
- Store Name: ${business.name}
- Store Category: ${business.category}
- Store Description: ${business.description}
- Store Location: ${business.location}
- Operating Phone: ${business.phone}
- Store Currency: ${business.currency || '₦'}
- Official Delivery Policy & Rates:
${business.deliveryInfo || 'Standard nationwide delivery available. Please provide your delivery address.'}
- Official Return / Exchange Policy:
${business.returnPolicy || 'Standard return policy applies.'}
- Official Bank Payment Instructions:
${business.paymentInstructions || 'Direct bank transfer. Contact store for details.'}

STORE PRODUCT CATALOG:
${catalogList.length > 0 ? catalogList : 'No products currently listed.'}
`;

  const toneInstructions: Record<ResponseTone, string> = {
    friendly: 'Warm, hospitable, cheerful, conversational, welcoming with 1-2 tasteful emojis. Helpful and accommodating.',
    professional: 'Polite, clear, corporate, respectful, formal and direct. Zero slang, minimal emojis.',
    persuasive: 'Highlight product quality, real stock availability from catalog, and gently guide the customer to complete their order today.',
    casual: 'Modern, breezy, relaxed, direct and approachable, like chatting with a knowledgeable friend on WhatsApp.',
    nigerian_business: 'Authentic Nigerian commercial tone: Respectful ("Good day", "Yes please", "Thank you for reaching out to us"), courteous, polite.',
    pidgin: 'Authentic and natural Nigerian Pidgin English! e.g., "How far? The shoe dey available for ₦35,000. Make I package am for you?"',
    nigerian_pidgin: 'Authentic and natural Nigerian Pidgin English! e.g., "How far? The shoe dey available for ₦35,000. Make I package am for you?"',
  };

  const systemInstruction = `You are SellPilot, an AI sales assistant for "${business.name}", a Nigerian business selling via WhatsApp and Instagram.
Your mission: "Turn customer conversations into completed sales."

${businessContext}

TONE REQUIREMENTS:
Selected Tone: "${tone.toUpperCase()}".
${toneInstructions[tone]}

MANDATORY ANTI-HALLUCINATION GUARDRAILS (CRITICAL):
1. NEVER invent, fabricate, or assume product prices, stock availability, discounts, delivery fees, return policies, or bank details.
2. IF the customer asks for a product NOT listed in the catalog above: State politely that this item is currently not in the catalog / out of stock. Do NOT quote a price or confirm availability for unlisted items.
3. IF the customer asks for delivery fee: Cite ONLY the official delivery rates provided in the context above. If their exact state/LGA is needed, ask for their delivery address. NEVER invent random dispatch fees.
4. IF the customer asks for bank details: Provide ONLY the store's official bank payment instructions above. NEVER make up account numbers or bank names.
5. IF this is an adjustment (shorter, professional, friendly, or cta): You must preserve the verified facts, prices, and bank details from the existing draft. NEVER add new unverified claims.
6. Format your response cleanly for mobile WhatsApp / Instagram messaging (1 to 3 short paragraphs).`;

  let userPrompt = `CUSTOMER MESSAGE:\n"${customerMessage}"\n\nGenerate the sales conversion response:`;

  if (adjustmentType && existingDraft) {
    if (adjustmentType === 'shorter') {
      userPrompt = `Existing draft: "${existingDraft}". Rewrite this to be significantly shorter, punchier, and faster to read on WhatsApp, keeping all catalog prices and bank details strictly intact without adding hallucinations.`;
    } else if (adjustmentType === 'professional') {
      userPrompt = `Existing draft: "${existingDraft}". Rewrite this in a professional, courteous commercial tone, preserving all factual prices and details.`;
    } else if (adjustmentType === 'friendly') {
      userPrompt = `Existing draft: "${existingDraft}". Rewrite this in a warm, welcoming, friendly tone with cheerful emojis, preserving all factual prices and details.`;
    } else if (adjustmentType === 'cta') {
      userPrompt = `Existing draft: "${existingDraft}". Strengthen the closing Call to Action (e.g. asking for delivery address or confirming dispatch) while preserving all facts.`;
    }
  }

  const replyText = await generateWithModelFallback({
    contents: userPrompt,
    config: {
      systemInstruction,
      temperature: 0.5,
    },
  });

  if (replyText) {
    return {
      reply: replyText,
      tone,
      source: 'gemini',
    };
  }

  // Fallback heuristic engine
  return generateHeuristicReply({
    customerMessage,
    tone,
    business,
    products,
    customer,
    adjustmentType,
    existingDraft,
  });
}

function generateHeuristicReply(params: AIReplyRequest): AIReplyResult {
  const { customerMessage, tone, business, products, adjustmentType, existingDraft } = params;

  // Refinements preserving factual integrity
  if (adjustmentType && existingDraft) {
    if (adjustmentType === 'shorter') {
      const lines = existingDraft.split('\n').filter((l) => l.trim().length > 0);
      const shortened = lines.slice(0, 2).join('\n');
      return {
        reply: shortened.length > 20 ? shortened : existingDraft.slice(0, 140) + '...',
        tone,
        source: 'local_heuristic',
      };
    }
    if (adjustmentType === 'professional') {
      const cleaned = existingDraft.replace(/👋|🔥|🎉|🚀|✨|😊/g, '').trim();
      return {
        reply: `Good day. In response to your inquiry regarding ${business.name}: ${cleaned}\n\nPlease let us know if you require further details.`,
        tone,
        source: 'local_heuristic',
      };
    }
    if (adjustmentType === 'friendly') {
      return {
        reply: `Hello! 👋 Thanks so much for reaching out to ${business.name}! ${existingDraft} We'd love to help you get this! ✨`,
        tone,
        source: 'local_heuristic',
      };
    }
    if (adjustmentType === 'cta') {
      return {
        reply: `${existingDraft}\n\nWould you like us to reserve this for you today? Kindly share your delivery address so we can confirm dispatch right away!`,
        tone,
        source: 'local_heuristic',
      };
    }
  }

  const lowerMsg = customerMessage.toLowerCase();

  // Check if asking about bank details
  const asksBank =
    lowerMsg.includes('account') ||
    lowerMsg.includes('bank') ||
    lowerMsg.includes('transfer') ||
    lowerMsg.includes('pay details') ||
    lowerMsg.includes('how to pay');

  // Check if asking about delivery
  const asksDelivery =
    lowerMsg.includes('deliver') ||
    lowerMsg.includes('dispatch') ||
    lowerMsg.includes('waybill') ||
    lowerMsg.includes('shipping') ||
    lowerMsg.includes('abuja') ||
    lowerMsg.includes('lagos') ||
    lowerMsg.includes('port harcourt');

  // Check if asking about return policy
  const asksReturn =
    lowerMsg.includes('return') ||
    lowerMsg.includes('exchange') ||
    lowerMsg.includes('refund') ||
    lowerMsg.includes('does not fit') ||
    lowerMsg.includes('doesn\'t fit');

  // Product catalog lookup
  const matchedProduct = products.find((p) => {
    const pName = p.name.toLowerCase();
    const words = pName.split(/\s+/).filter((w) => w.length > 2);
    return lowerMsg.includes(pName) || words.some((w) => lowerMsg.includes(w));
  });

  const isPidgin = tone === 'nigerian_pidgin' || tone === 'pidgin';

  let greeting = 'Hello 👋';
  if (tone === 'professional') greeting = `Good day, thank you for contacting ${business.name}.`;
  if (tone === 'nigerian_business') greeting = `Good day! Thank you for reaching out to ${business.name}.`;
  if (tone === 'casual') greeting = 'Hey there!';
  if (isPidgin) greeting = `How far! 👋 Thank you for checking out ${business.name}.`;

  // CASE D: Customer asks for payment / bank details
  if (asksBank && !matchedProduct) {
    const bankReply = isPidgin
      ? `${greeting} See our official payment details below:\n\n${business.paymentInstructions}\n\nOnce you transfer, abeg send receipt make we confirm and dispatch am sharp-sharp!`
      : `${greeting} Here are our official bank payment details:\n\n${business.paymentInstructions}\n\nKindly share your transfer receipt once done so we can verify and dispatch immediately.`;
    return {
      reply: bankReply,
      tone,
      source: 'local_heuristic',
    };
  }

  // CASE C: Customer asks for delivery fees
  if (asksDelivery && !matchedProduct) {
    const deliveryReply = isPidgin
      ? `${greeting} We dey deliver nationwide across Nigeria! See our delivery guideline:\n\n${business.deliveryInfo}\n\nKindly send your exact location/bus stop make we tell you the exact dispatch fee!`
      : `${greeting} Yes, we provide reliable delivery nationwide! Here is our standard delivery guideline:\n\n${business.deliveryInfo}\n\nCould you please share your specific delivery address or state so we can confirm the exact dispatch fee for you?`;
    return {
      reply: deliveryReply,
      tone,
      source: 'local_heuristic',
    };
  }

  // Return policy query
  if (asksReturn && !matchedProduct) {
    const returnReply = isPidgin
      ? `${greeting} About exchange, here be our policy: ${business.returnPolicy}. Make you no worry, we dey always make sure say you enjoy your purchase!`
      : `${greeting} Here is our official return and exchange policy: ${business.returnPolicy}. Please let us know if you have any questions!`;
    return {
      reply: returnReply,
      tone,
      source: 'local_heuristic',
    };
  }

  // CASE A: Customer asks about a product IN catalog
  if (matchedProduct) {
    const formattedPrice = `₦${matchedProduct.price.toLocaleString()}`;
    let productDetails = '';

    if (isPidgin) {
      productDetails = `The ${matchedProduct.name} na ${formattedPrice}, and we get am available for stock right now.`;
    } else {
      productDetails = `The ${matchedProduct.name} is ${formattedPrice} and it is currently available in stock.`;
    }

    if (matchedProduct.variants && matchedProduct.variants.length > 0) {
      const availVariants = matchedProduct.variants
        .filter((v) => v.stock > 0)
        .map((v) => v.name)
        .join(', ');
      if (availVariants) {
        productDetails += isPidgin
          ? ` Options wey dey available: ${availVariants}.`
          : ` Available sizes/variants: ${availVariants}.`;
      }
    }

    if (asksDelivery) {
      productDetails += isPidgin
        ? ` We fit deliver am enter your location easily.`
        : ` We deliver nationwide across Nigeria.`;
    }

    const cta = isPidgin
      ? `Make I package this for you? Just drop your delivery address make we run am! 🚀`
      : `Would you like me to help reserve this for you? Please send your delivery location to confirm dispatch!`;

    return {
      reply: `${greeting} ${productDetails}\n\n${cta}`,
      tone,
      source: 'local_heuristic',
    };
  }

  // CASE B: Customer asks for product NOT in catalog / unlisted item
  const unlistedReply = isPidgin
    ? `${greeting} Thank you for asking. That particular item is currently not in our catalog or is out of stock. Would you like to check our available collection or should we notify you when new stock arrives?`
    : `${greeting} Thank you for your inquiry. That specific item is currently not available in our catalog. Would you like us to recommend similar available items from our store, or notify you when new arrivals land?`;

  return {
    reply: unlistedReply,
    tone,
    source: 'local_heuristic',
    missingInfoFlag: true,
    missingInfoNote: 'Inquired item is not in the active store catalog.',
  };
}

// ---------------------------------------------------------
// CONVERSATION ANALYZER ENGINE
// ---------------------------------------------------------

export interface AnalyzeConversationInput {
  conversationText: string;
  business: Business;
  products: Product[];
  customers: Customer[];
  tone?: ResponseTone;
}

export interface ConversationAnalysisPayload {
  customerName: string;
  customerPhone: string;
  intent: ConversationIntent;
  leadStage: LeadStage;
  interestLevel: InterestLevel;
  productsMentioned: DetectedProduct[];
  questionsAsked: string[];
  objections: string[];
  missingInformation: string[];
  purchaseLikelihood: InterestLevel;
  recommendedAction: string;
  suggestedReply: string;
  followUpRecommended: boolean;
  followUpReason: string;
  orderOpportunity: boolean;
  orderItems: PotentialOrderItem[];
  deliveryFeeEstimated: number | null;
  deliveryFeeConfirmed: boolean;
  confidence: number;
}

export async function analyzeConversation(
  params: AnalyzeConversationInput
): Promise<ConversationAnalysisPayload> {
  const { conversationText, business, products, customers, tone = 'friendly' } = params;

  const catalogContext = products
    .filter((p) => p.status === 'active')
    .map((p) => {
      const variantStr =
        p.variants && p.variants.length > 0
          ? ` (Variants: ${p.variants.map((v) => `${v.name}, stock: ${v.stock}`).join('; ')})`
          : '';
      return `ID: "${p.id}", Name: "${p.name}", Price: ₦${p.price}, Stock: ${p.stockQuantity} units, Category: "${p.category}"${variantStr}`;
    })
    .join('\n');

  const customerDirectory = customers
    .map((c) => `ID: "${c.id}", Name: "${c.name}", Phone: "${c.phone}", Location: "${c.location}"`)
    .join('\n');

  const systemInstruction = `You are the AI Sales Intelligence Engine for SellPilot, analyzing WhatsApp conversations for Nigerian merchant "${business.name}".
Your task: extract sales intelligence, identify customers, detect catalog products, assess purchase readiness, and recommend grounded sales actions.

BUSINESS DATA (ONLY GROUND YOUR ANALYSIS IN THESE FACTS):
- Store Name: ${business.name}
- Category: ${business.category}
- Location: ${business.location}
- Delivery Rates & Guidelines:
${business.deliveryInfo || 'Nationwide delivery available. Address required.'}
- Official Return Policy:
${business.returnPolicy || 'Standard return policy.'}
- Official Bank Payment Instructions:
${business.paymentInstructions || 'Bank transfer details provided on order confirmation.'}

ACTIVE CATALOG PRODUCTS:
${catalogContext || 'No products in catalog.'}

EXISTING STORE CUSTOMERS:
${customerDirectory || 'No existing customers yet.'}

CRITICAL ANTI-HALLUCINATION & BUSINESS INTEGRITY RULES:
1. NEVER invent products, prices, stock levels, discounts, delivery fees, return policies, payment details, or business rules.
2. If a customer mentions an item not in the catalog above, you MUST set:
   matchedInCatalog: false, catalogPrice: null, currentStock: null, isAvailable: false.
   Do NOT pretend the store has the item or invent prices.
3. If delivery fee for a specific city/state (e.g., Abuja) is asked, and that specific fee is not in the store's delivery info above, explicitly list it in "missingInformation" (e.g. "Abuja delivery fee not confirmed in store settings").
4. If customer requests a discount (e.g. "Can you give me 30% discount?"):
   Add this to "objections". The AI MUST NOT promise or grant a discount unless explicitly configured in store policies.
5. "orderOpportunity": set to true ONLY if the conversation demonstrates clear purchase intent for available catalog products.
6. "followUpRecommended": set to true if customer showed interest or is considering, but has not completed purchase.
7. Return ONLY valid JSON matching the exact schema specified.`;

  const prompt = `Analyze this WhatsApp conversation text:

"""
${conversationText}
"""

Provide your output as a single JSON object with these exact keys:
{
  "customerName": string (detected customer name or empty string),
  "customerPhone": string (detected phone number or empty string),
  "intent": one of ["product_question", "price_question", "availability_question", "delivery_question", "payment_question", "purchase_intent", "complaint", "return_request", "negotiation", "general_question", "unclear"],
  "leadStage": one of ["new_lead", "interested", "considering", "ready_to_buy", "purchased", "lost", "support"],
  "interestLevel": one of ["low", "medium", "high"],
  "productsMentioned": [
    {
      "name": string,
      "productId": string or null,
      "matchedInCatalog": boolean,
      "catalogPrice": number or null,
      "currentStock": number or null,
      "quantityDiscussed": number,
      "variantDiscussed": string or null,
      "isAvailable": boolean
    }
  ],
  "questionsAsked": string[],
  "objections": string[],
  "missingInformation": string[],
  "purchaseLikelihood": one of ["low", "medium", "high"],
  "recommendedAction": string,
  "suggestedReply": string,
  "followUpRecommended": boolean,
  "followUpReason": string,
  "orderOpportunity": boolean,
  "orderItems": [
    {
      "productId": string,
      "productName": string,
      "variantName": string or null,
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number
    }
  ],
  "deliveryFeeEstimated": number or null,
  "deliveryFeeConfirmed": boolean,
  "confidence": number (50 to 99)
}`;

  const text = await generateWithModelFallback({
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.intent && parsed.leadStage && parsed.recommendedAction) {
        // Normalize and validate
        return validateAndSanitizeAnalysis(parsed, business, products, customers);
      }
    } catch (parseErr) {
      console.warn('Failed to parse Gemini JSON output, falling back to heuristic:', parseErr);
    }
  }

  // Fallback heuristic analysis
  return analyzeConversationHeuristic({
    conversationText,
    business,
    products,
    customers,
    tone,
  });
}

function validateAndSanitizeAnalysis(
  raw: any,
  business: Business,
  products: Product[],
  customers: Customer[]
): ConversationAnalysisPayload {
  const activeProducts = products.filter((p) => p.status === 'active');

  const productsMentioned: DetectedProduct[] = Array.isArray(raw.productsMentioned)
    ? raw.productsMentioned.map((item: any) => {
        const matched = activeProducts.find(
          (p) =>
            p.id === item.productId ||
            p.name.toLowerCase() === (item.name || '').toLowerCase() ||
            (item.name && p.name.toLowerCase().includes(item.name.toLowerCase()))
        );

        if (matched) {
          return {
            name: matched.name,
            productId: matched.id,
            matchedInCatalog: true,
            catalogPrice: Math.round(matched.price),
            currentStock: matched.stockQuantity,
            quantityDiscussed: Math.max(1, Number(item.quantityDiscussed) || 1),
            variantDiscussed: item.variantDiscussed || null,
            isAvailable: matched.stockQuantity > 0,
          };
        }

        return {
          name: item.name || 'Unknown item',
          productId: null,
          matchedInCatalog: false,
          catalogPrice: null,
          currentStock: null,
          quantityDiscussed: Math.max(1, Number(item.quantityDiscussed) || 1),
          variantDiscussed: item.variantDiscussed || null,
          isAvailable: false,
        };
      })
    : [];

  const orderItems: PotentialOrderItem[] = Array.isArray(raw.orderItems)
    ? raw.orderItems
        .map((oi: any) => {
          const prod = activeProducts.find((p) => p.id === oi.productId || p.name === oi.productName);
          if (!prod) return null;
          const qty = Math.max(1, Number(oi.quantity) || 1);
          const price = Math.round(prod.price);
          return {
            productId: prod.id,
            productName: prod.name,
            variantName: oi.variantName || null,
            quantity: qty,
            unitPrice: price,
            totalPrice: price * qty,
          };
        })
        .filter(Boolean) as PotentialOrderItem[]
    : [];

  return {
    customerName: String(raw.customerName || '').trim(),
    customerPhone: String(raw.customerPhone || '').trim(),
    intent: raw.intent || 'general_question',
    leadStage: raw.leadStage || 'new_lead',
    interestLevel: raw.interestLevel || 'medium',
    productsMentioned,
    questionsAsked: Array.isArray(raw.questionsAsked) ? raw.questionsAsked : [],
    objections: Array.isArray(raw.objections) ? raw.objections : [],
    missingInformation: Array.isArray(raw.missingInformation) ? raw.missingInformation : [],
    purchaseLikelihood: raw.purchaseLikelihood || 'medium',
    recommendedAction: String(raw.recommendedAction || 'Follow up with customer').trim(),
    suggestedReply: String(raw.suggestedReply || '').trim(),
    followUpRecommended: Boolean(raw.followUpRecommended),
    followUpReason: String(raw.followUpReason || '').trim(),
    orderOpportunity: Boolean(raw.orderOpportunity && orderItems.length > 0),
    orderItems,
    deliveryFeeEstimated: typeof raw.deliveryFeeEstimated === 'number' ? raw.deliveryFeeEstimated : null,
    deliveryFeeConfirmed: Boolean(raw.deliveryFeeConfirmed),
    confidence: Math.min(99, Math.max(50, Number(raw.confidence) || 85)),
  };
}

export function analyzeConversationHeuristic(
  params: AnalyzeConversationInput
): ConversationAnalysisPayload {
  const { conversationText, business, products, customers } = params;
  const lower = conversationText.toLowerCase();

  // 1. Extract customer name
  let customerName = '';
  const nameMatch =
    conversationText.match(/(?:Customer|Client|Buyer):\s*([A-Za-z\s]+?)(?:\n|$)/i) ||
    conversationText.match(/(?:Hi|Hello|I'm|I am|Name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);

  if (nameMatch && nameMatch[1]) {
    const candidate = nameMatch[1].trim();
    if (!['hi', 'hello', 'seller', 'good', 'okay'].includes(candidate.toLowerCase())) {
      customerName = candidate;
    }
  }

  // 2. Extract phone number
  let customerPhone = '';
  const phoneMatch = conversationText.match(/(\+?234|0)[789][01]\d{8}/);
  if (phoneMatch) {
    customerPhone = phoneMatch[0];
  }

  // Check matching customer in database
  let matchedCustomer: Customer | undefined;
  if (customerPhone) {
    matchedCustomer = customers.find((c) => c.phone.replace(/\D/g, '').includes(customerPhone.replace(/\D/g, '')));
  }
  if (!matchedCustomer && customerName) {
    matchedCustomer = customers.find((c) => c.name.toLowerCase() === customerName.toLowerCase());
  }
  if (matchedCustomer) {
    if (!customerName) customerName = matchedCustomer.name;
    if (!customerPhone) customerPhone = matchedCustomer.phone;
  }

  // 3. Catalog Products Detection
  const productsMentioned: DetectedProduct[] = [];
  const activeProducts = products.filter((p) => p.status === 'active');

  for (const prod of activeProducts) {
    const pName = prod.name.toLowerCase();
    const mentionsFull = lower.includes(pName);

    // Break into significant keywords (e.g. sneakers, handbag, t-shirt, dress)
    const pWords = pName.split(/[\s-]+/).map((w) => w.replace(/[^a-z0-9]/g, '')).filter((w) => w.length >= 4);
    const mentionsWords = pWords.length >= 2 && pWords.filter((w) => lower.includes(w)).length >= 2;

    // Check specific distinct terms like "sneakers", "handbag", "dress", "t-shirt"
    const distinctTerms = pWords.filter((w) => !['black', 'classic', 'premium', 'modern', 'casual', 'leather'].includes(w));
    const mentionsDistinctTerm = distinctTerms.some((t) => lower.includes(t) || lower.includes(t + 's') || (t.endsWith('s') && lower.includes(t.slice(0, -1))));

    if (mentionsFull || mentionsWords || mentionsDistinctTerm) {
      // Look for size/variant discussed
      let variantDiscussed: string | null = null;
      const sizeMatch = conversationText.match(/size\s*(\d{2})/i);
      if (sizeMatch) {
        variantDiscussed = `Size ${sizeMatch[1]}`;
      } else if (lower.includes('emerald') || lower.includes('green')) {
        variantDiscussed = 'Emerald Green';
      } else if (lower.includes('tan') || lower.includes('caramel')) {
        variantDiscussed = 'Caramel Tan';
      } else if (lower.includes('black') || lower.includes('noir')) {
        variantDiscussed = 'Midnight Black';
      }

      // Quantity
      let qty = 1;
      const qtyMatch = conversationText.match(/(\d+)\s*(?:pieces?|pairs?|units?|pcs)/i);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10) || 1;
      }

      productsMentioned.push({
        name: prod.name,
        productId: prod.id,
        matchedInCatalog: true,
        catalogPrice: prod.price,
        currentStock: prod.stockQuantity,
        quantityDiscussed: qty,
        variantDiscussed,
        isAvailable: prod.stockQuantity > 0,
      });
    }
  }

  // Check for unlisted product inquiries (e.g. Nike Air Force 1, iPhone 15, Rolex, etc.)
  const knownUnlistedPatterns = [
    /nike\s+air\s+force\s*1/i,
    /iphone\s*(?:14|15|16)/i,
    /rolex/i,
    /samsung\s+s\d+/i,
    /macbook/i,
    /perfume\s+oil/i,
    /jordan\s*\d*/i,
    /gucci\s+\w+/i,
    /yeezy/i,
  ];
  for (const pattern of knownUnlistedPatterns) {
    const m = conversationText.match(pattern);
    if (m) {
      const unlistedName = m[0];
      if (!productsMentioned.some((p) => p.name.toLowerCase().includes(unlistedName.toLowerCase()))) {
        productsMentioned.push({
          name: unlistedName,
          productId: null,
          matchedInCatalog: false,
          catalogPrice: null,
          currentStock: null,
          quantityDiscussed: 1,
          variantDiscussed: null,
          isAvailable: false,
        });
      }
    }
  }

  // If customer inquired about an item and no catalog product was matched, capture as unlisted
  if (productsMentioned.length === 0) {
    const askProductMatch = conversationText.match(/(?:do you have|i want|how much is|looking for|cost of)\s+([A-Za-z0-9\s]{3,30}?)(?:\s+in\s+stock|\s+size|\?|\n|$)/i);
    if (askProductMatch && askProductMatch[1]) {
      const candidateItem = askProductMatch[1].trim();
      const isCommonWord = ['delivery', 'account', 'discount', 'waybill', 'shipping'].includes(candidateItem.toLowerCase());
      if (!isCommonWord && candidateItem.length > 3) {
        productsMentioned.push({
          name: candidateItem,
          productId: null,
          matchedInCatalog: false,
          catalogPrice: null,
          currentStock: null,
          quantityDiscussed: 1,
          variantDiscussed: null,
          isAvailable: false,
        });
      }
    }
  }

  // 4. Extract Questions, Objections & Missing Info
  const questionsAsked: string[] = [];
  const objections: string[] = [];
  const missingInformation: string[] = [];

  // Delivery check
  const hasAbuja = lower.includes('abuja');
  const hasLagos = lower.includes('lagos') || lower.includes('lekki') || lower.includes('ikeja');
  const asksDeliveryCost =
    lower.includes('how much is delivery') ||
    lower.includes('how much is dispatch') ||
    lower.includes('delivery to') ||
    lower.includes('waybill');

  if (asksDeliveryCost) {
    if (hasAbuja) {
      questionsAsked.push('Delivery cost to Abuja');
      if (!business.deliveryInfo.toLowerCase().includes('abuja')) {
        missingInformation.push('Abuja delivery fee not confirmed in store settings');
      }
    } else if (hasLagos) {
      questionsAsked.push('Delivery cost within Lagos');
    } else {
      questionsAsked.push('Delivery fee and timeframe');
      missingInformation.push('Customer specific delivery location/address');
    }
  }

  // Price question
  if (lower.includes('how much') || lower.includes('what is the price') || lower.includes('price')) {
    questionsAsked.push('Product price confirmation');
  }

  // Size/availability question
  if (lower.includes('size 42') || lower.includes('size 43') || lower.includes('do you have')) {
    questionsAsked.push('Size/stock availability check');
  }

  // Discount / negotiation
  const hasDiscountRequest =
    lower.includes('discount') ||
    lower.includes('reduce') ||
    lower.includes('last price') ||
    lower.includes('less');
  if (hasDiscountRequest) {
    objections.push('Customer requested discount / price negotiation');
  }

  // Delay / hesitation
  const isDelaying =
    lower.includes('think about it') ||
    lower.includes('get back to you') ||
    lower.includes('will wait') ||
    lower.includes('hold on') ||
    lower.includes('later');
  if (isDelaying) {
    objections.push('Customer postponed purchase decision');
  }

  // Purchase intent keywords
  const hasPurchaseIntent =
    lower.includes('i want to pay') ||
    lower.includes('send account') ||
    lower.includes('account number') ||
    lower.includes('send your account') ||
    lower.includes('i want the') ||
    lower.includes('i want size') ||
    lower.includes('package am') ||
    lower.includes('take my order');

  // Determine Intent
  let intent: ConversationIntent = 'general_question';
  if (hasPurchaseIntent) {
    intent = 'purchase_intent';
  } else if (hasDiscountRequest) {
    intent = 'negotiation';
  } else if (asksDeliveryCost) {
    intent = 'delivery_question';
  } else if (lower.includes('how much') || lower.includes('price')) {
    intent = 'price_question';
  } else if (lower.includes('do you have') || lower.includes('available')) {
    intent = 'availability_question';
  }

  // Determine Lead Stage & Interest Level
  let leadStage: LeadStage = 'new_lead';
  let interestLevel: InterestLevel = 'medium';
  let purchaseLikelihood: InterestLevel = 'medium';

  if (hasPurchaseIntent) {
    leadStage = 'ready_to_buy';
    interestLevel = 'high';
    purchaseLikelihood = 'high';
  } else if (isDelaying) {
    leadStage = 'considering';
    interestLevel = 'medium';
    purchaseLikelihood = 'medium';
  } else if (productsMentioned.length > 0 && productsMentioned.some((p) => p.matchedInCatalog)) {
    leadStage = 'interested';
    interestLevel = 'high';
    purchaseLikelihood = 'medium';
  }

  // Follow-up recommendation
  let followUpRecommended = false;
  let followUpReason = '';
  if (isDelaying || leadStage === 'considering') {
    followUpRecommended = true;
    followUpReason = 'Customer showed interest but postponed the purchase decision to think about it.';
  } else if (leadStage === 'interested' && !hasPurchaseIntent) {
    followUpRecommended = true;
    followUpReason = 'Customer inquired about catalog products. Follow up to answer questions and close the sale.';
  }

  // Order Opportunity
  const catalogProductsInvolved = productsMentioned.filter((p) => p.matchedInCatalog && p.productId);
  const orderOpportunity =
    hasPurchaseIntent &&
    catalogProductsInvolved.length > 0 &&
    catalogProductsInvolved.some((p) => (p.currentStock || 0) > 0);

  const orderItems: PotentialOrderItem[] = orderOpportunity
    ? catalogProductsInvolved.map((p) => {
        const prod = activeProducts.find((ap) => ap.id === p.productId)!;
        const qty = p.quantityDiscussed || 1;
        const price = prod.price;
        return {
          productId: prod.id,
          productName: prod.name,
          variantName: p.variantDiscussed || null,
          quantity: qty,
          unitPrice: price,
          totalPrice: price * qty,
        };
      })
    : [];

  // Recommended Action
  let recommendedAction = 'Follow up with customer to assist with their purchase.';
  if (productsMentioned.some((p) => !p.matchedInCatalog)) {
    recommendedAction = 'Inform customer that this unlisted item is not available, and recommend similar store products.';
  } else if (missingInformation.length > 0) {
    recommendedAction = `Confirm ${missingInformation[0].toLowerCase()} and request customer delivery address to complete order.`;
  } else if (orderOpportunity) {
    recommendedAction = 'Send official bank payment details and request transfer proof to finalize order.';
  } else if (followUpRecommended) {
    recommendedAction = 'Schedule a follow-up reminder for tomorrow morning to re-engage the customer.';
  }

  // Suggested Reply
  let suggestedReply = '';
  const customerGreeting = customerName ? `Hi ${customerName} 👋` : 'Hello 👋';

  if (productsMentioned.some((p) => !p.matchedInCatalog)) {
    const unlisted = productsMentioned.find((p) => !p.matchedInCatalog)!;
    suggestedReply = `${customerGreeting} Thank you for your inquiry! That specific item (${unlisted.name}) is currently not available in our catalog. Would you like to see our latest available collection from ${business.name}?`;
  } else if (hasDiscountRequest) {
    const p = productsMentioned[0];
    const priceStr = p ? `₦${p.catalogPrice?.toLocaleString()}` : 'our listed prices';
    suggestedReply = `${customerGreeting} Thank you for asking. Our items are priced at the best possible value for top premium quality (${priceStr}) with zero hidden charges. We would be delighted to package this for you!`;
  } else if (asksDeliveryCost && hasAbuja && !business.deliveryInfo.toLowerCase().includes('abuja')) {
    const p = productsMentioned[0];
    const pInfo = p ? `Yes, ${p.variantDiscussed || p.name} is available in stock. ` : '';
    suggestedReply = `${customerGreeting} ${pInfo}I am confirming the exact delivery fee to Abuja with our dispatch partner right now. Could you please share your delivery address or LGA so I can give you the exact total to complete your order?`;
  } else if (orderOpportunity) {
    const p = orderItems[0];
    suggestedReply = `${customerGreeting} Yes, ${p.productName} (${p.variantName || 'available in stock'}) is ready for you! Here are our official payment details:\n${business.paymentInstructions}\nKindly share your transfer receipt and delivery address so we can dispatch your package immediately! ✨`;
  } else if (isDelaying) {
    const p = productsMentioned[0];
    const itemStr = p ? `the ${p.name}` : 'this';
    suggestedReply = `No problem at all ${customerName || ''}! Take your time to think about ${itemStr}. Just let me know once you're ready so I can reserve your order before stock runs low! 😊`;
  } else if (productsMentioned.length > 0) {
    const p = productsMentioned[0];
    suggestedReply = `${customerGreeting} The ${p.name} is ₦${p.catalogPrice?.toLocaleString()} and we have units available in stock. Would you like me to help you reserve this or arrange delivery?`;
  } else {
    suggestedReply = `${customerGreeting} Thank you for reaching out to ${business.name}! How may we assist you today?`;
  }

  return {
    customerName,
    customerPhone,
    intent,
    leadStage,
    interestLevel,
    productsMentioned,
    questionsAsked,
    objections,
    missingInformation,
    purchaseLikelihood,
    recommendedAction,
    suggestedReply,
    followUpRecommended,
    followUpReason: followUpReason || 'Customer engaged in sales conversation.',
    orderOpportunity,
    orderItems,
    deliveryFeeEstimated: hasLagos ? 2500 : null,
    deliveryFeeConfirmed: false,
    confidence: orderOpportunity ? 94 : 88,
  };
}

export async function generateFollowUpMessage(params: {
  customer: Customer;
  business: Business;
  reason: string;
  tone: ResponseTone;
}): Promise<string> {
  const { customer, business, reason, tone } = params;

  const prompt = `You are a sales assistant for "${business.name}".
Write a friendly, polite, high-converting follow-up message to send to customer "${customer.name}" on WhatsApp.
Context & Reason: "${reason}".
Customer location: ${customer.location || 'Nigeria'}.
Tone: ${tone}.
Keep it warm, under 50 words, mentioning the reason naturally without being pushy. Add an easy call-to-action.`;

  const text = await generateWithModelFallback({
    contents: prompt,
  });
  if (text) return text;

  // Fallback
  if (tone === 'pidgin' || tone === 'nigerian_pidgin') {
    return `Hi ${customer.name} 👋 How far? Just checking in on you from ${business.name} regarding your inquiry (${reason}). You still dey interested make we package am for you? 😊`;
  }
  return `Hi ${customer.name} 👋 Hope your day is going well! Just checking in from ${business.name} regarding your recent inquiry (${reason}). Please let me know if you would like us to reserve this or help finalize your order! 😊`;
}
