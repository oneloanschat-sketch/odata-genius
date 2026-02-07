import React, { useState } from 'react';
import { generateDashboardConfig, suggestDashboards, generateAdvancedInsights } from './services/geminiService';
import { fetchServiceSchema, executeODataQuery } from './services/odataService';
import { parseFile, executeLocalQuery } from './services/fileService';
import { FuturisticBentoGrid } from './components/FuturisticBentoGrid';
import { WidgetCard } from './components/WidgetCard';
import { DrillDownModal } from './components/DrillDownModal';
import { DataExplorerModal } from './components/DataExplorerModal';
import { InsightsModal } from './components/InsightsModal';
import { DashboardWidgetConfig, DatabaseSchema, DataPoint, AnalysisResult, ChartType } from './types';

// Use a known public OData service for demo purposes if user has none
const DEFAULT_ODATA_URL = "https://services.odata.org/V4/Northwind/Northwind.svc";

type ConnectionMode = 'odata' | 'file';

const App: React.FC = () => {
  // Connection State
  const [mode, setMode] = useState<ConnectionMode>('odata');
  
  // OData State
  const [baseUrl, setBaseUrl] = useState(DEFAULT_ODATA_URL);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // File State
  const [fileData, setFileData] = useState<DataPoint[]>([]);

  // General App State
  const [isConnected, setIsConnected] = useState(false);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Dashboard State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>([]);
  
  // Modals
  const [drillConfig, setDrillConfig] = useState<DashboardWidgetConfig | null>(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  
  // Changed insightsText (string) to analysisResult (AnalysisResult | null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);

  // Unified Query Execution Helper
  const executeQuery = async (query: string): Promise<DataPoint[]> => {
    if (mode === 'odata') {
      return await executeODataQuery(baseUrl, query, username, password);
    } else {
      return executeLocalQuery(fileData, query);
    }
  };

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsConnecting(true);
    setError(null);
    try {
      const fetchedSchema = await fetchServiceSchema(baseUrl, username, password);
      setSchema(fetchedSchema);
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message || "Failed to connect to OData service");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsConnecting(true);
      setError(null);
      try {
        const { data, schema: parsedSchema } = await parseFile(e.target.files[0]);
        setFileData(data);
        setSchema(parsedSchema);
        setIsConnected(true);
      } catch (err: any) {
         setError("שגיאה בקריאת הקובץ: " + err.message);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleSuggest = async () => {
    if (!schema) return;
    setIsGenerating(true);
    try {
      const suggestions = await suggestDashboards(schema);
      setWidgets(prev => [...suggestions, ...prev]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "שגיאה ביצירת הצעות אוטומטיות.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdvancedInsights = async () => {
    if (!schema) return;
    setIsInsightsOpen(true);
    setIsInsightsLoading(true);
    setAnalysisResult(null);
    
    try {
      // Fetch a sample of data to send to AI
      let dataSample: DataPoint[] = [];
      if (mode === 'odata') {
         // Get sample from first entity
         const entity = schema.entities[0].name;
         dataSample = await executeODataQuery(baseUrl, `/${entity}?$top=50`, username, password);
      } else {
         dataSample = fileData.slice(0, 50);
      }

      const result = await generateAdvancedInsights(schema, dataSample);
      setAnalysisResult(result);
    } catch (err: any) {
      console.error(err);
      // Fallback object in case of error
      setAnalysisResult({
          summary: err.message || "אירעה שגיאה בניתוח הנתונים. אנא נסה שנית.",
          metrics: [],
          charts: [],
          findings: [{title: "שגיאה", description: "לא ניתן היה ליצור ניתוח.", severity: "high"}]
      });
    } finally {
      setIsInsightsLoading(false);
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || !schema) return;

    setIsGenerating(true);
    setError(null);

    try {
      const newWidgetConfig = await generateDashboardConfig(prompt, schema);
      
      // Validation / Dry Run
      const validationData = await executeQuery(newWidgetConfig.odataQuery);
      
      if (!validationData || validationData.length === 0) {
        setError(`לא נמצאו נתונים עבור הבקשה: "${newWidgetConfig.title}". נסה לנסח אחרת.`);
      } else {
        setWidgets(prev => [newWidgetConfig, ...prev]);
        setPrompt('');
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "אירעה שגיאה בעיבוד הבקשה או שלא נמצאו נתונים.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const handleUpdateWidget = (id: string, newConfig: Partial<DashboardWidgetConfig>) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...newConfig } : w));
  };

  // Connection Screen
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative elements for landing */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[oklch(65%_0.22_260)] blur-[120px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[oklch(70%_0.18_310)] blur-[120px] opacity-20"></div>

        <div className="max-w-md w-full bg-[var(--color-surface-glass)] backdrop-blur-2xl rounded-3xl shadow-[var(--shadow-glass)] border border-white/20 p-8 text-center relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 shadow-lg shadow-purple-500/30">
            G
          </div>
          <h1 className="text-3xl font-extrabold text-[var(--color-text-main)] mb-2 tracking-tight">OData Genius</h1>
          <p className="text-[var(--color-text-muted)] mb-8">הדור הבא של ניתוח נתונים ויזואלי</p>
          
          {/* Tabs */}
          <div className="flex p-1 bg-white/10 rounded-xl mb-6 border border-white/10">
             <button 
                onClick={() => setMode('odata')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'odata' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
               API (OData)
             </button>
             <button 
                onClick={() => setMode('file')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'file' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
               קובץ (Excel/CSV)
             </button>
          </div>

          {mode === 'odata' ? (
            <form onSubmit={handleConnect} className="space-y-4 text-right">
               <div>
                 <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">כתובת ה-API</label>
                 <input 
                   type="url" 
                   value={baseUrl}
                   onChange={(e) => setBaseUrl(e.target.value)}
                   className="w-full bg-white/50 border border-white/30 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-left transition-all"
                   dir="ltr"
                   required
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">שם משתמש</label>
                   <input 
                     type="text" 
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     className="w-full bg-white/50 border border-white/30 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-left transition-all"
                     dir="ltr"
                     placeholder="אופציונלי"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">סיסמא</label>
                   <input 
                     type="password" 
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full bg-white/50 border border-white/30 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-left transition-all"
                     dir="ltr"
                     placeholder="אופציונלי"
                   />
                 </div>
               </div>
               
               <button 
                 type="submit" 
                 disabled={isConnecting}
                 className="w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/20 flex justify-center items-center gap-2 mt-2"
               >
                 {isConnecting && <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>}
                 התחבר למערכת
               </button>
            </form>
          ) : (
            <div className="border-2 border-dashed border-[var(--color-text-muted)]/30 rounded-2xl p-8 flex flex-col items-center justify-center hover:bg-white/20 transition-all cursor-pointer relative group">
               <input 
                 type="file" 
                 onChange={handleFileUpload} 
                 accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                 className="absolute inset-0 opacity-0 cursor-pointer"
               />
               <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                   </svg>
               </div>
               <span className="text-sm font-bold text-[var(--color-text-main)]">גרור קובץ או לחץ להעלאה</span>
               <span className="text-xs text-[var(--color-text-muted)] mt-1">Excel (XLSX) או CSV</span>
               {isConnecting && <span className="mt-4 text-sm font-medium text-[var(--color-primary)] animate-pulse">מעבד נתונים...</span>}
            </div>
          )}

          {error && <div className="mt-4 text-red-500 text-sm bg-red-50/80 p-3 rounded-lg border border-red-100 backdrop-blur-sm">{error}</div>}
        </div>
      </div>
    );
  }

  // Main Dashboard Interface
  return (
    <div className="flex flex-col font-[Heebo] relative">
      
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--color-surface-glass)] border-b border-white/20 transition-all duration-300">
        <div className="max-w-[1800px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20">G</div>
            <h1 className="text-2xl font-extrabold text-[var(--color-text-main)] tracking-tight">OData Genius</h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end">
               <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] mb-0.5">מקור נתונים</span>
               <span className="text-xs font-mono bg-white/40 px-3 py-1 rounded-full text-[var(--color-text-main)] truncate max-w-[200px] border border-white/30 backdrop-blur-sm" title={mode === 'odata' ? baseUrl : 'קובץ מקומי'}>
                 {mode === 'odata' ? baseUrl : 'קובץ מקומי'}
               </span>
             </div>
             
             <button 
                onClick={() => setIsExplorerOpen(true)}
                className="flex items-center gap-1.5 text-sm bg-white/20 hover:bg-white/40 text-[var(--color-text-main)] px-5 py-2.5 rounded-xl transition-all font-medium border border-white/20 hover:border-white/40 backdrop-blur-sm"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                סייר נתונים
             </button>

             <button onClick={() => { setIsConnected(false); setSchema(null); setWidgets([]); setFileData([]); }} className="text-sm text-red-500 hover:text-red-600 font-medium px-2 opacity-70 hover:opacity-100 transition-opacity">התנתק</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-[1800px] mx-auto px-4 sm:px-6 py-8 w-full z-10">
        
        {/* Input Section */}
        <div className="max-w-4xl mx-auto mb-12 text-center relative">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[var(--color-text-main)] tracking-tight mb-4 drop-shadow-sm">
             גלה תובנות <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]">בלתי נראות</span>
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] mb-10 max-w-2xl mx-auto leading-relaxed">
            האנליסט האישי שלך מוכן לפעולה.
          </p>
          
          <form onSubmit={handleGenerate} className="relative group z-0 mb-8 max-w-3xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-700"></div>
            <div className="relative flex shadow-2xl rounded-2xl overflow-hidden bg-white/80 backdrop-blur-xl border border-white/50">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="לדוגמה: הצג את סך המכירות לפי קטגוריה..."
                className="block w-full p-5 text-lg border-none focus:ring-0 text-slate-800 placeholder-slate-400 bg-transparent"
                disabled={isGenerating}
              />
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className={`px-8 bg-[var(--color-primary)] hover:bg-[var(--color-secondary)] text-white font-medium text-lg transition-all duration-300 flex items-center gap-2
                  ${isGenerating ? 'opacity-80 cursor-wait' : ''}`}
              >
                {isGenerating ? (
                   <>
                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                   </>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                )}
              </button>
            </div>
          </form>

          <div className="flex justify-center gap-3 flex-wrap">
             <button 
                onClick={handleSuggest}
                disabled={isGenerating}
                className="group flex items-center gap-2 px-6 py-3 bg-white/40 backdrop-blur-md border border-white/40 rounded-full text-[var(--color-text-main)] hover:border-[var(--color-primary)] hover:shadow-lg transition-all duration-300"
             >
               <span className="bg-blue-100/50 text-blue-600 p-1.5 rounded-full group-hover:scale-110 transition-transform">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               </span>
               <span className="font-semibold text-sm">הצע דשבורד אוטומטי</span>
             </button>

             <button 
                onClick={handleAdvancedInsights}
                disabled={isGenerating}
                className="group flex items-center gap-2 px-6 py-3 bg-white/40 backdrop-blur-md border border-white/40 rounded-full text-[var(--color-text-main)] hover:border-[var(--color-secondary)] hover:shadow-lg transition-all duration-300"
             >
               <span className="bg-purple-100/50 text-purple-600 p-1.5 rounded-full group-hover:scale-110 transition-transform">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
               </span>
               <span className="font-semibold text-sm">ניתוח עומק (AI)</span>
             </button>
          </div>

          {error && (
            <div className="mt-8 inline-block px-6 py-3 bg-red-50/90 text-red-600 rounded-2xl border border-red-100 text-sm font-medium animate-in slide-in-from-top-2 shadow-sm backdrop-blur-sm">
              {error}
            </div>
          )}
        </div>

        {/* New Futuristic Grid */}
        <FuturisticBentoGrid 
           widgets={widgets}
           baseUrl={mode === 'file' ? 'LOCAL_FILE_MODE' : baseUrl}
           username={username}
           password={password}
           onRemove={handleRemoveWidget}
           onUpdate={handleUpdateWidget}
           onDrillDown={(c) => setDrillConfig(c)}
           fileData={fileData}
        />

      </main>

      {/* Drill Down Modal */}
      {drillConfig && (
        <DrillDownModal 
           isOpen={!!drillConfig} 
           config={drillConfig} 
           baseUrl={baseUrl}
           username={username}
           password={password}
           onClose={() => setDrillConfig(null)} 
        />
      )}

      {/* Data Explorer Modal */}
      {isExplorerOpen && schema && (
        <DataExplorerModal
          isOpen={isExplorerOpen}
          onClose={() => setIsExplorerOpen(false)}
          schema={schema}
          baseUrl={baseUrl}
          username={username}
          password={password}
          localData={mode === 'file' ? fileData : undefined}
        />
      )}

      {/* Insights Modal */}
      <InsightsModal 
         isOpen={isInsightsOpen}
         onClose={() => setIsInsightsOpen(false)}
         analysisResult={analysisResult}
         loading={isInsightsLoading}
      />
    </div>
  );
};

export default App;