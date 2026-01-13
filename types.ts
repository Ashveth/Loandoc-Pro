
export interface ClauseAnalysis {
  name: string;
  summary: string;
  confidenceScore: number;
  reviewRequired: boolean;
  reason: string;
  lmaComparison?: {
    standardBenchmark: string;
    deviations: string;
    rationale?: string;
    impact: string;
  };
}

export interface DocumentOverview {
  facilityType: string;
  borrowerLender: string;
  currency: string;
  amount: string;
  maturity: string;
  law: string;
}

export interface RiskAssessment {
  overallRating: 'Low' | 'Medium' | 'High';
  summary: string;
}

export interface CommercialSummary {
  snapshot: string;
  highlights: string[];
  risks: string[];
  nextActions: string[];
}

export interface DealReadiness {
  score: number;
  status: string;
  driversPositive: string[];
  driversNegative: string[];
  keyIssues: string[];
  recommendedActions: string[];
}

export interface AnalysisResult {
  overview: DocumentOverview;
  confidenceAnalysis: ClauseAnalysis[];
  riskAssessment: RiskAssessment;
  commercialSummary: CommercialSummary;
  dealReadiness: DealReadiness;
  rawText?: string;
}

export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  UNKNOWN = 'Unknown'
}
