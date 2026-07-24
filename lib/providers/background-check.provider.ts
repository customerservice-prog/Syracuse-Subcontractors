// Provider interface so a real background-check vendor can be plugged in
// later without changing calling code. No real background-check credentials
// or requests are used in Phase 1 - this mock only simulates a pending state.

export interface BackgroundCheckProvider {
  initiateCheck(input: { workerProfileId: string }): Promise<{
    success: boolean;
    providerReference?: string;
    status: string;
  }>;
  getCheckStatus(providerReference: string): Promise<{ status: string }>;
}

class MockBackgroundCheckProvider implements BackgroundCheckProvider {
  async initiateCheck(input: { workerProfileId: string }) {
    console.log(`[mock-background-check] initiate for worker=${input.workerProfileId}`);
    return { success: true, providerReference: `mock-bgc-${Date.now()}`, status: "pending" };
  }

async getCheckStatus(providerReference: string) {
  console.log(`[mock-background-check] status check ${providerReference}`);
  return { status: "pending" };
}
}

export const backgroundCheckProvider: BackgroundCheckProvider = new MockBackgroundCheckProvider();
