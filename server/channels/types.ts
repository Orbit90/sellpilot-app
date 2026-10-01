import { ChannelMessage, ChannelType } from '../../src/types';

export interface NormalizedIncomingMessage {
  businessId: string;
  channelType: ChannelType;
  channelConnectionId: string;
  externalConversationId: string;
  externalMessageId: string;
  customerIdentifier: string; // Formatted E.164 phone number e.g. +2348031234567
  customerName?: string;
  direction: 'inbound';
  messageText: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface OutboundMessagePayload {
  businessId: string;
  channelConnectionId: string;
  to: string; // customer phone
  text: string;
  replyToMessageId?: string;
  metadata?: Record<string, any>;
}

export interface SendMessageResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
  status?: string;
}

export interface WhatsAppVerificationParams {
  mode?: string;
  token?: string;
  challenge?: string;
}

export interface WhatsAppVerificationResult {
  verified: boolean;
  challenge?: string;
  error?: string;
}

export interface ParsedWebhookResult {
  incomingMessages: Array<{
    rawMessage: any;
    contact?: { wa_id: string; profile?: { name?: string } };
    phoneNumberId: string;
    wabaId: string;
    displayPhoneNumber?: string;
  }>;
  statusUpdates: Array<{
    messageId: string;
    status: string;
    recipientId: string;
    timestamp: string;
    phoneNumberId?: string;
  }>;
}

export interface MetaPhoneVerificationResult {
  verified: boolean;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  codeVerificationStatus?: string;
  error?: string;
}
