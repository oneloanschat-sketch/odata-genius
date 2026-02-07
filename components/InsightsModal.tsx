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
}

// Simple chart renderer for the modal
const InsightChartRenderer: React.FC<{ chart: InsightChartData }> = ({ chart }) => {
  if (chart.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
          <YAxis fontSize={10} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={3} dot={{r: 4}} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (chart.type === 'pie') {
     return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{fontSize: '10px'}}/>
        </PieChart>
      </ResponsiveContainer>
     );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chart.data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
        <YAxis fontSize={10} axisLine={false} tickLine={false} />
        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
        <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]}>
            {chart.data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const InsightsModal: React.FC<InsightsModalProps> = ({ isOpen, onClose, analysisResult, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
               </svg>
             </div>
             <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">דו"ח אנליזה חכם</h2>
                <p className="text-sm text-slate-500">נוצר על ידי Gemini 2.0 Pro • מבוסס על דגימת נתונים</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 relative">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl animate-pulse">✨</span>
                  </div>
                </div>
                <div>
                   <h3 className="text-xl font-bold text-slate-800">מבצע ניתוח מעמיק...</h3>
                   <p className="text-slate-500 max-w-md mx-auto mt-2">ה-AI סורק את הנתונים שלך, מחשב מדדים ומחפש תובנות עסקיות משמעותיות.</p>
                </div>
             </div>
          ) : analysisResult ? (
            <div className="space-y-8 pb-10">
               
               {/* 1. Executive Summary */}
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <span className="w-1 h-6 bg-blue-500 rounded-full block"></span>
                    סיכום מנהלים
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-lg">{analysisResult.summary}</p>
               </div>

               {/* 2. Key Metrics Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {analysisResult.metrics.map((metric, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                       <div className="text-slate-500 text-sm font-medium mb-1">{metric.label}</div>
                       <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-extrabold text-slate-900">{metric.value}</div>
                          {metric.change && (
                            <div className={`text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1
                              ${metric.trend === 'up' ? 'bg-green-100 text-green-700' : metric.trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}
                            `}>
                               {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '•'} {metric.change}
                            </div>
                          )}
                       </div>
                    </div>
                  ))}
               </div>

               {/* 3. Charts Row */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {analysisResult.charts.map((chart, idx) => (
                   <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                      <div className="mb-4">
                        <h4 className="font-bold text-slate-800 text-lg">{chart.title}</h4>
                        <p className="text-sm text-slate-400">{chart.description}</p>
                      </div>
                      <InsightChartRenderer chart={chart} />
                   </div>
                 ))}
               </div>

               {/* 4. Findings & Anomalies */}
               <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-purple-500 rounded-full block"></span>
                    ממצאים וחריגות
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysisResult.findings.map((finding, idx) => {
                      const borderColor = finding.severity === 'high' ? 'border-l-red-500' : finding.severity === 'medium' ? 'border-l-amber-500' : 'border-l-blue-500';
                      const bgColor = finding.severity === 'high' ? 'bg-red-50' : finding.severity === 'medium' ? 'bg-amber-50' : 'bg-blue-50';
                      
                      return (
                        <div key={idx} className={`bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 ${borderColor}`}>
                           <div className="flex justify-between items-start mb-2">
                              <h5 className="font-bold text-slate-800">{finding.title}</h5>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${bgColor} text-slate-700`}>
                                {finding.severity}
                              </span>
                           </div>
                           <p className="text-sm text-slate-600 leading-snug">
                             {finding.description}
                           </p>
                        </div>
                      );
                    })}
                  </div>
               </div>

            </div>
          ) : (
            <div className="text-center py-20 text-slate-400">
              לא נמצאו נתונים לניתוח
            </div>
          )}
        </div>
        
        {/* Footer */}
        {!loading && (
           <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
              <button onClick={onClose} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                סגור דוח
              </button>
           </div>
        )}
      </div>
    </div>
  );
};