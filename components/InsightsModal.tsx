import React from 'react';
import { AnalysisResult, InsightChartData } from '../types';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { COLORS } from '../constants';

interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisResult: AnalysisResult | null;
  loading: boolean;
  onSave?: (result: AnalysisResult) => void;
  isSaved?: boolean;
  onDrillDown?: (sourceEntity: string) => void;
}

// Simple chart renderer for the modal
const InsightChartRenderer: React.FC<{ chart: InsightChartData; onClick?: () => void }> = ({ chart, onClick }) => {
  const cursorStyle = onClick ? { cursor: 'pointer' } : {};
  const commonTooltipStyle = { 
    backgroundColor: 'var(--color-surface-200)', 
    borderRadius: '12px', 
    border: '1px solid var(--color-border-glass)', 
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', 
    color: 'var(--color-text-main)' 
  };

  if (chart.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chart.data} onClick={onClick} style={cursorStyle}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-glass)" />
          <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={10} axisLine={false} tickLine={false} dy={5} />
          <YAxis stroke="var(--color-text-muted)" fontSize={10} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={commonTooltipStyle} itemStyle={{ color: 'var(--color-text-main)' }} />
          <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={3} dot={{r: 4, fill: 'var(--color-surface-100)', strokeWidth: 2}} activeDot={{r: 6}} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === 'pie') {
     return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart onClick={onClick} style={cursorStyle}>
          <Pie
            data={chart.data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={5}
            dataKey="value"
          >
            {chart.data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--color-surface-100)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip contentStyle={commonTooltipStyle} />
          <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{fontSize: '10px', color: 'var(--color-text-muted)'}}/>
        </PieChart>
      </ResponsiveContainer>
     );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chart.data} onClick={onClick} style={cursorStyle}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-glass)" />
        <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={10} axisLine={false} tickLine={false} dy={5} />
        <YAxis stroke="var(--color-text-muted)" fontSize={10} axisLine={false} tickLine={false} />
        <Tooltip cursor={{fill: 'var(--color-border-glass)'}} contentStyle={commonTooltipStyle} itemStyle={{ color: 'var(--color-text-main)' }} />
        <Bar dataKey="value" fill={COLORS[0]} radius={[6, 6, 0, 0]}>
            {chart.data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const InsightsModal: React.FC<InsightsModalProps> = ({ 
  isOpen, onClose, analysisResult, loading, onSave, isSaved, onDrillDown 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--color-surface-100)] flex flex-col animate-in slide-in-from-bottom duration-500 font-[Heebo]">
        
        {/* Full Screen Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-[var(--color-surface-glass)] backdrop-blur-md border-b border-[var(--color-border-glass)] shadow-sm shrink-0 z-20">
          <div className="flex items-center gap-4">
             <button 
                onClick={onClose} 
                className="group flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-surface-200)] rounded-xl transition-all text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-180 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="font-medium text-sm">חזרה לדשבורד</span>
             </button>
             <div className="h-8 w-px bg-[var(--color-border-glass)] mx-2"></div>
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-secondary)] to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                   </svg>
                </div>
                <div>
                    <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">דו"ח אנליזה חכם</h2>
                    <p className="text-xs text-[var(--color-text-muted)] font-medium">
                      {analysisResult?.createdAt 
                        ? `נוצר ב- ${new Date(analysisResult.createdAt).toLocaleDateString('he-IL')}`
                        : 'נוצר על ידי Gemini 2.0 Pro'
                      }
                    </p>
                </div>
             </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {analysisResult && onSave && (
              <button
                onClick={() => onSave(analysisResult)}
                disabled={isSaved}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm
                   ${isSaved 
                      ? 'bg-green-500/10 text-green-600 border border-green-500/20 cursor-default' 
                      : 'bg-[var(--color-text-main)] text-[var(--color-surface-100)] hover:opacity-90 hover:shadow-lg'
                   }`}
              >
                 {isSaved ? (
                   <>
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     נשמר במועדפים
                   </>
                 ) : (
                   <>
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                     שמור דוח
                   </>
                 )}
              </button>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-auto bg-[var(--color-surface-100)] relative">
          
          {/* Subtle Mesh Background for Content */}
          <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[var(--color-secondary)]/20 via-transparent to-transparent"></div>

          <div className="max-w-7xl mx-auto p-6 md:p-10 relative z-10">
            {loading ? (
               <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-[var(--color-border-glass)] border-t-[var(--color-secondary)] rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl animate-pulse">✨</span>
                    </div>
                  </div>
                  <div className="animate-pulse">
                     <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">מבצע ניתוח מעמיק...</h3>
                     <p className="text-[var(--color-text-muted)] max-w-md mx-auto">ה-AI סורק את הנתונים שלך, מחשב מדדים ומחפש תובנות עסקיות משמעותיות.</p>
                  </div>
               </div>
            ) : analysisResult ? (
              <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                 
                 {/* 1. Executive Summary */}
                 <div className="bg-[var(--color-surface-glass)] backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-[var(--color-border-glass)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent rounded-bl-full -mr-20 -mt-20 opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                    <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-4 flex items-center gap-3 relative z-10">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </span>
                      סיכום מנהלים
                    </h3>
                    <p className="text-[var(--color-text-main)]/80 leading-relaxed text-lg relative z-10 max-w-4xl">{analysisResult.summary}</p>
                 </div>

                 {/* 2. Key Metrics Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {analysisResult.metrics.map((metric, idx) => (
                      <div key={idx} className="bg-[var(--color-surface-glass)] backdrop-blur-md p-6 rounded-3xl shadow-sm border border-[var(--color-border-glass)] flex flex-col justify-between hover:shadow-xl hover:border-[var(--color-primary)]/30 hover:-translate-y-1 transition-all duration-300">
                         <div className="text-[var(--color-text-muted)] text-sm font-medium mb-2 uppercase tracking-wider">{metric.label}</div>
                         <div className="flex items-end gap-3">
                            <div className="text-3xl font-black text-[var(--color-text-main)] tracking-tighter">{metric.value}</div>
                            {metric.change && (
                              <div className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 mb-1
                                ${metric.trend === 'up' ? 'bg-green-500/10 text-green-600' : metric.trend === 'down' ? 'bg-red-500/10 text-red-600' : 'bg-[var(--color-surface-200)] text-[var(--color-text-muted)]'}
                              `}>
                                 {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '•'} {metric.change}
                              </div>
                            )}
                         </div>
                      </div>
                    ))}
                 </div>

                 {/* 3. Charts Row */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {analysisResult.charts.map((chart, idx) => (
                     <div 
                        key={idx} 
                        className="bg-[var(--color-surface-glass)] backdrop-blur-md p-8 rounded-3xl shadow-sm border border-[var(--color-border-glass)] relative group transition-all hover:shadow-xl hover:border-[var(--color-primary)]/20"
                     >
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h4 className="font-bold text-[var(--color-text-main)] text-xl">{chart.title}</h4>
                                <p className="text-sm text-[var(--color-text-muted)] mt-1">{chart.description}</p>
                            </div>
                            {onDrillDown && (
                                <button 
                                    onClick={() => onDrillDown(analysisResult.sourceEntity)}
                                    className="opacity-0 group-hover:opacity-100 bg-[var(--color-surface-200)] text-[var(--color-primary)] p-2 rounded-lg text-xs font-bold transition-all hover:bg-[var(--color-primary)] hover:text-white flex items-center gap-1"
                                    title="Drill Down"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                    חקור נתונים
                                </button>
                            )}
                        </div>
                        <div className="h-[300px]">
                           <InsightChartRenderer 
                              chart={chart} 
                              onClick={() => onDrillDown && onDrillDown(analysisResult.sourceEntity)} 
                           />
                        </div>
                     </div>
                   ))}
                 </div>

                 {/* 4. Findings & Anomalies */}
                 <div>
                    <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-6 flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </span>
                      ממצאים וחריגות
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {analysisResult.findings.map((finding, idx) => {
                        const borderColor = finding.severity === 'high' ? 'border-t-red-500' : finding.severity === 'medium' ? 'border-t-orange-500' : 'border-t-blue-500';
                        const bgColor = finding.severity === 'high' ? 'bg-red-500/10' : finding.severity === 'medium' ? 'bg-orange-500/10' : 'bg-blue-500/10';
                        const iconColor = finding.severity === 'high' ? 'text-red-500' : finding.severity === 'medium' ? 'text-orange-500' : 'text-blue-500';
                        
                        return (
                          <div key={idx} className={`bg-[var(--color-surface-glass)] backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-[var(--color-border-glass)] border-t-4 ${borderColor} hover:shadow-lg transition-all hover:-translate-y-1`}>
                             <div className="flex justify-between items-start mb-3">
                                <h5 className="font-bold text-[var(--color-text-main)] text-lg">{finding.title}</h5>
                                <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-full ${bgColor} ${iconColor}`}>
                                  {finding.severity}
                                </span>
                             </div>
                             <p className="text-[var(--color-text-main)]/70 leading-relaxed text-sm">
                               {finding.description}
                             </p>
                          </div>
                        );
                      })}
                    </div>
                 </div>

              </div>
            ) : (
              <div className="text-center py-20 text-[var(--color-text-muted)]">
                לא נמצאו נתונים לניתוח
              </div>
            )}
          </div>
        </div>
    </div>
  );
};