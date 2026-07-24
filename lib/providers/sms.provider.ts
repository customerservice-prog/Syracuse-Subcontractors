// Provider interface so the SMS delivery mechanism can be swapped (e.g. Twilio)
// without changing calling code. The mock implementation logs instead of sending
// a real message and is used until real credentials are configured locally.

export interface SmsProvider {
  sendSms(input: { to: string; body: string }): Promise<{
    success: boolean;
    providerMessageId?: string;
    error?: string;
  }>;
}

class MockSmsProvider implements SmsProvider {
  async sendSms(input: { to: string; body: string }) {
    console.log(`[mock-sms] to=${input.to} body=${input.body}`);
    return { success: true, providerMessageId: `mock-sms-${Date.now()}` };
  }
}

export const smsProvider: SmsProvider = new MockSmsProvider();
