/**
 * Formatting utilities for SellPilot
 */

export function formatNaira(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₦0';
  }
  const formattedNumber = new Intl.NumberFormat('en-NG', {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amount)));
  return `₦${formattedNumber}`;
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'Just now';
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hrs ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    return `${diffInDays} days ago`;
  } catch {
    return dateString;
  }
}

export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // Nigerian 11-digit local mobile starting with 0: e.g. 08031234567 -> 2348031234567
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '234' + digits.substring(1);
  } else if (digits.length === 10 && /^[789]/.test(digits)) {
    // 10 digits without leading 0: e.g. 8031234567 -> 2348031234567
    digits = '234' + digits;
  }
  return digits;
}
