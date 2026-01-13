
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const SYSTEM_PROMPT = `You are a professional loan documentation analysis and lifecycle intelligence assistant for banks and financial institutions.
Analyze the provided commercial loan agreement following these specific steps:

PHASE 1: Clause Audit
1. Clause Extraction: Facility Amount, Interest Rate & Margin, Repayment, Prepayment, Financial Covenants, Events of Default, Governing Law, Amendment & Waiver.
2. Confidence Scoring: 0–100% based on clarity and standardisation.
3. Market Benchmarking: Classify as Standard, Slightly Aggressive, or Aggressive/Non-Standard relative to LMA-style norms.
4. Review Flags: Flag if confidence < 75% or Aggressive.

PHASE 2: Deal Readiness Intelligence
1. Evaluate across: Completeness, Legal/Interpretation Risk, Market Alignment, and Operational Complexity.
2. Calculate Deal Readiness Score (0-100):
   - 85–100: Execution Ready
   - 70–84: Ready with Review
   - < 70: Not Execution Ready
3. Identify Positive/Negative Score Drivers and Key Issues.
4. Recommend Next Actions for lifecycle management (execution, amendment, or trading).

IMPORTANT: Decision-support only, not legal advice. Use conservative, risk-aware judgment. Banker-friendly language.`;

export const analyzeLoanDocument = async (text: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: text,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: {
              type: Type.OBJECT,
              properties: {
                facilityType: { type: Type.STRING },
                borrowerLender: { type: Type.STRING },
                currency: { type: Type.STRING },
                amount: { type: Type.STRING },
                maturity: { type: Type.STRING },
                law: { type: Type.STRING },
              },
              required: ["facilityType", "borrowerLender", "currency", "amount", "maturity", "law"]
            },
            clauses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  clause_name: { type: Type.STRING },
                  extracted_text: { type: Type.STRING },
                  confidence_score: { type: Type.INTEGER },
                  market_deviation: { type: Type.STRING },
                  review_required: { type: Type.BOOLEAN },
                  explanation: { type: Type.STRING },
                  lma_benchmark_context: { type: Type.STRING },
                  potential_impact: { type: Type.STRING }
                },
                required: ["clause_name", "extracted_text", "confidence_score", "market_deviation", "review_required", "explanation"]
              }
            },
            dealReadiness: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                status: { type: Type.STRING },
                driversPositive: { type: Type.ARRAY, items: { type: Type.STRING } },
                driversNegative: { type: Type.ARRAY, items: { type: Type.STRING } },
                keyIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["score", "status", "driversPositive", "driversNegative", "keyIssues", "recommendedActions"]
            },
            riskAssessment: {
              type: Type.OBJECT,
              properties: {
                overallRating: { type: Type.STRING },
                summary: { type: Type.STRING }
              },
              required: ["overallRating", "summary"]
            },
            commercialSummary: {
              type: Type.OBJECT,
              properties: {
                snapshot: { type: Type.STRING },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                nextActions: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["snapshot", "highlights", "risks", "nextActions"]
            }
          },
          required: ["overview", "clauses", "dealReadiness", "riskAssessment", "commercialSummary"]
        }
      },
    });

    const data = JSON.parse(response.text || '{}');
    
    return {
      overview: data.overview,
      confidenceAnalysis: data.clauses.map((c: any) => ({
        name: c.clause_name,
        summary: c.extracted_text,
        confidenceScore: c.confidence_score,
        reviewRequired: c.review_required,
        reason: c.explanation,
        lmaComparison: {
          standardBenchmark: c.lma_benchmark_context || "Market standard position.",
          deviations: c.market_deviation,
          impact: c.potential_impact || "Review required for specific commercial impact."
        }
      })),
      riskAssessment: {
        overallRating: (data.riskAssessment.overallRating || 'Medium') as any,
        summary: data.riskAssessment.summary
      },
      commercialSummary: data.commercialSummary,
      dealReadiness: data.dealReadiness,
      rawText: text
    };
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw new Error("Failed to analyze document. The institutional logic engine encountered an error.");
  }
};

export const fetchMarketIntelligence = async (query?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const finalQuery = query || "latest news and trends in the syndicated loan market and LMA standards 2024-2025";
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide a high-level professional summary for loan documentation analysts of: ${finalQuery}. Focus on regulatory changes, interest rate trends, and documentation standards.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks
    .filter((chunk: any) => chunk.web)
    .map((chunk: any) => ({
      title: chunk.web.title || "Source",
      uri: chunk.web.uri,
    }));

  return {
    summary: response.text,
    sources
  };
};
