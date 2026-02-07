import React, { useState } from 'react';
import { generateDashboardConfig, suggestDashboards, generateAdvancedInsights } from './services/geminiService';
import { fetchServiceSchema, executeODataQuery } from './services/odataService';
import { parseFile, executeLocalQuery } from './services/fileService';
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 shadow-lg shadow-blue-200">
            G
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">חיבור למקור נתונים</h1>
          <p className="text-slate-500 mb-8">בחר כיצד ברצונך לייבא את הנתונים שלך.</p>
          
          {/* Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-lg mb-6">
             <button 
                onClick={() => setMode('odata')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'odata' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
             >
               API (OData)
             </button>
             <button 
                onClick={() => setMode('file')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'file' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
             >
               קובץ (Excel/CSV)
             </button>
          </div>

          {mode === 'odata' ? (
            <form onSubmit={handleConnect} className="space-y-4 text-right">
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">כתובת ה-API</label>
                 <input 
                   type="url" 
                   value={baseUrl}
                   onChange={(e) => setBaseUrl(e.target.value)}
                   className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-left"
                   dir="ltr"
                   required
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">שם משתמש</label>
                   <input 
                     type="text" 
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-left"
                     dir="ltr"
                     placeholder="אופציונלי"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">סיסמא</label>
                   <input 
                     type="password" 
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-left"
                     dir="ltr"
                     placeholder="אופציונלי"
                   />
                 </div>
               </div>
               
               <button 
                 type="submit" 
                 disabled={isConnecting}
                 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-2"
               >
                 {isConnecting && <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>}
                 התחבר ונתח נתונים
               </button>
            </form>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer relative">
               <input 
                 type="file" 
                 onChange={handleFileUpload} 
                 accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                 className="absolute inset-0 opacity-0 cursor-pointer"
               />
               <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
               <span className="text-sm font-medium text-blue-600">לחץ להעלאת קובץ</span>
               <span className="text-xs text-slate-400 mt-1">Excel (XLSX) או CSV</span>
               {isConnecting && <span className="mt-4 text-sm text-slate-600 animate-pulse">מעבד קובץ...</span>}
            </div>
          )}

          {error && <div className="mt-4 text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
        </div>
      </div>
    );
  }

  // Main Dashboard Interface
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-[Heebo]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">G</div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">OData Genius</h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end">
               <span className="text-xs font-mono bg-slate-100 px-3 py-1 rounded-full text-slate-500 truncate max-w-[200px] border border-slate-200" title={mode === 'odata' ? baseUrl : 'קובץ מקומי'}>
                 {mode === 'odata' ? baseUrl : 'קובץ מקומי'}
               </span>
             </div>
             
             <button 
                onClick={() => setIsExplorerOpen(true)}
                className="flex items-center gap-1.5 text-sm bg-slate-50 text-slate-700 hover:bg-slate-100 px-4 py-2 rounded-xl transition-colors font-medium border border-slate-200"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                סייר נתונים
             </button>

             <button onClick={() => { setIsConnected(false); setSchema(null); setWidgets([]); setFileData([]); }} className="text-sm text-red-500 hover:text-red-700 font-medium px-2">התנתק</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-[1600px] mx-auto px-6 py-8 w-full">
        
        {/* Input Section */}
        <div className="max-w-4xl mx-auto mb-16 text-center">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            מה תרצה לגלות בנתונים שלך היום?
          </h2>
          <p className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto">
            אנליסט ה-AI שלך מוכן. שאל שאלה חופשית, בקש הצעות או צלול לתובנות עומק.
          </p>
          
          <form onSubmit={handleGenerate} className="relative group z-0 mb-6 max-w-2xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative flex shadow-xl shadow-blue-100/50 rounded-xl overflow-hidden bg-white">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="לדוגמה: הצג את סך המכירות לפי קטגוריה..."
                className="block w-full p-5 text-lg border-none focus:ring-0 text-slate-800 placeholder-slate-300"
                disabled={isGenerating}
              />
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className={`px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium text-lg transition-colors flex items-center gap-2
                  ${isGenerating ? 'opacity-80 cursor-wait' : ''}`}
              >
                {isGenerating ? (
                   <>
                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <span>מעבד...</span>
                   </>
                ) : (
                    <span>צור</span>
                )}
              </button>
            </div>
          </form>

          <div className="flex justify-center gap-4 flex-wrap">
             <button 
                onClick={handleSuggest}
                disabled={isGenerating}
                className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:shadow-md transition-all"
             >
               <span className="bg-blue-50 text-blue-600 p-1 rounded-full group-hover:bg-blue-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               </span>
               <span className="font-medium text-sm">הצע דשבורד אוטומטי</span>
             </button>

             <button 
                onClick={handleAdvancedInsights}
                disabled={isGenerating}
                className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-purple-300 hover:text-purple-600 hover:shadow-md transition-all"
             >
               <span className="bg-purple-50 text-purple-600 p-1 rounded-full group-hover:bg-purple-100 transition-colors">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
               </span>
               <span className="font-medium text-sm">ניתוח עומק (AI)</span>
             </button>
          </div>

          {error && (
            <div className="mt-6 inline-block px-6 py-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm font-medium animate-in slide-in-from-top-2 shadow-sm">
              {error}
            </div>
          )}
        </div>

        {/* Dashboard Grid */}
        {widgets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {widgets.map((widget) => {
                // Determine span based on type
                const isKPI = widget.chartType === ChartType.KPICARD;
                const colSpan = isKPI ? 'md:col-span-1' : 'md:col-span-2';
                
                return (
                  <div key={widget.id} className={`${colSpan} min-w-0`}>
                      <WidgetCard 
                        config={widget} 
                        baseUrl={mode === 'file' ? 'LOCAL_FILE_MODE' : baseUrl} 
                        username={username}
                        password={password}
                        onRemove={handleRemoveWidget} 
                        onUpdate={handleUpdateWidget}
                        onDrillDown={(c) => setDrillConfig(c)}
                        {...{ _localDataRef: mode === 'file' ? fileData : undefined }}
                      />
                  </div>
                );
            })}
          </div>
        ) : (
          !isGenerating && (
            <div className="text-center py-24 opacity-60 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-slate-200 rounded-full mx-auto mb-4 flex items-center justify-center text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
              </div>
              <p className="text-xl text-slate-800 font-semibold">לוח המחוונים שלך ריק</p>
              <p className="text-slate-500 mt-2">התחל על ידי כתיבת שאלה, או בקש מה-AI לבנות עבורך דשבורד.</p>
            </div>
          )
        )}
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