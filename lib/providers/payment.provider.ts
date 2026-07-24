// Provider interface so the payment mechanism can be swapped (e.g. Stripe)
// without changing calling code. No real payments are processed in Phase 1 -
// this mock implementation only records a placeholder reference.

export interface PaymentProvider {
  createPaymentIntent(input: { invoiceId: string; amount: number }): Promise<{
    success: boolean;
    providerReference?: string;
    error?: string;
  }>;
}

class MockPaymentProvider implements PaymentProvider {
  async createPaymentIntent(input: { invoiceId: string; amount: number }) {
    console.log(`[mock-payment] invoice=${input.invoiceId} amount=${input.amount}`);
    return { success: true, providerReference: `mock-pi-${Date.now()}` };
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
