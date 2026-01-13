
import React, { useState, useRef, useMemo } from 'react';
import { AnalysisResult, ClauseAnalysis } from '../types';
import { GoogleGenAI } from "@google/genai";

declare const html2pdf: any;

interface AnalysisReportProps {
  result: AnalysisResult;
  onReset: () => void;
}

interface MarketNews {
  summary: string;
  sources: { title: string; uri: string }[];
}

interface SlackCalculation {
  id: string;
  name: string;
  limit: number;
  actual: number;
  type: 'max' | 'min'; // 'max' for leverage (Debt/EBITDA), 'min' for cover (Interest Cover)
}

const AnalysisReport: React.FC<AnalysisReportProps> = ({ result, onReset }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [newsData, setNewsData] = useState<MarketNews | null>(null);
  const [isNewsCollapsed, setIsNewsCollapsed] = useState(false);
  const [slackCalculations, setSlackCalculations] = useState<Record<string, { limit: string, actual: string }>>({});
  const reportRef = useRef<HTMLDivElement>(null);

  const getScoreMeta = (score: number) => {
    if (score >= 85) return { 
      label: 'High Confidence', 
      text: 'text-emerald-700', 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-100',
      accent: 'border-emerald-500'
    };
    if (score >= 70) return { 
      label: 'Moderate Review', 
      text: 'text-amber-700', 
      bg: 'bg-amber-50', 
      border: 'border-amber-100',
      accent: 'border-amber-500'
    };
    return { 
      label: 'Critical / Low Confidence', 
      text: 'text-rose-700', 
      bg: 'bg-rose-50', 
      border: 'border-rose-100',
      accent: 'border-rose-500'
    };
  };

  const getReadinessColorPill = (score: number) => {
    if (score >= 85) return 'text-emerald-600 bg-white border-emerald-300 shadow-sm';
    if (score >= 70) return 'text-amber-600 bg-white border-amber-300 shadow-sm';
    return 'text-rose-600 bg-white border-rose-300 shadow-sm';
  };

  const financialCovenants = useMemo(() => {
    return result.confidenceAnalysis.filter(c => 
      c.name.toLowerCase().includes('covenant') || 
      c.name.toLowerCase().includes('leverage') || 
      c.name.toLowerCase().includes('ratio')
    );
  }, [result]);

  const handleFetchNews = async () => {
    setIsFetchingNews(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a concise professional summary of the latest news and trends in the syndicated loan market (2024-2025), specifically focusing on ${result.overview.facilityType} facilities and LMA standards.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const summary = response.text || "No intelligence found.";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title || "Source",
          uri: chunk.web.uri,
        }));

      setNewsData({ summary, sources });
      setIsNewsCollapsed(false);
    } catch (error) {
      console.error("Error fetching market intelligence:", error);
    } finally {
      setIsFetchingNews(false);
    }
  };

  const handleExport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    const element = reportRef.current;
    const opt = {
      margin: [10, 10],
      filename: `CREDIT_AUDIT_REPORT_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Clause Name",
      "Confidence Score (%)",
      "Review Required",
      "Provision Summary",
      "Audit Logic",
      "Market Standard Context",
      "Deviation Analysis",
      "Counterparty Impact"
    ];

    const rows = result.confidenceAnalysis.map(clause => [
      `"${clause.name.replace(/"/g, '""')}"`,
      clause.confidenceScore,
      clause.reviewRequired ? "YES" : "NO",
      `"${clause.summary.replace(/"/g, '""')}"`,
      `"${clause.reason.replace(/"/g, '""')}"`,
      `"${(clause.lmaComparison?.standardBenchmark || "").replace(/"/g, '""')}"`,
      `"${(clause.lmaComparison?.deviations || "").replace(/"/g, '""')}"`,
      `"${(clause.lmaComparison?.impact || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `CLAUSE_AUDIT_DATA_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateSlack = (limitStr: string, actualStr: string, name: string) => {
    const limit = parseFloat(limitStr);
    const actual = parseFloat(actualStr);
    if (isNaN(limit) || isNaN(actual)) return null;

    // Logic: Leverage usually "Max", Coverage usually "Min"
    const isMax = name.toLowerCase().includes('leverage') || name.toLowerCase().includes('debt');
    const slack = isMax ? (limit - actual) : (actual - limit);
    const percentage = isMax ? (slack / limit) * 100 : (slack / actual) * 100;
    
    return { slack, percentage, isSafe: slack >= 0, isMax };
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between sticky top-0 bg-[#f8fafc]/80 backdrop-blur-md z-10 border-b border-slate-200 no-print">
        <div className="flex items-center gap-4">
          <button onClick={onReset} className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors uppercase tracking-widest">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            New Audit
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Report #AUD-{Math.floor(Math.random() * 90000) + 10000}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-5 py-2 rounded hover:bg-slate-50 transition-all uppercase tracking-widest shadow-sm flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export CSV
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="bg-slate-900 text-white text-[10px] font-bold px-5 py-2 rounded hover:bg-black transition-all uppercase tracking-widest disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            {isExporting ? "Exporting..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div ref={reportRef} className="max-w-5xl mx-auto p-12 bg-white my-8 shadow-sm border border-slate-200 print:m-0 print:border-none print:shadow-none">
        {/* MEMORANDUM HEADER */}
        <div className="border-b-4 border-slate-900 pb-8 mb-10 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1">Loan Documentation Audit</h1>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">Institutional Lifecycle Intelligence Memorandum</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Analysis Date</p>
            <p className="text-sm font-bold text-slate-900 mono">{new Date().toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        {/* SECTION 1: OVERVIEW GRID */}
        <div className="grid grid-cols-3 gap-y-6 gap-x-12 mb-12">
          {[
            { label: 'Facility Type', value: result.overview.facilityType },
            { label: 'Counterparties', value: result.overview.borrowerLender },
            { label: 'Currency', value: result.overview.currency },
            { label: 'Committed Amount', value: result.overview.amount },
            { label: 'Maturity Profile', value: result.overview.maturity },
            { label: 'Jurisdiction', value: result.overview.law },
          ].map((item, idx) => (
            <div key={idx} className="border-b border-slate-100 pb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
              <p className="text-sm font-bold text-slate-900 tracking-tight">{item.value}</p>
            </div>
          ))}
        </div>

        {/* SECTION 2: DEAL READINESS SCORE */}
        <div className="mb-16">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em] border-b border-slate-200 pb-2 mb-8">01. Lifecycle Intelligence & Deal Readiness</h3>
          
          <div className="bg-[#f1f5f9] rounded-xl p-4 border border-slate-200 overflow-hidden mb-10">
            <div className="grid grid-cols-3">
              <div />
              <div className="bg-white border-2 border-blue-300 rounded-lg p-10 flex flex-col items-center justify-center text-center shadow-lg relative transform scale-105 z-10">
                <div className="relative w-40 h-40 mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="18" fill="transparent" className="text-slate-100" />
                    <circle 
                      cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="18" fill="transparent" 
                      strokeDasharray={440} strokeDashoffset={440 - (440 * result.dealReadiness.score) / 100}
                      strokeLinecap="round"
                      className={`${result.dealReadiness.score >= 85 ? 'text-emerald-500' : result.dealReadiness.score >= 70 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000 ease-out`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{result.dealReadiness.score}</span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Score</span>
                  </div>
                </div>
                <h4 className={`text-[10px] font-black uppercase tracking-[0.15em] px-5 py-2 rounded-full border ${getReadinessColorPill(result.dealReadiness.score)}`}>
                  {result.dealReadiness.status}
                </h4>
              </div>
              <div />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-20 gap-y-12">
            <div>
              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Positive Drivers
              </p>
              <ul className="space-y-4">
                {result.dealReadiness.driversPositive.map((d, i) => (
                  <li key={i} className="text-[12px] font-medium text-slate-600 flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" /> {d}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-bold text-rose-600 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Negative Drivers
              </p>
              <ul className="space-y-4">
                {result.dealReadiness.driversNegative.map((d, i) => (
                  <li key={i} className="text-[12px] font-medium text-slate-600 flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-rose-400 rounded-full mt-1.5 shrink-0" /> {d}
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-2 pt-8 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-900 uppercase tracking-[0.15em] mb-4">Priority Key Issues</p>
              <div className="flex flex-wrap gap-3">
                {result.dealReadiness.keyIssues.map((issue, i) => (
                  <span key={i} className="px-4 py-1.5 bg-slate-50 text-slate-700 text-[11px] font-bold rounded border border-slate-200 uppercase tracking-widest shadow-sm">
                    {issue}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: AUDIT SUMMARY CHECKLIST */}
        <div className="mb-16">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em] border-b border-slate-200 pb-2 mb-6">02. Audit Integrity Status</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clause Name</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence Score</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Human Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.confidenceAnalysis.map((clause, idx) => {
                  const meta = getScoreMeta(clause.confidenceScore);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-900">{clause.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                            <div className={`h-full ${meta.accent.replace('border-', 'bg-')}`} style={{ width: `${clause.confidenceScore}%` }} />
                          </div>
                          <span className={`text-[10px] font-black mono ${meta.text}`}>{clause.confidenceScore}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {clause.reviewRequired ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                            Required
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clear</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: CLAUSE AUDIT */}
        <div className="mb-20">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em] border-b border-slate-200 pb-2 mb-6">03. Detailed Clause Breakdown</h3>
          
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200 shadow-sm">
            {result.confidenceAnalysis.map((clause, idx) => {
              const meta = getScoreMeta(clause.confidenceScore);
              const isEven = idx % 2 === 0;
              return (
                <div key={idx} className={`group break-inside-avoid border-l-4 ${meta.accent} p-10 transition-all duration-200 hover:bg-slate-50/60 ${!isEven ? 'bg-slate-50/20' : 'bg-white'}`}>
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-5">
                      <span className="mono text-slate-200 font-bold text-3xl group-hover:text-slate-300 transition-colors">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 tracking-tight">{clause.name}</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${meta.text}`}>
                            {meta.label} • {clause.confidenceScore}% Confidence
                          </p>
                          {clause.reviewRequired && (
                            <span className="text-[9px] bg-rose-600 text-white px-2 py-0.5 rounded-sm font-black uppercase tracking-[0.1em] animate-pulse">Flagged</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-10">
                    <div className="col-span-12 lg:col-span-7 space-y-6">
                      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-3 font-mono tracking-widest">Extracted Provision Text</span>
                        <p className="text-[13px] text-slate-600 leading-relaxed max-h-48 overflow-y-auto pr-3 custom-scrollbar">
                          {clause.summary || "Provision text not detected in source."}
                        </p>
                      </div>
                      <div className="relative">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-2 tracking-widest">Audit Logic & Rationale</span>
                        <div className={`text-[12px] italic font-medium p-5 rounded-lg border ${meta.bg} ${meta.text} ${meta.border} shadow-sm leading-relaxed`}>
                          {clause.reason}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-12 lg:col-span-5 flex flex-col gap-5">
                      <div className="bg-slate-100/50 p-6 rounded-lg border border-slate-200 space-y-5">
                        <div className="border-b border-slate-200/60 pb-4">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1.5 tracking-widest">Market Standard Context</span>
                          <p className="text-[12px] font-bold text-slate-700 leading-snug">{clause.lmaComparison?.standardBenchmark}</p>
                        </div>
                        <div className="border-b border-slate-200/60 pb-4">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1.5 tracking-widest">Deviation Analysis</span>
                          <p className={`text-[11px] font-black uppercase tracking-tight ${clause.lmaComparison?.deviations.toLowerCase().includes('aggressive') ? 'text-red-600' : 'text-slate-900'}`}>
                            {clause.lmaComparison?.deviations}
                          </p>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1.5 tracking-widest">Counterparty Impact</span>
                          <p className="text-[12px] font-medium text-slate-500 leading-relaxed italic">{clause.lmaComparison?.impact}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* NEW SECTION: COVENANT SLACK CALCULATOR */}
        {financialCovenants.length > 0 && (
          <div className="mb-20 no-print">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em] border-b border-slate-200 pb-2 mb-8">04. Covenant Slack Calculator</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {financialCovenants.map((cov, idx) => {
                const values = slackCalculations[cov.name] || { limit: '', actual: '' };
                const calculation = calculateSlack(values.limit, values.actual, cov.name);

                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{cov.name}</h4>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Agreement Limit</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 3.5"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-bold focus:outline-none focus:border-blue-500"
                            value={values.limit}
                            onChange={(e) => setSlackCalculations({...slackCalculations, [cov.name]: {...values, limit: e.target.value}})}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Current Actual</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 2.1"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-bold focus:outline-none focus:border-blue-500"
                            value={values.actual}
                            onChange={(e) => setSlackCalculations({...slackCalculations, [cov.name]: {...values, actual: e.target.value}})}
                          />
                        </div>
                      </div>
                    </div>

                    {calculation ? (
                      <div className={`p-4 rounded-lg border ${calculation.isSafe ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <div className="flex justify-between items-end mb-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${calculation.isSafe ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {calculation.isSafe ? 'Compliant' : 'Breach Risk'}
                          </span>
                          <span className={`text-lg font-black tracking-tight ${calculation.isSafe ? 'text-emerald-900' : 'text-rose-900'}`}>
                            {calculation.percentage.toFixed(1)}% Slack
                          </span>
                        </div>
                        <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden mb-2">
                          <div 
                            className={`h-full transition-all duration-500 ${calculation.isSafe ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, calculation.percentage))}%` }}
                          />
                        </div>
                        <p className={`text-[10px] font-medium leading-relaxed ${calculation.isSafe ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {calculation.isSafe 
                            ? `Deal has ${calculation.slack.toFixed(2)} units of headroom before hitting the ${calculation.isMax ? 'max' : 'min'} limit.`
                            : `Projected breach detected. Currently ${Math.abs(calculation.slack).toFixed(2)} units beyond the threshold.`}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Enter values to calculate slack</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 5: RECOMMENDED ACTIONS */}
        <div className="mt-24 pt-10 border-t-2 border-slate-900">
           <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em] mb-8">05. Execution & Readiness Roadmap</h3>
           <div className="grid grid-cols-2 gap-12">
              <div className="space-y-6">
                <p className="text-[11px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>
                  Lifecycle Next Steps
                </p>
                <div className="flex flex-col gap-3">
                  {result.dealReadiness.recommendedActions.map((action, i) => (
                    <div key={i} className="px-4 py-3 bg-slate-900 text-white text-[10px] font-bold rounded uppercase tracking-wider flex items-center justify-between shadow-sm">
                      {action}
                      <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Commercial Snapshot
                </p>
                <div className="bg-emerald-50 p-5 rounded border border-emerald-100">
                  <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                    {result.commercialSummary.snapshot}
                  </p>
                </div>
              </div>
           </div>
        </div>

        {/* SECTION 6: MARKET NEWS INTELLIGENCE */}
        <div className="mt-16 pt-10 border-t border-slate-200 no-print">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em]">06. Real-Time Market Intelligence</h3>
            <button 
              onClick={handleFetchNews}
              disabled={isFetchingNews}
              className="bg-blue-600 text-white text-[10px] font-black px-4 py-2 rounded uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {isFetchingNews ? (
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              )}
              {newsData ? "Refresh Trends" : "Fetch Latest Market News"}
            </button>
          </div>

          {newsData && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setIsNewsCollapsed(!isNewsCollapsed)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-100/50 transition-colors"
              >
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Syndicated Loan Trends (2024-2025)</span>
                <svg className={`w-4 h-4 text-slate-400 transform transition-transform ${isNewsCollapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {!isNewsCollapsed && (
                <div className="px-6 pb-6 animate-fade-in">
                  <div className="prose prose-sm max-w-none text-slate-700 font-medium leading-relaxed mb-6 bg-white p-5 rounded border border-slate-100 shadow-inner">
                    {newsData.summary.split('\n').map((para, i) => (
                      <p key={i} className="mb-3 last:mb-0">{para}</p>
                    ))}
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Intelligence Sources</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {newsData.sources.map((source, i) => (
                        <a 
                          key={i} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
                        >
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-blue-100">
                            <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 truncate group-hover:text-blue-600">{source.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="mt-24 pt-8 border-t border-slate-100 flex justify-between items-center opacity-50">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Audit Engine: Lifecycle Intelligence v4.5</p>
          <div className="flex items-center gap-4">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Banker-Facing Workspace</p>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Internal Use Only</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisReport;
