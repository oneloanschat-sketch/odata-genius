import React, { useEffect, useState } from 'react';
import { DashboardWidgetConfig, DataPoint } from '../types';
import { executeODataQuery } from '../services/odataService';

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DashboardWidgetConfig;
  baseUrl: string;
  username?: string;
  password?: string;
}

export const DrillDownModal: React.FC<DrillDownModalProps> = ({ isOpen, onClose, config, baseUrl, username, password }) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && config) {
      setLoading(true);
      const entityName = config.entity || config.odataQuery.split('?')[0].replace('/', '');
      const query = `/${entityName}?$top=50`;
      
      executeODataQuery(baseUrl, query, username, password)
        .then(res => setData(res))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, config, baseUrl, username, password]);

  if (!isOpen) return null;

  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-in slide-in-from-bottom duration-500">
      
      {/* Full Screen Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-200 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
             <button 
                onClick={onClose} 
                className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-800"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-180 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="font-medium text-sm">חזרה לדשבורד</span>
             </button>
             <div className="h-8 w-px bg-slate-200 mx-2"></div>
             <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  Drill Down: <span className="text-blue-600">{config.entity || 'Data View'}</span>
                </h2>
             </div>
          </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-white p-6">
        <div className="max-w-7xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : data.length === 0 ? (
            <p className="text-center text-slate-500 py-20">אין נתונים להצגה</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-right">
                {/* Fixed Sticky Header with Background */}
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {headers.map(h => (
                      <th key={h} className="px-6 py-4 font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider bg-slate-50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                      {headers.map(h => (
                        <td key={`${i}-${h}`} className="px-6 py-3 text-slate-700 whitespace-nowrap">
                          {String(row[h])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="max-w-7xl mx-auto mt-4 text-xs text-slate-400 flex justify-between px-2">
           <span>מציג עד 50 רשומות ראשונות</span>
           <span>מקור: {baseUrl}</span>
        </div>
      </div>
    </div>
  );
};