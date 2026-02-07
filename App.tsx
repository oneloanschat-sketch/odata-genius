
import React, { useState, useEffect } from 'react';
import { generateDashboardConfig, suggestDashboards, generateAdvancedInsights } from './services/geminiService';
import { fetchServiceSchema, executeODataQuery } from './services/odataService';
import { parseFile, executeLocalQuery } from './services/fileService';
import { FuturisticBentoGrid } from './components/FuturisticBentoGrid';
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

  // Construct generic connection params to pass to widgets
  const connectionParams = {
    projectId,
    datasetId,
    ontology,
    token: timbrToken
  };

  // Connection Screen
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[var(--color-surface-100)]">
        
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
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] blur-[120px] opacity-10 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--color-secondary)] blur-[120px] opacity-10"></div>

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
                   className="w-full bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-[var(--color-text-main)] placeholder-gray-400 text-left transition-all"
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
                     className="w-full bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-[var(--color-text-main)] placeholder-gray-400 text-left transition-all"
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
                     className="w-full bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-[var(--color-text-main)] placeholder-gray-400 text-left transition-all"
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
                   className="w-full bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-[var(--color-text-main)] placeholder-gray-400 text-left transition-all"
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
                   className="w-full bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-[var(--color-text-main)] placeholder-gray-400 text-left transition-all"
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
                   className="w-full bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-[var(--color-text-main)] placeholder-gray-400 text-left transition-all"
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
                   className="w-full bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none text-[var(--color-text-main)] placeholder-gray-400 text-left transition-all"
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

  // Dashboard Screen (Connected)
  return (
    <div className="min-h-screen bg-[var(--color-surface-100)] font-[Heebo] transition-colors duration-300">
        {/* Header & Controls */}
        <header className="sticky top-0 z-50 bg-[var(--color-surface-glass)] backdrop-blur-md border-b border-[var(--color-border-glass)] shadow-sm">
            <div className="max-w-[1600px] mx-auto px-4 py-3">
               <div className="flex flex-col gap-4">
                  
                  {/* Top Bar */}
                  <div className="flex justify-between items-center">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20 cursor-pointer" onClick={() => setIsConnected(false)}>G</div>
                        <div className="flex flex-col">
                            <span className="font-extrabold text-lg text-[var(--color-text-main)] leading-tight">Data Genius</span>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                                    {mode === 'file' ? 'Local File' : (mode === 'sql' ? 'BigQuery' : (mode === 'timbr' ? 'Timbr KG' : 'OData API'))}
                                </span>
                            </div>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsExplorerOpen(true)}
                            className="p-2 md:px-4 md:py-2 rounded-xl bg-[var(--color-surface-200)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-300)] transition-all text-xs font-bold flex items-center gap-2 border border-[var(--color-border-glass)]"
                            title="סייר נתונים"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                            <span className="hidden md:inline">סייר</span>
                        </button>
                        
                        <button 
                            onClick={() => setIsFavoritesOpen(true)}
                            className="p-2 rounded-xl bg-[var(--color-surface-200)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-300)] transition-all relative border border-[var(--color-border-glass)]"
                            title="מועדפים"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                            {savedReports.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">{savedReports.length}</span>
                            )}
                        </button>

                        <button 
                           onClick={() => setIsDarkMode(!isDarkMode)}
                           className="p-2 rounded-xl bg-[var(--color-surface-200)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-300)] transition-all border border-[var(--color-border-glass)]"
                        >
                            {isDarkMode ? (
                               <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            ) : (
                               <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>
                     </div>
                  </div>

                  {/* Search / Prompt Bar */}
                  <div className="w-full max-w-3xl mx-auto space-y-3">
                      <form onSubmit={handleGenerate} className="relative group flex items-center">
                           <input 
                               type="text" 
                               value={prompt}
                               onChange={(e) => setPrompt(e.target.value)}
                               className="w-full bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] text-[var(--color-text-main)] text-sm rounded-2xl py-4 pr-6 pl-14 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none focus:border-transparent shadow-sm transition-all placeholder-gray-400 group-hover:shadow-md"
                               placeholder="מה תרצה לדעת על הנתונים? (לדוגמה: 'הצג את סך ההזמנות לפי מדינה בגרף עוגה')"
                               disabled={isGenerating}
                           />
                           
                           {/* Search Button - Absolute Left */}
                           <div className="absolute left-2 top-1/2 -translate-y-1/2">
                               <button 
                                   type="submit" 
                                   disabled={!prompt.trim() || isGenerating} 
                                   className={`p-2.5 rounded-xl text-white transition-all shadow-md flex items-center justify-center
                                     ${!prompt.trim() || isGenerating ? 'bg-gray-300 dark:bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90'}
                                   `}
                               >
                                   {isGenerating ? (
                                       <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                                   ) : (
                                       <svg className="w-5 h-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                   )}
                               </button>
                           </div>
                      </form>
                      
                      {/* Suggestions and other actions outside */}
                      <div className="flex justify-center gap-2">
                           <button 
                               type="button" 
                               onClick={handleSuggest} 
                               disabled={isSuggesting || isGenerating}
                               className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-surface-200)] text-[var(--color-text-main)] hover:bg-[var(--color-primary)] hover:text-white transition-all flex items-center gap-2 border border-[var(--color-border-glass)]"
                           >
                               {isSuggesting ? (
                                   <span className="animate-pulse">מייצר...</span>
                               ) : (
                                   <>
                                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                       <span>הצע דשבורד אוטומטי</span>
                                   </>
                               )}
                           </button>

                           <button 
                               type="button" 
                               onClick={handleAdvancedInsights} 
                               disabled={isInsightsLoading || isGenerating}
                               className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[var(--color-secondary)] to-purple-600 text-white hover:opacity-90 transition-all flex items-center gap-2 shadow-md shadow-purple-500/20"
                           >
                               {isInsightsLoading ? (
                                   <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                               ) : (
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                               )}
                               <span>ניתוח חכם</span>
                           </button>
                      </div>
                      
                      {error && <div className="text-center text-red-500 text-xs bg-red-50/10 p-2 rounded">{error}</div>}
                  </div>
               </div>
            </div>
        </header>

        {/* Main Content */}
        <main className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
            <FuturisticBentoGrid 
               widgets={widgets}
               baseUrl={mode === 'file' ? 'LOCAL_FILE_MODE' : (mode === 'sql' ? 'BigQuery' : (mode === 'timbr' ? 'Timbr' : baseUrl))}
               username={username}
               password={password}
               connectionParams={connectionParams} // Pass explicit connection details
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
