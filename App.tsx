
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeLoanDocument, fetchMarketIntelligence } from './services/geminiService';
import { AnalysisResult } from './types';
import AnalysisReport from './components/AnalysisReport';

declare const mammoth: any;

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [marketIntel, setMarketIntel] = useState<{ summary: string; sources: any[] } | null>(null);
  const [isIntelLoading, setIsIntelLoading] = useState(false);
  const [intelQuery, setIntelQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMarketPulse();
  }, []);

  const loadMarketPulse = async (query?: string) => {
    setIsIntelLoading(true);
    try {
      const data = await fetchMarketIntelligence(query);
      setMarketIntel(data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error("Failed to fetch market pulse");
    } finally {
      setIsIntelLoading(false);
    }
  };

  const handleIntelSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadMarketPulse(intelQuery);
  };

  const processFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const conversionResult = await mammoth.convertToMarkdown({ arrayBuffer });
        setInputText(conversionResult.value);
      } else {
        const text = await file.text();
        setInputText(text);
      }
    } catch (err) {
      setError("Document processing failed. Please ensure the file is not encrypted.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const analysis = await analyzeLoanDocument(inputText);
      setResult(analysis);
    } catch (err: any) {
      setError(err.message || "Institutional API connection failed.");
    } finally {
      setIsLoading(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-[#fcfcfd]">
        <AnalysisReport result={result} onReset={() => { setResult(null); setInputText(''); setFileName(null); }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col font-inter">
      {/* Institutional Header */}
      <header className="h-16 border-b border-slate-100 bg-white flex items-center px-8 justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#0f172a] rounded flex items-center justify-center shadow-sm">
              <span className="text-white text-[11px] font-black">L</span>
            </div>
            <span className="font-extrabold text-[13px] tracking-tight text-[#0f172a] uppercase">LoanDoc Pro</span>
          </div>
          <div className="h-5 w-px bg-slate-200" />
          <div className="bg-[#f1f5f9] px-3 py-1.5 rounded-md border border-slate-200">
            <span className="text-[11px] font-bold text-[#334155] tracking-tight">Analysis Workspace</span>
          </div>
        </div>
        <div className="flex items-center">
          <span className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.15em]">V4.2.1 Stable</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-10 py-16 max-w-7xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Main Audit Column */}
          <div className="flex-1">
            <div className="mb-12">
              <h1 className="text-[32px] font-bold text-[#0f172a] tracking-tight mb-3">Documentation Audit</h1>
              <p className="text-[15px] text-[#64748b] font-medium leading-relaxed max-w-2xl">
                Upload credit agreements or LMA-style facilities for automated benchmarking and risk detection.
              </p>
            </div>

            {/* Upload Container */}
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 shadow-sm">
              {!inputText ? (
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); }}
                  className={`bg-white border border-slate-200 rounded-lg p-32 text-center transition-all cursor-pointer ${isDragging ? 'border-blue-400 bg-blue-50/10' : 'hover:border-slate-300 shadow-sm'}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#f1f5f9] text-[#94a3b8] mb-6">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <p className="text-[16px] font-bold text-[#0f172a] mb-1.5 tracking-tight">Upload Source Document</p>
                  <p className="text-[13px] text-[#94a3b8] font-medium">PDF, DOCX, or Plain Text (Max 10MB)</p>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                </div>
              ) : (
                <div className="flex flex-col h-[650px] bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-5 py-3 bg-[#f8fafc] border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-white rounded border border-slate-200 flex items-center justify-center text-[#64748b]">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <span className="text-[12px] font-bold text-[#334155] uppercase tracking-tight">
                        {fileName || "Buffered_Content.txt"}
                      </span>
                    </div>
                    <button 
                      onClick={() => { setInputText(''); setFileName(null); }} 
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-700 uppercase tracking-[0.15em] px-3 py-1 bg-white border border-slate-200 rounded shadow-sm transition-all"
                    >
                      Discard
                    </button>
                  </div>
                  <textarea 
                    className="flex-1 p-10 font-mono text-[13px] text-[#475569] leading-[1.8] focus:outline-none resize-none custom-scrollbar bg-slate-50/10"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Action Controls */}
            <div className="mt-8 flex justify-end">
              {inputText && (
                <button 
                  onClick={handleAnalyze}
                  disabled={isLoading}
                  className={`px-10 py-4 rounded-lg font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg ${isLoading ? 'bg-[#f1f5f9] text-[#94a3b8]' : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-blue-200'}`}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-3">
                      <svg className="animate-spin h-3.5 w-3.5 text-[#94a3b8]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Processing Engine...
                    </span>
                  ) : "Analyze Documentation"}
                </button>
              )}
            </div>
          </div>

          {/* Market Intelligence Sidebar - Updated */}
          <aside className="w-full lg:w-96 shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden sticky top-24">
              <div className="px-5 py-4 border-b border-slate-100 bg-[#f8fafc] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-[#0f172a] uppercase tracking-widest">Market Pulse</span>
                </div>
                {lastUpdated && !isIntelLoading && (
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Updated {lastUpdated}</span>
                )}
                {isIntelLoading && (
                  <svg className="animate-spin h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                )}
              </div>

              {/* Intelligence Search Bar */}
              <div className="p-4 bg-white border-b border-slate-50">
                <form onSubmit={handleIntelSearch} className="relative group">
                  <input 
                    type="text"
                    placeholder="Search specific trends (e.g. ESG, SOFR)..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-medium text-slate-700 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                    value={intelQuery}
                    onChange={(e) => setIntelQuery(e.target.value)}
                  />
                  <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </form>
              </div>

              <div className="p-5 max-h-[500px] overflow-y-auto custom-scrollbar bg-white">
                {isIntelLoading ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-5/6" />
                    </div>
                    <div className="h-20 bg-slate-50 rounded border border-slate-100 animate-pulse" />
                  </div>
                ) : marketIntel ? (
                  <div className="space-y-6">
                    <div className="prose prose-sm text-[12.5px] text-slate-600 font-medium leading-relaxed">
                      {marketIntel.summary.split('\n').filter(p => p.trim()).slice(0, 6).map((para, i) => (
                        <p key={i} className="mb-3 last:mb-0 border-l-2 border-slate-100 pl-4">{para}</p>
                      ))}
                    </div>
                    
                    {marketIntel.sources.length > 0 && (
                      <div className="space-y-3 pt-4 border-t border-slate-50">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Primary Intelligence Nodes</p>
                        <div className="space-y-2">
                          {marketIntel.sources.slice(0, 4).map((source, i) => (
                            <a 
                              key={i} 
                              href={source.uri} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="flex items-start gap-3 p-2.5 bg-slate-50/50 rounded-lg border border-transparent hover:border-blue-100 hover:bg-blue-50/30 transition-all group"
                            >
                              <div className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0 group-hover:border-blue-200">
                                <svg className="w-2.5 h-2.5 text-slate-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </div>
                              <span className="text-[11px] font-bold text-slate-600 truncate leading-tight group-hover:text-blue-700">{source.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">No Intelligence Data</p>
                    <p className="text-[10px] text-slate-300 mt-1">Refresh to load market pulse.</p>
                  </div>
                )}
              </div>
              <div className="p-4 bg-[#f8fafc] border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-tight uppercase tracking-tight">
                    Powered by Institutional Search Grounding v4
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {error && (
          <div className="mt-6 p-5 bg-rose-50 border border-rose-100 rounded-lg text-[13px] text-rose-700 font-semibold flex items-center gap-4 animate-fade-in">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Audit Error: {error}
          </div>
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="h-12 border-t border-slate-200 bg-white flex items-center px-10 justify-between shrink-0">
        <span className="text-[11px] font-medium text-[#94a3b8]">Secure Internal Environment • SSL Encrypted</span>
        <div className="flex gap-8">
          <a href="#" className="text-[10px] font-bold text-[#94a3b8] hover:text-[#475569] uppercase tracking-[0.15em] transition-colors">Support</a>
          <a href="#" className="text-[10px] font-bold text-[#94a3b8] hover:text-[#475569] uppercase tracking-[0.15em] transition-colors">Documentation</a>
        </div>
      </footer>
    </div>
  );
};

export default App;
