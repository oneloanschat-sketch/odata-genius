import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { DashboardWidgetConfig, ChartType, DataPoint, AlertConfig } from '../types';
import { executeODataQuery } from '../services/odataService';
import { executeLocalQuery } from '../services/fileService';
import { COLORS } from '../constants';

interface WidgetCardProps {
  config: DashboardWidgetConfig;
  baseUrl: string;
  username?: string;
  password?: string;
  onRemove: (id: string) => void;
  onUpdate: (id: string, newConfig: Partial<DashboardWidgetConfig>) => void;
  onDrillDown: (config: DashboardWidgetConfig) => void;
  _localDataRef?: DataPoint[];
}

export const WidgetCard: React.FC<WidgetCardProps> = ({ config, baseUrl, username, password, onRemove, onUpdate, onDrillDown, _localDataRef }) => {
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
        
        if (baseUrl === 'LOCAL_FILE_MODE') {
             if (_localDataRef) {
                 result = executeLocalQuery(_localDataRef, config.odataQuery);
             }
        } else {
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
  }, [config.odataQuery, baseUrl, username, password, _localDataRef]);

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
        const groupedMap = new Map<string, number>();
        let hasDuplicates = false;
        const keySet = new Set<string>();

        for (const item of result) {
            const key = String(item[xKey]);
            if (keySet.has(key)) {
                hasDuplicates = true;
                break;
            }
            keySet.add(key);
        }

        if (hasDuplicates) {
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

  // Render Charts
  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[180px]">
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
        <div className="flex-1 flex flex-col items-center justify-center min-h-[180px] text-[var(--color-text-muted)] border border-dashed border-[var(--color-border-glass)] rounded-lg m-2 bg-white/5">
           <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           <span className="text-sm font-medium">אין נתונים להצגה</span>
        </div>
      );
    }

    const commonTooltipStyle = { 
        backgroundColor: 'var(--color-surface-200)', 
        borderRadius: '8px', 
        border: '1px solid var(--color-border-glass)', 
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', 
        color: 'var(--color-text-main)',
        zIndex: 50
    };

    switch (config.chartType) {
      case ChartType.KPICARD:
        return null;
        
      case ChartType.LINE:
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <LineChart data={processedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-glass)" />
              <XAxis dataKey={xKey} stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={commonTooltipStyle} itemStyle={{ color: 'var(--color-text-main)', fontWeight: 600 }} />
              <Line type="monotone" dataKey={mainKey} stroke={COLORS[0]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'var(--color-surface-100)' }} activeDot={{ r: 7 }} animationDuration={1000} />
            </LineChart>
          </ResponsiveContainer>
        );
      case ChartType.PIE:
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey={mainKey}
                nameKey={xKey}
                label={{ fill: 'var(--color-text-main)', fontSize: 11, fontWeight: 500 }}
                labelLine={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }}
              >
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--color-surface-100)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={commonTooltipStyle} itemStyle={{ color: 'var(--color-text-main)' }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: 'var(--color-text-muted)' }}/>
            </PieChart>
          </ResponsiveContainer>
        );
      case ChartType.AREA:
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <AreaChart data={processedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`color-${config.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-glass)" />
              <XAxis dataKey={xKey} stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={commonTooltipStyle} itemStyle={{ color: 'var(--color-text-main)' }} />
              <Area type="monotone" dataKey={mainKey} stroke={COLORS[1]} fillOpacity={1} fill={`url(#color-${config.id})`} strokeWidth={3} animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case ChartType.BAR:
      default:
        return (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <BarChart data={processedData} barSize={32} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-glass)" />
              <XAxis dataKey={xKey} stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip cursor={{fill: 'var(--color-border-glass)'}} contentStyle={commonTooltipStyle} itemStyle={{ color: 'var(--color-text-main)' }} />
              <Bar dataKey={mainKey} fill={COLORS[0]} radius={[6, 6, 0, 0]} animationDuration={1000}>
                 {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
             <div className="absolute -left-6 -top-6 w-24 h-24 bg-gradient-to-br from-[var(--color-primary)] to-transparent rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500 ease-in-out blur-xl"></div>
             <div className="absolute right-0 bottom-0 w-32 h-32 bg-gradient-to-tl from-[var(--color-secondary)] to-transparent rounded-full opacity-5 blur-2xl"></div>
             
             <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start w-full">
                   <div>
                       <h3 className="text-[var(--color-text-muted)] font-bold text-sm mb-1 uppercase tracking-wider">{config.title}</h3>
                       {loading ? (
                           <div className="h-10 w-32 bg-[var(--color-border-glass)] rounded animate-pulse mt-2"></div>
                       ) : (
                           <div className="text-4xl font-extrabold text-[var(--color-text-main)] tracking-tight drop-shadow-sm mt-1">
                               {total.toLocaleString()}
                           </div>
                       )}
                   </div>
                   {/* Remove Button for KPI */}
                   <button 
                      onClick={() => onRemove(config.id)}
                      className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                </div>
                
                <div className="flex items-end justify-between mt-4 border-t border-[var(--color-border-glass)] pt-3">
                    <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        <span>פעיל</span>
                    </div>
                    
                    <button 
                        onClick={() => onDrillDown(config)}
                        className="text-xs text-[var(--color-primary)] font-bold hover:underline opacity-80 hover:opacity-100 flex items-center gap-1"
                    >
                        נתונים גולמיים
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
      className="bg-[var(--color-surface-glass)]/50 backdrop-blur-md rounded-2xl shadow-sm border border-[var(--color-border-glass)] flex flex-col relative group transition-all duration-300 hover:shadow-xl overflow-hidden h-full"
      style={{ minHeight: '360px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="p-5 border-b border-[var(--color-border-glass)] flex justify-between items-start bg-gradient-to-l from-white/5 to-transparent">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-main)] tracking-tight">{config.title}</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-1">{config.description}</p>
        </div>
        
        {/* RTL: Flex-row works left-to-right by default, but dir=rtl flips it. 
            So first item is Rightmost, Last item is Leftmost.
            We want Actions on the Left. */}
        <div className="flex items-center gap-2">
            {/* Search/Filter Toggle */}
            <div className={`relative transition-all duration-300 ${isHovered || filterValue ? 'w-40 opacity-100' : 'w-8 opacity-0 pointer-events-none'}`}>
                <input 
                    type="text" 
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="סנן..."
                    className="w-full pr-8 pl-2 py-1.5 text-xs bg-[var(--color-surface-100)] border border-[var(--color-border-glass)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text-main)] transition-all"
                />
                <svg className="absolute right-2 top-2 w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            <button 
              onClick={() => onRemove(config.id)}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 p-4 w-full">
         {renderChart()}
      </div>

      {/* Footer / Actions */}
      <div className="px-5 py-3 bg-[var(--color-surface-200)]/30 border-t border-[var(--color-border-glass)] flex justify-between items-center text-xs">
         <div className="flex gap-4 text-[var(--color-text-muted)] font-mono">
            {processedData.length > 0 && (
                <>
                    <span title="Total">∑ {total.toLocaleString()}</span>
                    <span title="Average">Ø {average.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                </>
            )}
         </div>
         
         <button 
            onClick={() => onDrillDown(config)}
            className="text-[var(--color-primary)] font-bold hover:bg-[var(--color-primary)]/10 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
         >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            נתונים גולמיים
         </button>
      </div>
    </div>
  );
};