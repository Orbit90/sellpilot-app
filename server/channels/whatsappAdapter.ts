import crypto from 'crypto';
import {
  NormalizedIncomingMessage,
  OutboundMessagePayload,
  SendMessageResult,
  WhatsAppVerificationParams,
  WhatsAppVerificationResult,
  ParsedWebhookResult,
  MetaPhoneVerificationResult,
} from './types';
import { decryptChannelToken } from '../services/channelEncryption';

export class WhatsAppAdapter {
  private apiVersion: string;
  private appSecret: string;
  private defaultVerifyToken: string;
  private fetchFn: typeof fetch;

  constructor(options?: {
    apiVersion?: string;
    appSecret?: string;
    verifyToken?: string;
    fetchFn?: typeof fetch;
  }) {
    this.apiVersion = options?.apiVersion || process.env.WHATSAPP_API_VERSION || 'v21.0';
    this.appSecret = options?.appSecret || process.env.WHATSAPP_APP_SECRET || 'sellpilot_meta_test_app_secret_998877';
    this.defaultVerifyToken = options?.verifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'sellpilot_whatsapp_verify_token_secure_xyz';
    this.fetchFn = options?.fetchFn || globalThis.fetch;
  }

  /**
   * Official Meta Webhook Challenge Verification (GET /api/channels/whatsapp/webhook)
   * Meta verifies your endpoint by sending:
   * hub.mode=subscribe, hub.verify_token=YOUR_TOKEN, hub.challenge=CHALLENGE_STRING
   */
  verifyWebhook(
    params: WhatsAppVerificationParams,
    customVerifyToken?: string
  ): WhatsAppVerificationResult {
    const { mode, token, challenge } = params;

    if (!mode || !token) {
      return { verified: false, error: 'Missing mode or token in webhook verification' };
    }

    if (mode !== 'subscribe') {
      return { verified: false, error: `Unsupported mode: ${mode}` };
    }

    const expectedToken = customVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || this.defaultVerifyToken || 'sellpilot_whatsapp_verify_token_secure_xyz';
    if (!expectedToken) {
      return { verified: false, error: 'No verify token configured on server' };
    }

    // Constant-time comparison to prevent timing attacks
    const tokenBuf = Buffer.from(token, 'utf-8');
    const expectedBuf = Buffer.from(expectedToken, 'utf-8');

    if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      return { verified: false, error: 'Verification token mismatch' };
    }

    return {
      verified: true,
      challenge: challenge || '',
    };
  }

  /**
   * Official Meta Signature Validation (POST /api/channels/whatsapp/webhook)
   * Header: x-hub-signature-256 = sha256=<hmac_sha256_hash>
   * Computed using the Meta App Secret over the raw payload buffer.
   */
  validateWebhookSignature(rawBody: Buffer | string | undefined, signatureHeader?: string): boolean {
    if (!rawBody || !signatureHeader) {
      return false;
    }

    const appSecret = process.env.WHATSAPP_APP_SECRET || this.appSecret || 'sellpilot_meta_test_app_secret_998877';
    if (!appSecret) {
      // In production, app secret must be set. In test/dev, if explicitly disabled, can warn.
      console.warn('WHATSAPP_APP_SECRET is not configured; cannot validate webhook signature');
      return false;
    }

    if (!signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const providedSignature = signatureHeader.substring(7).trim();
    const payloadBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8');

    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(payloadBuffer)
      .digest('hex');

    const providedBuf = Buffer.from(providedSignature, 'utf-8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');

    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  }

  /**
   * Parses official Meta WhatsApp Cloud API event payload
   */
  parseWebhookPayload(body: any): ParsedWebhookResult {
    const result: ParsedWebhookResult = {
      incomingMessages: [],
      statusUpdates: [],
    };

    if (!body || typeof body !== 'object' || body.object !== 'whatsapp_business_account') {
      return result;
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const wabaId = String(entry.id || '');
      const changes = Array.isArray(entry.changes) ? entry.changes : [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const val = change.value;
        if (!val || typeof val !== 'object') continue;

        const phoneNumberId = String(val.metadata?.phone_number_id || '');
        const displayPhoneNumber = val.metadata?.display_phone_number;

        // 1. Process incoming messages
        const messages = Array.isArray(val.messages) ? val.messages : [];
        const contacts = Array.isArray(val.contacts) ? val.contacts : [];

        for (const msg of messages) {
          const contact = contacts.find((c: any) => c.wa_id === msg.from);
          result.incomingMessages.push({
            rawMessage: msg,
            contact,
            phoneNumberId,
            wabaId,
            displayPhoneNumber,
          });
        }

        // 2. Process message status updates (sent, delivered, read, failed)
        const statuses = Array.isArray(val.statuses) ? val.statuses : [];
        for (const st of statuses) {
          result.statusUpdates.push({
            messageId: String(st.id || ''),
            status: String(st.status || ''),
            recipientId: String(st.recipient_id || ''),
            timestamp: String(st.timestamp || ''),
            phoneNumberId,
          });
        }
      }
    }

    return result;
  }

  /**
   * Normalizes a Meta message into SellPilot's canonical NormalizedIncomingMessage
   */
  normalizeMessage(params: {
    rawMessage: any;
    contact?: { wa_id: string; profile?: { name?: string } };
    phoneNumberId: string;
    businessId: string;
    channelConnectionId: string;
  }): NormalizedIncomingMessage | null {
    const { rawMessage, contact, phoneNumberId, businessId, channelConnectionId } = params;

    if (!rawMessage || !rawMessage.id || !rawMessage.from) {
      return null;
    }

    const fromRaw = String(rawMessage.from).trim();
    // Normalize to E.164 (+234...)
    const customerIdentifier = fromRaw.startsWith('+') ? fromRaw : `+${fromRaw}`;
    const customerName = contact?.profile?.name || rawMessage.profile?.name || customerIdentifier;

    let messageText = '';
    const msgType = rawMessage.type;

    if (msgType === 'text' && rawMessage.text?.body) {
      messageText = String(rawMessage.text.body).trim();
    } else if (msgType === 'interactive' && rawMessage.interactive) {
      const interactive = rawMessage.interactive;
      if (interactive.type === 'button_reply') {
        messageText = interactive.button_reply?.title || interactive.button_reply?.id || '';
      } else if (interactive.type === 'list_reply') {
        messageText = interactive.list_reply?.title || interactive.list_reply?.id || '';
      }
    } else if (msgType === 'button' && rawMessage.button?.text) {
      messageText = String(rawMessage.button.text).trim();
    } else if (rawMessage.caption) {
      messageText = String(rawMessage.caption).trim();
    } else {
      // Unhandled media or sticker
      messageText = `[Customer sent ${msgType || 'media'} message]`;
    }

    const timestampSec = Number(rawMessage.timestamp) || Math.floor(Date.now() / 1000);
    const timestamp = new Date(timestampSec * 1000).toISOString();

    return {
      businessId,
      channelType: 'whatsapp',
      channelConnectionId,
      externalConversationId: `wa_${fromRaw}`,
      externalMessageId: String(rawMessage.id),
      customerIdentifier,
      customerName,
      direction: 'inbound',
      messageText,
      timestamp,
      metadata: {
        rawType: msgType,
        phoneNumberId,
        waId: contact?.wa_id || fromRaw,
      },
    };
  }

  /**
   * Outbound message dispatch via official Meta WhatsApp Cloud API
   * POST https://graph.facebook.com/{version}/{phone_number_id}/messages
   */
  async sendMessage(params: {
    phoneNumberId: string;
    accessToken: string;
    to: string;
    text: string;
    replyToMessageId?: string;
  }): Promise<SendMessageResult> {
    const { phoneNumberId, accessToken, to, text, replyToMessageId } = params;

    if (!phoneNumberId || !accessToken || !to || !text) {
      return { success: false, error: 'Missing required parameters for sending WhatsApp message' };
    }

    // Clean recipient phone: strip '+' and whitespace for Meta recipient_type: individual
    const cleanTo = to.replace(/\D/g, '');

    const endpoint = `https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}/messages`;

    const bodyPayload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    };

    if (replyToMessageId) {
      bodyPayload.context = {
        message_id: replyToMessageId,
      };
    }

    try {
      const response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'SellPilot-ChannelAdapter/1.0',
        },
        body: JSON.stringify(bodyPayload),
      });

      const data: any = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error?.message || `WhatsApp API error: HTTP ${response.status}`;
        console.error('WhatsApp Cloud API send failed:', data?.error || data);
        return {
          success: false,
          error: errorMsg,
          status: 'failed',
        };
      }

      const externalMessageId = data?.messages?.[0]?.id;
      return {
        success: true,
        externalMessageId,
        status: 'sent',
      };
    } catch (err: any) {
      console.error('Network failure connecting to WhatsApp Cloud API:', err);
      return {
        success: false,
        error: err?.message || 'Network failure communicating with Meta WhatsApp API',
        status: 'failed',
      };
    }
  }

  /**
   * Verifies Meta WhatsApp Business Phone Number credentials during onboarding
   * GET https://graph.facebook.com/{version}/{phone_number_id}?fields=display_phone_number,verified_name,quality_rating,code_verification_status
   */
  async verifyMetaCredentials(
    phoneNumberId: string,
    accessToken: string
  ): Promise<MetaPhoneVerificationResult> {
    if (!phoneNumberId || !accessToken) {
      return { verified: false, error: 'Phone Number ID and Access Token are required' };
    }

    const endpoint = `https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`;

    try {
      const response = await this.fetchFn(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'SellPilot-ChannelAdapter/1.0',
        },
      });

      const data: any = await response.json();

      if (!response.ok) {
        const msg = data?.error?.message || `Meta validation failed: HTTP ${response.status}`;
        return { verified: false, error: msg };
      }

      return {
        verified: true,
        displayPhoneNumber: data.display_phone_number || '',
        verifiedName: data.verified_name || '',
        qualityRating: data.quality_rating || 'GREEN',
        codeVerificationStatus: data.code_verification_status || 'VERIFIED',
      };
    } catch (err: any) {
      return {
        verified: false,
        error: err?.message || 'Failed to reach Meta Graph API to verify credentials',
      };
    }
  }
}

export const defaultWhatsAppAdapter = new WhatsAppAdapter();
