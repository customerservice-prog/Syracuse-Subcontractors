// Provider interface so the email delivery mechanism can be swapped later
// without changing calling code. The mock implementation logs instead of
// sending a real email and is used until real credentials are configured.

export interface EmailProvider {
  sendEmail(input: { to: string; subject: string; body: string }): Promise<{
    success: boolean;
    providerMessageId?: string;
    error?: string;
  }>;
}

class MockEmailProvider implements EmailProvider {
  async sendEmail(input: { to: string; subject: string; body: string }) {
    console.log(`[mock-email] to=${input.to} subject=${input.subject}`);
    return { success: true, providerMessageId: `mock-email-${Date.now()}` };
  }
}

export const emailProvider: EmailProvider = new MockEmailProvider();
