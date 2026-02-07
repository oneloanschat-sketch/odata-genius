import React, { useState, useEffect } from 'react';
import { generateDashboardConfig, suggestDashboards, generateAdvancedInsights } from './services/geminiService';
import { fetchServiceSchema, executeODataQuery } from './services/odataService';
import { parseFile, executeLocalQuery } from './services/fileService';
import { FuturisticBentoGrid } from './components/FuturisticBentoGrid';
import { WidgetCard } from './components/WidgetCard';
import { DrillDownModal } from './components/DrillDownModal';
import { DataExplorerModal } from './components/DataExplorerModal';
import { InsightsModal } from './components/InsightsModal';
import { DashboardWidgetConfig, DatabaseSchema, DataPoint, AnalysisResult, ChartType } from './types';
import { MOCK_SCHEMA, MOCK_KG_SCHEMA } from './constants';

// Use a known public OData service for demo purposes if user has none
const DEFAULT_ODATA_URL = "https://services.odata.org/V4/Northwind/Northwind.svc";

type ConnectionMode = 'odata' | 'file' | 'sql' | 'timbr';

const App: React.FC = () => {
  // Theme State (Default to true for Dark Mode)
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Connection State
  const [mode, setMode] = useState<ConnectionMode>('odata');
  
  // OData State
  const [baseUrl, setBaseUrl] = useState(DEFAULT_ODATA_URL);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // SQL State
  const [projectId, setProjectId] = useState('my-gcp-project');
  const [datasetId, setDatasetId] = useState('analytics_data');

  // Timbr State
  const [ontology, setOntology] = useState('ecommerce_kg');
  const [timbrToken, setTimbrToken] = useState('');

  // File State
  const [fileData, setFileData] = useState<DataPoint[]>([]);

  // General App State
  const [isConnected, setIsConnected] = useState(false);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Dashboard State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  // Specifically track "Suggestions" generation for better UI feedback
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>([]);
  
  // Modals
  const [drillConfig, setDrillConfig] = useState<DashboardWidgetConfig | null>(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  
  // Analysis & Favorites
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [savedReports, setSavedReports] = useState<AnalysisResult[]>([]);

  // Toggle Theme Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load favorites from local storage
  useEffect(() => {
    const saved = localStorage.getItem('odata_genius_favorites');
    if (saved) {
      try {
        setSavedReports(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  // Save favorites to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('odata_genius_favorites', JSON.stringify(savedReports));
  }, [savedReports]);

  // Unified Query Execution Helper
  const executeQuery = async (query: string): Promise<DataPoint[]> => {
    if (mode === 'odata') {
      return await executeODataQuery(baseUrl, query, username, password);
    } else if (mode === 'file') {
      return executeLocalQuery(fileData, query);
    } else {
      // SQL / Timbr Mode mock check
      return []; 
    }
  };

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsConnecting(true);
    setError(null);
    try {
      if (mode === 'odata') {
          const fetchedSchema = await fetchServiceSchema(baseUrl, username, password);
          setSchema(fetchedSchema);
      } else if (mode === 'sql') {
          // Mock connection for SQL
          await new Promise(r => setTimeout(r, 1000));
          setSchema(MOCK_SCHEMA); 
      } else if (mode === 'timbr') {
          // Mock connection for Timbr Knowledge Graph
          await new Promise(r => setTimeout(r, 1000));
          setSchema(MOCK_KG_SCHEMA);
      }
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message || "Failed to connect to service");
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
    setIsSuggesting(true); // Specific loader
    try {
      const suggestions = await suggestDashboards(schema, mode);
      setWidgets(prev => [...suggestions, ...prev]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "שגיאה ביצירת הצעות אוטומטיות.");
    } finally {
      setIsSuggesting(false);
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
      const entity = schema.entities[0].name;

      if (mode === 'odata') {
         dataSample = await executeODataQuery(baseUrl, `/${entity}?$top=50`, username, password);
      } else if (mode === 'file') {
         dataSample = fileData.slice(0, 50);
      } else {
         // SQL / Timbr Mock Sample
         dataSample = [{name: 'Sample A', value: 100}, {name: 'Sample B', value: 200}];
      }

      const result = await generateAdvancedInsights(schema, dataSample, entity);
      setAnalysisResult(result);
    } catch (err: any) {
      console.error(err);
      setAnalysisResult({
          id: 'error',
          createdAt: new Date().toISOString(),
          sourceEntity: 'Unknown',
          summary: err.message || "אירעה שגיאה בניתוח הנתונים. אנא נסה שנית.",
          metrics: [],
          charts: [],
          findings: [{title: "שגיאה", description: "לא ניתן היה ליצור ניתוח.", severity: "high"}]
      });
    } finally {
      setIsInsightsLoading(false);
    }
  };

  const handleSaveReport = (report: AnalysisResult) => {
      // Check if already saved
      if (savedReports.some(r => r.id === report.id)) return;
      setSavedReports(prev => [report, ...prev]);
  };

  const handleOpenReport = (report: AnalysisResult) => {
      setAnalysisResult(report);
      setIsFavoritesOpen(false);
      setIsInsightsOpen(true);
  };

  const handleDeleteReport = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSavedReports(prev => prev.filter(r => r.id !== id));
  };

  // Helper to open drill down from Insights
  const handleInsightsDrillDown = (entity: string) => {
      const drillDownConfig: DashboardWidgetConfig = {
          id: 'temp-drill-down',
          title: `נתונים גולמיים: ${entity}`,
          description: '',
          chartType: ChartType.BAR, // Dummy
          odataQuery: `/${entity}?$top=100`, // Default drill down query
          xAxisKey: '',
          dataKey: '',
          entity: entity
      };
      setDrillConfig(drillDownConfig);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || !schema) return;

    setIsGenerating(true);
    setError(null);

    try {
      const newWidgetConfig = await generateDashboardConfig(prompt, schema, mode);
      
      // For SQL/Timbr we skip validation in this demo as we mock it
      if (mode === 'odata' || mode === 'file') {
          const validationData = await executeQuery(newWidgetConfig.odataQuery);
          if (!validationData || validationData.length === 0) {
            setError(`לא נמצאו נתונים עבור הבקשה: "${newWidgetConfig.title}". נסה לנסח אחרת.`);
            setIsGenerating(false);
            return;
          }
      }

      setWidgets(prev => [newWidgetConfig, ...prev]);
      setPrompt('');

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
        
        {/* Theme Toggle Absolute Position for Landing */}
        <button 
           onClick={() => setIsDarkMode(!isDarkMode)}
           className="absolute top-6 right-6 p-3 rounded-full bg-[var(--color-surface-glass)] border border-[var(--color-border-glass)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-200)] transition-all z-20"
           title={isDarkMode ? "עבור למצב בהיר" : "עבור למצב כהה"}
        >
            {isDarkMode ? (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
               </svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
               </svg>
            )}
        </button>

        {/* Decorative elements for landing */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[oklch(65%_0.22_260)] blur-[120px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[oklch(70%_0.18_310)] blur-[120px] opacity-20"></div>

        <div className="max-w-md w-full bg-[var(--color-surface-glass)] backdrop-blur-2xl rounded-3xl shadow-[var(--shadow-glass)] border border-[var(--color-border-glass)] p-8 text-center relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 shadow-lg shadow-purple-500/30">
            G
          </div>
          <h1 className="text-3xl font-extrabold text-[var(--color-text-main)] mb-2 tracking-tight">Data Genius</h1>
          <p className="text-[var(--color-text-muted)] mb-8">הדור הבא של ניתוח נתונים ויזואלי</p>
          
          {/* Tabs - Now resets state on switch */}
          <div className="flex p-1 bg-[var(--color-surface-200)]/50 rounded-xl mb-6 border border-[var(--color-border-glass)] gap-1">
             <button 
                onClick={() => {
                   setMode('odata');
                   setIsConnected(false);
                   setSchema(null);
                   setWidgets([]);
                   setFileData([]);
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'odata' ? 'bg-[var(--color-surface-100)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
             >
               API
             </button>
             <button 
                onClick={() => {
                   setMode('sql');
                   setIsConnected(false);
                   setSchema(null);
                   setWidgets([]);
                   setFileData([]);
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'sql' ? 'bg-[var(--color-surface-100)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
             >
               BigQuery
             </button>
             <button 
                onClick={() => {
                   setMode('timbr');
                   setIsConnected(false);
                   setSchema(null);
                   setWidgets([]);
                   setFileData([]);
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'timbr' ? 'bg-[var(--color-surface-100)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
             >
               Timbr KG
             </button>
             <button 
                onClick={() => {
                   setMode('file');
                   setIsConnected(false);
                   setSchema(null);
                   setWidgets([]);
                   setFileData([]);
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'file' ? 'bg-[var(--color-surface-100)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
             >
               קובץ
             </button>
          </div>

          {mode === 'odata' && (
            <form onSubmit={handleConnect} className="space-y-4 text-right">
               <div>
                 <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">כתובת ה-API</label>
                 <input 
                   type="url" 
                   value={baseUrl}
                   onChange={(e) => setBaseUrl(e.target.value)}
                   className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-left transition-all"
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
                     className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-left transition-all"
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
                     className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-left transition-all"
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
          )}
          
          {mode === 'sql' && (
            <form onSubmit={handleConnect} className="space-y-4 text-right">
               <div>
                 <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Project ID</label>
                 <input 
                   type="text" 
                   value={projectId}
                   onChange={(e) => setProjectId(e.target.value)}
                   className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-left transition-all"
                   dir="ltr"
                   required
                 />
               </div>
               <div>
                 <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Dataset Name</label>
                 <input 
                   type="text" 
                   value={datasetId}
                   onChange={(e) => setDatasetId(e.target.value)}
                   className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-left transition-all"
                   dir="ltr"
                   required
                 />
               </div>
               
               <button 
                 type="submit" 
                 disabled={isConnecting}
                 className="w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/20 flex justify-center items-center gap-2 mt-2"
               >
                 {isConnecting && <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>}
                 התחבר ל-BigQuery
               </button>
            </form>
          )}
          
          {mode === 'timbr' && (
            <form onSubmit={handleConnect} className="space-y-4 text-right">
               <div>
                 <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Ontology Name</label>
                 <input 
                   type="text" 
                   value={ontology}
                   onChange={(e) => setOntology(e.target.value)}
                   className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-left transition-all"
                   dir="ltr"
                   required
                 />
               </div>
               <div>
                 <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Token / Password</label>
                 <input 
                   type="password" 
                   value={timbrToken}
                   onChange={(e) => setTimbrToken(e.target.value)}
                   className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-left transition-all"
                   dir="ltr"
                 />
               </div>
               
               <button 
                 type="submit" 
                 disabled={isConnecting}
                 className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/20 flex justify-center items-center gap-2 mt-2"
               >
                 {isConnecting && <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>}
                 התחבר ל-Timbr.ai
               </button>
            </form>
          )}

          {mode === 'file' && (
            <div className="border-2 border-dashed border-[var(--color-text-muted)]/30 rounded-2xl p-8 flex flex-col items-center justify-center hover:bg-[var(--color-surface-200)]/30 transition-all cursor-pointer relative group">
               <input 
                 type="file" 
                 onChange={handleFileUpload} 
                 accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                 className="absolute inset-0 opacity-0 cursor-pointer"
               />
               <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
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
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--color-surface-glass)] border-b border-[var(--color-border-glass)] transition-all duration-300">
        <div className="max-w-[1800px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20">G</div>
            <h1 className="text-2xl font-extrabold text-[var(--color-text-main)] tracking-tight">Data Genius</h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end">
               <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] mb-0.5">מקור נתונים</span>
               <span className="text-xs font-mono bg-[var(--color-surface-200)]/40 px-3 py-1 rounded-full text-[var(--color-text-main)] truncate max-w-[200px] border border-[var(--color-border-glass)] backdrop-blur-sm" 
                 title={mode === 'odata' ? baseUrl : (mode === 'sql' ? `${projectId}.${datasetId}` : (mode === 'timbr' ? `KG: ${ontology}` : 'קובץ מקומי'))}>
                 {mode === 'odata' ? baseUrl : (mode === 'sql' ? `${projectId}.${datasetId}` : (mode === 'timbr' ? `Timbr: ${ontology}` : 'קובץ מקומי'))}
               </span>
             </div>

             {/* Theme Toggle Button */}
             <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2.5 rounded-xl bg-[var(--color-surface-200)]/20 hover:bg-[var(--color-surface-200)]/40 border border-[var(--color-border-glass)] text-[var(--color-text-main)] transition-all"
                title={isDarkMode ? "עבור למצב בהיר" : "עבור למצב כהה"}
             >
                {isDarkMode ? (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                   </svg>
                ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                   </svg>
                )}
             </button>
             
             {/* Favorites Button */}
             <button
               onClick={() => setIsFavoritesOpen(true)}
               className="p-2.5 rounded-xl bg-[var(--color-surface-200)]/20 hover:bg-[var(--color-surface-200)]/40 border border-[var(--color-border-glass)] text-[var(--color-text-main)] transition-all relative"
               title="דוחות שמורים"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={savedReports.length > 0 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {savedReports.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {savedReports.length}
                  </span>
                )}
             </button>

             <button 
                onClick={() => setIsExplorerOpen(true)}
                className="flex items-center gap-1.5 text-sm bg-[var(--color-surface-200)]/20 hover:bg-[var(--color-surface-200)]/40 text-[var(--color-text-main)] px-5 py-2.5 rounded-xl transition-all font-medium border border-[var(--color-border-glass)] hover:border-[var(--color-border-glass)]/60 backdrop-blur-sm"
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
            <div className="relative flex shadow-2xl rounded-2xl overflow-hidden bg-[var(--color-surface-200)]/80 backdrop-blur-xl border border-[var(--color-border-glass)]">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === 'timbr' ? "שאל על ה-Knowledge Graph (למשל: סך המכירות ללקוח)" : (mode === 'sql' ? "בקש שאילתת SQL..." : "לדוגמה: הצג את סך המכירות לפי קטגוריה...")}
                className="block w-full p-5 text-lg border-none focus:ring-0 text-[var(--color-text-main)] placeholder-slate-400 bg-transparent"
                disabled={isGenerating || isSuggesting}
              />
              <button
                type="submit"
                disabled={isGenerating || isSuggesting || !prompt.trim()}
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
                disabled={isGenerating || isSuggesting}
                className="group flex items-center gap-2 px-6 py-3 bg-[var(--color-surface-200)]/40 backdrop-blur-md border border-[var(--color-border-glass)] rounded-full text-[var(--color-text-main)] hover:border-[var(--color-primary)] hover:shadow-lg transition-all duration-300 min-w-[220px] justify-center"
             >
               {isSuggesting ? (
                 <>
                   <svg className="animate-spin h-4 w-4 text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   <span className="font-semibold text-sm">בונה דשבורד...</span>
                 </>
               ) : (
                 <>
                   <span className="bg-blue-100/50 text-blue-600 p-1.5 rounded-full group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                   </span>
                   <span className="font-semibold text-sm">הצע דשבורד אוטומטי</span>
                 </>
               )}
             </button>

             <button 
                onClick={handleAdvancedInsights}
                disabled={isGenerating || isSuggesting}
                className="group flex items-center gap-2 px-6 py-3 bg-[var(--color-surface-200)]/40 backdrop-blur-md border border-[var(--color-border-glass)] rounded-full text-[var(--color-text-main)] hover:border-[var(--color-secondary)] hover:shadow-lg transition-all duration-300 min-w-[200px] justify-center"
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
           baseUrl={mode === 'file' ? 'LOCAL_FILE_MODE' : (mode === 'sql' ? 'BigQuery' : (mode === 'timbr' ? 'Timbr' : baseUrl))}
           username={username}
           password={password}
           onRemove={handleRemoveWidget}
           onUpdate={handleUpdateWidget}
           onDrillDown={(c) => setDrillConfig(c)}
           fileData={fileData}
        />

      </main>

      {/* Favorites Modal */}
      {isFavoritesOpen && (
         <div className="fixed inset-0 z-[120] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[80vh] shadow-2xl flex flex-col animate-in scale-95 duration-200">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                 <h2 className="text-xl font-bold text-slate-800 dark:text-white">דוחות שמורים</h2>
                 <button onClick={() => setIsFavoritesOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
              <div className="p-2 overflow-y-auto flex-1">
                 {savedReports.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                     <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                     <p>אין דוחות שמורים עדיין.</p>
                   </div>
                 ) : (
                   <div className="space-y-2">
                     {savedReports.map(report => (
                       <div key={report.id} onClick={() => handleOpenReport(report)} className="p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer transition-all flex justify-between items-center group">
                          <div>
                            <div className="font-bold text-slate-800 dark:text-white">{new Date(report.createdAt).toLocaleDateString('he-IL')} - {new Date(report.createdAt).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}</div>
                            <div className="text-sm text-slate-500 line-clamp-1">{report.summary}</div>
                          </div>
                          <button onClick={(e) => handleDeleteReport(report.id, e)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
           </div>
         </div>
      )}

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
          mode={mode}
        />
      )}

      {/* Insights Modal */}
      <InsightsModal 
         isOpen={isInsightsOpen}
         onClose={() => setIsInsightsOpen(false)}
         analysisResult={analysisResult}
         loading={isInsightsLoading}
         onSave={handleSaveReport}
         isSaved={analysisResult ? savedReports.some(r => r.id === analysisResult.id) : false}
         onDrillDown={handleInsightsDrillDown}
      />
    </div>
  );
};

export default App;