
import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { DashboardWidgetConfig, ChartType, DataPoint, AlertConfig } from '../types';
import { executeODataQuery } from '../services/odataService';
import { executeLocalQuery } from '../services/fileService';
import { executeMockSqlQuery } from '../services/mockSqlService';
import { executeMockTimbrQuery } from '../services/mockTimbrService';
import { COLORS } from '../constants';

interface WidgetCardProps {
  config: DashboardWidgetConfig;
  baseUrl: string;
  username?: string;
  password?: string;
  // Generic connection parameters for SQL/Timbr (ProjectID, Dataset, Ontology, Token etc.)
  connectionParams?: { [key: string]: string };
  onRemove: (id: string) => void;
  onUpdate: (id: string, newConfig: Partial<DashboardWidgetConfig>) => void;
  onDrillDown: (config: DashboardWidgetConfig) => void;
  _localDataRef?: DataPoint[];
}

export const WidgetCard: React.FC<WidgetCardProps> = ({ config, baseUrl, username, password, connectionParams, onRemove, onUpdate, onDrillDown, _localDataRef }) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Analysis State
  const [filterValue, setFilterValue] = useState<string>('');
  const [isHovered, setIsHovered] = useState(false);
  
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        let result: DataPoint[] = [];
        
        if (config.sqlQuery) {
            if (connectionParams && connectionParams.ontology) {
               // Timbr Semantic SQL
               result = await executeMockTimbrQuery(
                   config.sqlQuery, 
                   connectionParams.ontology, 
                   connectionParams.token
               );
            } else if (connectionParams && connectionParams.projectId) {
               // Standard SQL / BigQuery Mode
               result = await executeMockSqlQuery(
                   config.sqlQuery,
                   connectionParams.projectId,
                   connectionParams.datasetId
               );
            } else {
               // Fallback / Default Mock
               result = await executeMockSqlQuery(config.sqlQuery, 'mock-project', 'mock-dataset');
            }
        } else if (baseUrl === 'LOCAL_FILE_MODE') {
             if (_localDataRef) {
                 result = executeLocalQuery(_localDataRef, config.odataQuery);
             }
        } else {
             // OData Mode
             result = await executeODataQuery(baseUrl, config.odataQuery, username, password);
        }

        if (isMounted) setData(result);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [config.odataQuery, config.sqlQuery, baseUrl, username, password, connectionParams, _localDataRef]);

  // Keys
  const hasActualTarget = data.length > 0 && 'target' in data[0];
  const xKey = config.xAxisKey || 'name';
  const mainKey = hasActualTarget ? 'actual' : (config.dataKey || 'value');

  // Process Data (Filter & Sort & Group)
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Filter
    if (filterValue) {
      const isNumericFilter = !isNaN(Number(filterValue));
      result = result.filter(item => {
        const val = item[mainKey];
        const name = item[xKey];
        if (isNumericFilter) {
          return Number(val) >= Number(filterValue);
        }
        return String(name).toLowerCase().includes(filterValue.toLowerCase());
      });
    }

    // 2. Client-side Aggregation (Grouping)
    if (result.length > 0 && xKey && mainKey) {
        const keySet = new Set<string>();
        let needsAggregation = false;
        
        for (const item of result) {
            const key = String(item[xKey]);
            if (keySet.has(key)) {
                needsAggregation = true;
                break;
            }
            keySet.add(key);
        }

        if (needsAggregation) {
            const groupedMap = new Map<string, number>();
            result.forEach(item => {
                const key = String(item[xKey]);
                let val = Number(item[mainKey]);
                if (isNaN(val)) val = 1; 

                groupedMap.set(key, (groupedMap.get(key) || 0) + val);
            });

            result = Array.from(groupedMap.entries()).map(([key, val]) => ({
                [xKey]: key,
                [mainKey]: val
            }));
            
            result.sort((a, b) => b[mainKey] - a[mainKey]);
        }
    }

    return result;
  }, [data, filterValue, mainKey, xKey]);

  // Calculations
  const total = useMemo(() => processedData.reduce((acc, curr) => acc + (Number(curr[mainKey]) || 0), 0), [processedData, mainKey]);
  const average = useMemo(() => processedData.length ? total / processedData.length : 0, [total, processedData]);

  // --- Visual Definitions ---
  // We define Gradients and Filters to make charts look premium
  const renderDefs = (id: string) => (
    <defs>
      {/* Primary Gradient (Blue-Indigo) */}
      <linearGradient id={`grad-primary-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.9}/>
        <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0.4}/>
      </linearGradient>
      
      {/* Secondary Gradient (Pink-Rose) */}
      <linearGradient id={`grad-secondary-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={COLORS[1]} stopOpacity={0.9}/>
        <stop offset="100%" stopColor={COLORS[1]} stopOpacity={0.4}/>
      </linearGradient>

      {/* Area Chart Gradient (Fade to transparent) */}
      <linearGradient id={`grad-area-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={COLORS[2]} stopOpacity={0.5}/>
        <stop offset="95%" stopColor={COLORS[2]} stopOpacity={0}/>
      </linearGradient>

      {/* Glow Filter */}
      <filter id={`glow-${id}`} height="300%" width="300%" x="-75%" y="-75%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );

  // Styling for Axes and Tooltips
  const axisStyle = { 
     fontSize: 10, 
     fill: 'var(--color-text-muted)', 
     fontFamily: 'Heebo, sans-serif',
     fontWeight: 500
  };

  const tooltipStyle = { 
    backgroundColor: 'rgba(20, 20, 30, 0.85)', 
    borderRadius: '12px', 
    border: '1px solid rgba(255,255,255,0.1)', 
    backdropFilter: 'blur(12px)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)', 
    color: '#fff',
    padding: '12px',
    fontSize: '12px'
  };

  // Render Charts
  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[160px]">
           <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs text-[var(--color-text-muted)] font-medium">טוען נתונים...</span>
          </div>
        </div>
      );
    }

    if (processedData.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] text-[var(--color-text-muted)] border border-dashed border-[var(--color-border-glass)] rounded-lg m-2 bg-white/5">
           <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           <span className="text-sm font-medium">אין נתונים להצגה</span>
        </div>
      );
    }

    switch (config.chartType) {
      case ChartType.KPICARD:
        return null;
        
      case ChartType.LINE:
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={150}>
            <LineChart data={processedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              {renderDefs(config.id)}
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-glass)" strokeOpacity={0.5} />
              <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} dy={10} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={30} />
              <Tooltip 
                contentStyle={tooltipStyle} 
                itemStyle={{ color: '#fff', fontWeight: 600 }}
                cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Line 
                type="monotone" 
                dataKey={mainKey} 
                stroke={`url(#grad-primary-${config.id})`} // Use Gradient stroke
                strokeWidth={4} 
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#fff', stroke: COLORS[0] }} 
                animationDuration={1500} 
                filter={`url(#glow-${config.id})`} // Apply glow
              />
            </LineChart>
          </ResponsiveContainer>
        );
      case ChartType.PIE:
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={150}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              {renderDefs(config.id)}
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                innerRadius={50} // Donut Style
                outerRadius={70}
                paddingAngle={4}
                dataKey={mainKey}
                nameKey={xKey}
                stroke="none"
              >
                {processedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    stroke="rgba(255,255,255,0.1)" 
                    strokeWidth={1} 
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'Heebo' }}/>
            </PieChart>
          </ResponsiveContainer>
        );
      case ChartType.AREA:
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={150}>
            <AreaChart data={processedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              {renderDefs(config.id)}
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-glass)" strokeOpacity={0.5} />
              <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} dy={10} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} cursor={{ stroke: COLORS[2], strokeWidth: 1 }} />
              <Area 
                type="monotone" 
                dataKey={mainKey} 
                stroke={COLORS[2]} 
                fillOpacity={1} 
                fill={`url(#grad-area-${config.id})`} 
                strokeWidth={3} 
                animationDuration={1500} 
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      case ChartType.BAR:
      default:
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={150}>
            <BarChart data={processedData} barSize={20} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              {renderDefs(config.id)}
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-glass)" strokeOpacity={0.5} />
              <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} dy={10} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={30} />
              <Tooltip cursor={{fill: 'var(--color-border-glass)', opacity: 0.3}} contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} />
              <Bar 
                dataKey={mainKey} 
                fill={`url(#grad-primary-${config.id})`} 
                radius={[6, 6, 0, 0]} 
                animationDuration={1200}
              >
                 {processedData.map((entry, index) => (
                   // Optional: Cycle through gradients for a multi-color bar chart effect, 
                   // or keep uniform for a clean look. Let's do uniform but allow override.
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? `url(#grad-primary-${config.id})` : `url(#grad-secondary-${config.id})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  // Special Render for KPI Card
  if (config.chartType === ChartType.KPICARD) {
      return (
        <div 
          className="rounded-2xl p-6 shadow-sm border border-[var(--color-border-glass)] relative group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden h-full flex flex-col justify-between"
          style={{ background: 'var(--card-bg-gradient)' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
             {/* Background Decoration */}
             <div className="absolute -left-6 -top-6 w-32 h-32 bg-gradient-to-br from-[var(--color-primary)] to-transparent rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700 ease-in-out blur-2xl"></div>
             <div className="absolute right-0 bottom-0 w-40 h-40 bg-gradient-to-tl from-[var(--color-secondary)] to-transparent rounded-full opacity-5 blur-3xl"></div>
             
             <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start w-full">
                   <div>
                       <h3 className="text-[var(--color-text-muted)] font-bold text-xs mb-2 uppercase tracking-widest">{config.title}</h3>
                       {loading ? (
                           <div className="h-10 w-32 bg-[var(--color-border-glass)] rounded animate-pulse mt-2"></div>
                       ) : (
                           <div className="text-4xl md:text-5xl font-black text-[var(--color-text-main)] tracking-tight drop-shadow-sm mt-1 bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-text-main)] to-[var(--color-primary)]">
                               {total.toLocaleString()}
                           </div>
                       )}
                   </div>
                   {/* Remove Button for KPI */}
                   <button 
                      onClick={() => onRemove(config.id)}
                      className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors md:opacity-0 md:group-hover:opacity-100 p-2 md:p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                </div>
                
                <div className="flex items-end justify-between mt-4 border-t border-[var(--color-border-glass)] pt-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>LIVE</span>
                    </div>
                    
                    {config.sqlQuery && (
                         <div title={config.sqlQuery} className={`text-[10px] px-2 py-1 rounded cursor-help font-mono max-w-[100px] truncate ${connectionParams?.ontology ? 'bg-purple-500/10 text-purple-500' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'}`}>
                            {connectionParams?.ontology ? 'KG-SQL' : 'SQL'}
                         </div>
                    )}
                    
                    <button 
                        onClick={() => onDrillDown(config)}
                        className="text-xs text-[var(--color-primary)] font-bold hover:underline opacity-80 hover:opacity-100 flex items-center gap-1 p-2 md:p-0"
                    >
                        נתונים
                        <svg className="w-3 h-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                </div>
             </div>
        </div>
      );
  }

  // Standard Render for Charts
  return (
    <div 
      className="bg-[var(--color-surface-glass)]/60 backdrop-blur-xl rounded-3xl shadow-lg border border-[var(--color-border-glass)] flex flex-col relative group transition-all duration-300 hover:shadow-2xl hover:border-[var(--color-primary)]/30 overflow-hidden h-full min-h-[260px] md:min-h-[360px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-[var(--color-border-glass)] flex justify-between items-start bg-gradient-to-b from-white/5 to-transparent">
        <div className="flex-1 pr-2">
          <h3 className="text-base md:text-lg font-extrabold text-[var(--color-text-main)] tracking-tight leading-tight">{config.title}</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-1 font-medium">{config.description}</p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 md:gap-2">
            {/* SQL Indicator */}
            {config.sqlQuery && (
               <div className="group/sql relative hidden md:block">
                 <div className={`text-[10px] font-mono font-bold border px-2 py-1 rounded cursor-help ${connectionParams?.ontology ? 'text-purple-500 border-purple-500/30 bg-purple-500/5' : 'text-[var(--color-primary)] border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5'}`}>
                    {connectionParams?.ontology ? 'KG' : 'SQL'}
                 </div>
                 <div className="absolute top-8 left-0 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover/sql:opacity-100 pointer-events-none transition-opacity z-50 font-mono">
                   {config.sqlQuery}
                 </div>
               </div>
            )}

            {/* Search/Filter Toggle - Expanded on mobile if active, compressed otherwise */}
            <div className={`relative transition-all duration-300 ${isHovered || filterValue ? 'w-24 md:w-40 opacity-100' : 'w-8 opacity-0 pointer-events-none'}`}>
                <input 
                    type="text" 
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="סנן..."
                    className="w-full pr-8 pl-2 py-1.5 text-xs bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text-main)] transition-all shadow-inner"
                />
                <svg className="absolute right-2 top-2 w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            <button 
              onClick={() => onRemove(config.id)}
              className="p-2 md:p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 p-2 md:p-4 w-full min-h-[160px]">
         {renderChart()}
      </div>

      {/* Footer / Actions */}
      <div className="px-4 md:px-6 py-3 bg-[var(--color-surface-200)]/30 border-t border-[var(--color-border-glass)] flex justify-between items-center text-xs">
         <div className="flex gap-4 text-[var(--color-text-muted)] font-mono font-medium">
            {processedData.length > 0 && (
                <>
                    <span title="Total" className="flex items-center gap-1"><span className="text-[var(--color-primary)]">∑</span> {total.toLocaleString()}</span>
                    <span title="Average" className="flex items-center gap-1 hidden md:flex"><span className="text-[var(--color-secondary)]">Ø</span> {average.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                </>
            )}
         </div>
         
         <button 
            onClick={() => onDrillDown(config)}
            className="text-[var(--color-primary)] font-bold hover:bg-[var(--color-primary)]/10 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
         >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            נתונים
         </button>
      </div>
    </div>
  );
};
