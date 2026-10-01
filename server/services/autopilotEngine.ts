import { db } from '../db';
import { NormalizedIncomingMessage } from '../channels/types';
import { WhatsAppAdapter, defaultWhatsAppAdapter } from '../channels/whatsappAdapter';
import { decryptChannelToken } from './channelEncryption';
import { analyzeConversation, generateAIReply } from '../gemini';
import { recordMetricUsage } from './subscriptionService';
import { AutopilotSettings, ChannelConnection, Customer, ResponseTone, CustomerInteraction } from '../../src/types';

export interface AutopilotDecision {
  action: 'send_auto_reply' | 'handoff_to_human' | 'ignore' | 'draft_only';
  reason: string;
  replyText?: string;
  handoffReason?: 'negotiation' | 'complaint' | 'uncertain_ai' | 'merchant_takeover' | 'out_of_scope';
  analysis?: any;
}

export const DEFAULT_AUTOPILOT_SETTINGS: AutopilotSettings = {
  mode: 'autopilot',
  autoReplyProductQuestions: true,
  autoReplyAvailability: true,
  autoReplyDelivery: true,
  autoReplyPurchaseIntent: true,
  allowAutoNegotiation: false, // default false: always hand off to human
  autoHandoffComplaints: true, // default true
  autoHandoffUncertain: true, // default true
  maxConsecutiveAutoReplies: 5,
  debounceSeconds: 3,
};

export class AutopilotEngine {
  private adapter: WhatsAppAdapter;

  constructor(adapter?: WhatsAppAdapter) {
    this.adapter = adapter || defaultWhatsAppAdapter;
  }

  /**
   * Main entry point for incoming normalized messages
   */
  async processIncomingMessage(
    message: NormalizedIncomingMessage,
    connection: ChannelConnection
  ): Promise<AutopilotDecision> {
    const { businessId, customerIdentifier, customerName, messageText, externalConversationId, externalMessageId } = message;

    // 1. Loop & Message Integrity Checks
    if (message.direction !== 'inbound') {
      return { action: 'ignore', reason: 'Non-inbound message ignored' };
    }

    if (!messageText || messageText.trim() === '') {
      return { action: 'ignore', reason: 'Empty message text' };
    }

    // 2. Prevent self-reply loop: If message comes from store's own WhatsApp number, ignore
    const storePhone = connection.displayName || connection.externalPhoneNumberId;
    if (storePhone && customerIdentifier.replace(/\D/g, '') === storePhone.replace(/\D/g, '')) {
      return { action: 'ignore', reason: 'Self-reply loop prevention: sender matches store phone number' };
    }

    // 3. Persist inbound message to channel_messages
    await db.channelMessages.create({
      businessId,
      channelConnectionId: connection.id,
      channelType: 'whatsapp',
      externalConversationId,
      externalMessageId,
      customerIdentifier,
      direction: 'inbound',
      messageText,
      status: 'delivered',
      metadata: message.metadata || {},
    });

    // 4. Find or Create Customer in CRM
    const customer = await this.findOrCreateCustomer(businessId, customerIdentifier, customerName);

    // 5. Active Human Handoff Check
    const activeHandoff = await db.handoffs.findActiveByCustomer(businessId, customerIdentifier);
    if (activeHandoff) {
      // Customer is currently being handled by a human merchant
      await db.handoffs.updateStatus(activeHandoff.id, businessId, activeHandoff.status, `New message: ${messageText.substring(0, 80)}`);
      return {
        action: 'handoff_to_human',
        reason: 'Active human handoff already in progress for this customer',
        handoffReason: activeHandoff.reason,
      };
    }

    // 6. Automation Rules Configuration
    const settings: AutopilotSettings = {
      ...DEFAULT_AUTOPILOT_SETTINGS,
      ...(connection.metadata?.autopilotSettings || {}),
    };

    // If merchant configured Copilot Mode (manual approval only)
    if (settings.mode === 'copilot') {
      return {
        action: 'draft_only',
        reason: 'Copilot Mode active: Merchant reviews and sends messages manually',
      };
    }

    // 7. Throttling & Debounce Loop Protection
    // Check recent auto-replies to this customer in the last 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recentAutoReplyCount = await db.channelMessages.countRecentAutoReplies(
      businessId,
      customerIdentifier,
      fifteenMinsAgo
    );

    if (recentAutoReplyCount >= settings.maxConsecutiveAutoReplies) {
      // Trigger human handoff to prevent endless AI banter
      await db.handoffs.create({
        businessId,
        channelType: 'whatsapp',
        customerIdentifier,
        customerName: customer?.name || customerIdentifier,
        status: 'pending_human',
        reason: 'out_of_scope',
        notes: `Maximum consecutive automated replies (${settings.maxConsecutiveAutoReplies}) reached. Human merchant review required.`,
        lastMessageText: messageText,
      });

      return {
        action: 'handoff_to_human',
        reason: 'Maximum consecutive automated replies reached',
        handoffReason: 'out_of_scope',
      };
    }

    // 8. Load Business & Active Products Context
    const business = await db.businesses.findById(businessId);
    if (!business) {
      return { action: 'ignore', reason: 'Business tenant record not found' };
    }

    const products = await db.products.findAllByBusinessId(businessId);
    const customers = await db.customers.findAllByBusinessId(businessId);

    // Load recent conversation history (last 10 messages)
    const recentMessages = await db.channelMessages.listByCustomer(businessId, customerIdentifier, 10);
    const conversationHistoryText = recentMessages
      .map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Store'}: ${m.messageText}`)
      .join('\n');

    const conversationTextToAnalyze = conversationHistoryText
      ? `${conversationHistoryText}\nCustomer: ${messageText}`
      : `Customer: ${messageText}`;

    // 8.5 Fast-Path Safety Checks: Immediately catch customer complaints and negotiation bargaining
    const lowerMessage = messageText.toLowerCase();

    // Condition A: Complaint / Customer Dissatisfaction
    const isObviousComplaint = /\b(refund|scam|thief|angry|terrible|bad quality|fake|police|report|fraud|sue)\b/i.test(lowerMessage);
    if (isObviousComplaint && settings.autoHandoffComplaints) {
      await db.handoffs.create({
        businessId,
        channelType: 'whatsapp',
        customerIdentifier,
        customerName: customer?.name || customerIdentifier,
        status: 'pending_human',
        reason: 'complaint',
        notes: 'Customer expressed complaint or grievance requiring personal merchant care.',
        lastMessageText: messageText,
      });

      if (customer) {
        await db.customers.update(customer.id, businessId, { status: 'Follow-up Needed' });
      }

      return {
        action: 'handoff_to_human',
        reason: 'Customer complaint detected; handed off to human merchant',
        handoffReason: 'complaint',
      };
    }

    // Condition B: Negotiation / Bargaining
    const isObviousNegotiation = /\b(discount|last price|slash|reduce|cheaper|too expensive|less|best price|give me discount)\b/i.test(lowerMessage);
    if (isObviousNegotiation && !settings.allowAutoNegotiation) {
      await db.handoffs.create({
        businessId,
        channelType: 'whatsapp',
        customerIdentifier,
        customerName: customer?.name || customerIdentifier,
        status: 'pending_human',
        reason: 'negotiation',
        notes: 'Customer inquired about custom discounts/price negotiation.',
        lastMessageText: messageText,
      });

      return {
        action: 'handoff_to_human',
        reason: 'Price negotiation detected; handed off to human merchant per safety rules',
        handoffReason: 'negotiation',
      };
    }

    // 9. Run Existing SellPilot AI Sales Analyzer
    const businessSettings = await db.settings.findByBusinessId(businessId);
    const tone: ResponseTone = businessSettings?.defaultTone || 'friendly';

    const analysis = await analyzeConversation({
      conversationText: conversationTextToAnalyze,
      business,
      products,
      customers,
      tone,
    });

    // 10. Safety Decision Layer (Semantic LLM analysis checks)
    const isComplaint = analysis.intent === 'complaint' || isObviousComplaint;
    if (isComplaint && settings.autoHandoffComplaints) {
      await db.handoffs.create({
        businessId,
        channelType: 'whatsapp',
        customerIdentifier,
        customerName: customer?.name || customerIdentifier,
        status: 'pending_human',
        reason: 'complaint',
        notes: 'Customer expressed complaint or grievance requiring personal merchant care.',
        lastMessageText: messageText,
      });

      if (customer) {
        await db.customers.update(customer.id, businessId, { status: 'Follow-up Needed' });
      }

      return {
        action: 'handoff_to_human',
        reason: 'Customer complaint detected; handed off to human merchant',
        handoffReason: 'complaint',
        analysis,
      };
    }

    const isNegotiation = analysis.intent === 'negotiation' || isObviousNegotiation;
    if (isNegotiation && !settings.allowAutoNegotiation) {
      await db.handoffs.create({
        businessId,
        channelType: 'whatsapp',
        customerIdentifier,
        customerName: customer?.name || customerIdentifier,
        status: 'pending_human',
        reason: 'negotiation',
        notes: 'Customer inquired about custom discounts/price negotiation.',
        lastMessageText: messageText,
      });

      return {
        action: 'handoff_to_human',
        reason: 'Price negotiation detected; handed off to human merchant per safety rules',
        handoffReason: 'negotiation',
        analysis,
      };
    }

    // Condition C: Uncertain AI / Low Confidence / Inquired item not found
    const hasUnlistedProduct = analysis.productsMentioned.some((p) => !p.matchedInCatalog);
    const isUncertain = (analysis.confidence < 0.65 || hasUnlistedProduct) && settings.autoHandoffUncertain;

    if (isUncertain) {
      await db.handoffs.create({
        businessId,
        channelType: 'whatsapp',
        customerIdentifier,
        customerName: customer?.name || customerIdentifier,
        status: 'pending_human',
        reason: 'uncertain_ai',
        notes: hasUnlistedProduct
          ? 'Customer requested an item not listed in store catalog.'
          : `Low AI confidence score (${Math.round(analysis.confidence * 100)}%).`,
        lastMessageText: messageText,
      });

      return {
        action: 'handoff_to_human',
        reason: 'AI confidence insufficient or requested product unlisted; handed off to human',
        handoffReason: 'uncertain_ai',
        analysis,
      };
    }

    // Condition D: Feature-Specific Toggles
    if (
      (analysis.intent === 'product_question' || analysis.intent === 'price_question') &&
      !settings.autoReplyProductQuestions
    ) {
      return { action: 'draft_only', reason: 'Product inquiry auto-reply disabled by merchant', analysis };
    }
    if (analysis.intent === 'availability_question' && !settings.autoReplyAvailability) {
      return { action: 'draft_only', reason: 'Availability auto-reply disabled by merchant', analysis };
    }
    if (analysis.intent === 'delivery_question' && !settings.autoReplyDelivery) {
      return { action: 'draft_only', reason: 'Delivery auto-reply disabled by merchant', analysis };
    }

    // 11. Format Grounded Automated Reply
    let replyText = analysis.suggestedReply?.trim();
    if (!replyText) {
      const generated = await generateAIReply({
        customerMessage: messageText,
        tone,
        business,
        products,
        customer,
      });
      replyText = generated.reply;
    }

    if (!replyText) {
      return { action: 'handoff_to_human', reason: 'No grounded reply generated', handoffReason: 'uncertain_ai' };
    }

    // 12. Send Automated Response via Meta WhatsApp Cloud API
    const accessToken = this.resolveDecryptedToken(connection);
    if (!accessToken || !connection.externalPhoneNumberId) {
      return {
        action: 'draft_only',
        reason: 'WhatsApp connection credentials incomplete; reply drafted for manual sending',
        replyText,
        analysis,
      };
    }

    const sendResult = await this.adapter.sendMessage({
      phoneNumberId: connection.externalPhoneNumberId,
      accessToken,
      to: customerIdentifier,
      text: replyText,
      replyToMessageId: externalMessageId,
    });

    if (sendResult.success) {
      // Record outbound message in channel_messages
      await db.channelMessages.create({
        businessId,
        channelConnectionId: connection.id,
        channelType: 'whatsapp',
        externalConversationId,
        externalMessageId: sendResult.externalMessageId || `out_${Date.now()}`,
        customerIdentifier,
        direction: 'outbound',
        messageText: replyText,
        status: 'sent',
        metadata: {
          automated: true,
          intent: analysis.intent,
          confidence: analysis.confidence,
        },
      });

      // Record metric usage
      await recordMetricUsage(businessId, 'ai_analysis');

      // Update customer CRM interaction
      if (customer) {
        const newInteraction: CustomerInteraction = {
          id: `int_${Date.now()}`,
          type: 'inquiry',
          summary: `WhatsApp Autopilot Reply: ${analysis.intent}`,
          channel: 'WhatsApp',
          timestamp: new Date().toISOString(),
        };

        await db.customers.update(customer.id, businessId, {
          ordersCount: customer.ordersCount,
          status: analysis.leadStage === 'ready_to_buy' ? 'Interested' : customer.status,
          interactions: [...(customer.interactions || []), newInteraction],
        });
      }

      // Record conversation analysis in database
      await db.conversations.create({
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        businessId,
        customerName: customer?.name || customerIdentifier,
        customerPhone: customerIdentifier,
        leadStage: analysis.leadStage,
        detectedIntent: analysis.intent,
        interestLevel: analysis.interestLevel,
        confidence: analysis.confidence,
        rawConversation: conversationTextToAnalyze,
        productsDetected: analysis.productsMentioned,
        questionsAsked: analysis.questionsAsked || [],
        objections: analysis.objections || [],
        missingInformation: analysis.missingInformation || [],
        purchaseLikelihood: analysis.purchaseLikelihood || analysis.interestLevel,
        recommendedAction: analysis.recommendedAction || '',
        suggestedReply: replyText,
        followUpRecommended: analysis.followUpRecommended,
        followUpReason: analysis.followUpReason,
        orderOpportunity: analysis.orderOpportunity,
        orderItems: analysis.orderItems,
        deliveryFeeEstimated: analysis.deliveryFeeEstimated,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return {
        action: 'send_auto_reply',
        reason: 'Automated grounded reply sent successfully via Meta WhatsApp Cloud API',
        replyText,
        analysis,
      };
    } else {
      console.warn('Failed to send outbound WhatsApp reply:', sendResult.error);
      return {
        action: 'draft_only',
        reason: `WhatsApp Cloud API send failed: ${sendResult.error}`,
        replyText,
        analysis,
      };
    }
  }

  private resolveDecryptedToken(connection: ChannelConnection): string | null {
    if (!connection.encryptedAccessToken || !connection.accessTokenIv || !connection.accessTokenTag) {
      return null;
    }
    try {
      return decryptChannelToken(
        connection.encryptedAccessToken,
        connection.accessTokenIv,
        connection.accessTokenTag
      );
    } catch (err) {
      console.error('Failed to decrypt WhatsApp access token for business:', connection.businessId, err);
      return null;
    }
  }

  private async findOrCreateCustomer(
    businessId: string,
    phone: string,
    name?: string
  ): Promise<Customer | null> {
    try {
      const customers = await db.customers.findAllByBusinessId(businessId);
      const cleanPhone = phone.replace(/\D/g, '');
      const existing = customers.find((c: Customer) => c.phone.replace(/\D/g, '') === cleanPhone);

      if (existing) {
        if (name && existing.name === existing.phone && name !== existing.phone) {
          await db.customers.update(existing.id, businessId, { name });
          existing.name = name;
        }
        return existing;
      }

      const initialInteraction: CustomerInteraction = {
        id: `int_${Date.now()}`,
        type: 'inquiry',
        summary: 'Inbound message from WhatsApp Cloud API',
        channel: 'WhatsApp',
        timestamp: new Date().toISOString(),
      };

      // Create new customer record in CRM
      return await db.customers.create({
        id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        businessId,
        name: name || phone,
        phone,
        location: '',
        ordersCount: 0,
        totalSpent: 0,
        status: 'New',
        notes: 'Discovered via WhatsApp Cloud API',
        interactions: [initialInteraction],
        dateAdded: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Error during customer lookup/creation:', err);
      return null;
    }
  }
}

export const autopilotEngine = new AutopilotEngine();
