// Provider interface so AI-assisted features (resume parsing, match scoring
// explanations) can be swapped between vendors later without changing calling
// code. The mock implementation returns deterministic placeholder output.

export interface AiProvider {
  parseResume(resumeText: string): Promise<{
    skills: string[];
    yearsExperience: number | null;
  }>;
  scoreMatchExplanation(input: { workerSummary: string; positionSummary: string }): Promise<string>;
}

class MockAiProvider implements AiProvider {
  async parseResume(resumeText: string) {
    console.log(`[mock-ai] parseResume length=${resumeText.length}`);
    return { skills: [], yearsExperience: null };
  }

async scoreMatchExplanation(input: { workerSummary: string; positionSummary: string }) {
  return `Mock explanation: worker (${input.workerSummary}) evaluated against position (${input.positionSummary}).`;
}
}

export const aiProvider: AiProvider = new MockAiProvider();
