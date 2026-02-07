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
      // Construct a query to get raw data for the entity. 
      // We take the base entity name and select top 50 records for drill down.
      // In a real scenario, we might want to pass specific filter context from the clicked chart point.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">
            Drill Down: {config.entity || 'Data View'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : data.length === 0 ? (
            <p className="text-center text-slate-500 py-10">אין נתונים להצגה</p>
          ) : (
            <table className="min-w-full text-xs text-right">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {headers.map(h => (
                    <th key={h} className="px-4 py-2 font-medium text-slate-500 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {headers.map(h => (
                      <td key={`${i}-${h}`} className="px-4 py-2 text-slate-700 whitespace-nowrap">
                        {String(row[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 border-t bg-slate-50 text-xs text-slate-400 flex justify-between">
           <span>מציג עד 50 רשומות ראשונות</span>
           <span>מקור: {baseUrl}</span>
        </div>
      </div>
    </div>
  );
};