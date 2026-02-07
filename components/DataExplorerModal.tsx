import React, { useEffect, useState } from 'react';
import { DatabaseSchema, SchemaEntity, DataPoint } from '../types';
import { executeODataQuery, fetchEntityCount } from '../services/odataService';
import { executeLocalQuery } from '../services/fileService';

interface DataExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: DatabaseSchema;
  baseUrl: string;
  username?: string;
  password?: string;
  localData?: DataPoint[];
}

export const DataExplorerModal: React.FC<DataExplorerModalProps> = ({ isOpen, onClose, schema, baseUrl, username, password, localData }) => {
  const [selectedEntity, setSelectedEntity] = useState<SchemaEntity | null>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'metadata'>('data');

  // Select first entity by default when opening
  useEffect(() => {
    if (isOpen && schema.entities.length > 0 && !selectedEntity) {
      setSelectedEntity(schema.entities[0]);
    }
  }, [isOpen, schema]);

  useEffect(() => {
    if (selectedEntity && isOpen) {
      const fetchData = async () => {
        setLoading(true);
        setData([]);
        setTotalCount(null);
        try {
          if (localData) {
            // Local Mode Execution
            const result = executeLocalQuery(localData, `/${selectedEntity.name}?$top=100`);
            setData(result);
            setTotalCount(localData.length);
          } else {
            // OData Mode Execution
            const result = await executeODataQuery(baseUrl, `/${selectedEntity.name}?$top=100`, username, password);
            setData(result);

            // Fetch count
            const count = await fetchEntityCount(baseUrl, selectedEntity.name, username, password);
            setTotalCount(count);
          }
        } catch (error) {
          console.error("Explorer fetch error", error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [selectedEntity, baseUrl, isOpen, username, password, localData]);

  if (!isOpen) return null;

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
                <h2 className="text-xl font-bold text-slate-800">סייר נתונים (Data Explorer)</h2>
                <p className="text-sm text-slate-500">צפייה בכל הטבלאות, המטא-דאטה והנתונים הגולמיים</p>
             </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar - Entities List */}
          <div className="w-72 bg-white border-l border-slate-200 overflow-y-auto p-4 flex-shrink-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">ישויות ({schema.entities.length})</h3>
            <ul className="space-y-1">
              {schema.entities.map((entity) => (
                <li key={entity.name}>
                  <button
                    onClick={() => setSelectedEntity(entity)}
                    className={`w-full text-right px-4 py-3 rounded-xl text-sm font-medium transition-all
                      ${selectedEntity?.name === entity.name 
                        ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                    `}
                  >
                    {entity.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
            
            {/* Toolbar / Tabs */}
            <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200/60">
               <div className="flex gap-6">
                 <button 
                   onClick={() => setActiveTab('data')}
                   className={`pb-1 text-sm font-bold transition-colors relative ${activeTab === 'data' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   נתונים
                   {activeTab === 'data' && <span className="absolute -bottom-5 right-0 w-full h-1 bg-blue-600 rounded-t-full"></span>}
                 </button>
                 <button 
                   onClick={() => setActiveTab('metadata')}
                   className={`pb-1 text-sm font-bold transition-colors relative ${activeTab === 'metadata' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   מבנה (Metadata)
                   {activeTab === 'metadata' && <span className="absolute -bottom-5 right-0 w-full h-1 bg-blue-600 rounded-t-full"></span>}
                 </button>
               </div>
               
               {selectedEntity && (
                 <div className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    {loading ? 'טוען ספירה...' : `סה"כ רשומות: ${totalCount !== null ? totalCount.toLocaleString() : 'לא ידוע'}`}
                 </div>
               )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8 relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                   <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-sm font-medium text-slate-500">טוען נתונים...</span>
                   </div>
                </div>
              ) : null}

              {activeTab === 'data' && (
                <>
                  {data.length === 0 && !loading ? (
                    <div className="flex items-center justify-center h-full text-slate-400">אין נתונים להצגה בטבלה זו</div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm text-right">
                          <thead className="bg-slate-50">
                            <tr>
                              {selectedEntity?.fields.map(field => (
                                <th key={field.name} className="px-6 py-4 font-bold text-slate-700 whitespace-nowrap bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                  {field.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-100">
                            {data.map((row, idx) => (
                              <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                {selectedEntity?.fields.map(field => (
                                  <td key={`${idx}-${field.name}`} className="px-6 py-3 text-slate-600 whitespace-nowrap">
                                    {row[field.name] !== undefined ? String(row[field.name]) : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {data.length > 0 && <div className="mt-4 text-xs text-slate-400 text-center">* מציג 100 רשומות ראשונות</div>}
                </>
              )}

              {activeTab === 'metadata' && selectedEntity && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {selectedEntity.fields.map((field) => (
                    <div key={field.name} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-2">
                         <div className="font-bold text-slate-700 text-lg group-hover:text-blue-700 transition-colors">{field.name}</div>
                         <div className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-wider">
                            {field.type}
                         </div>
                      </div>
                      {field.description ? (
                         <p className="text-sm text-slate-500 mt-2 leading-relaxed">{field.description}</p>
                      ) : (
                         <p className="text-xs text-slate-300 italic mt-4">אין תיאור זמין</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
};