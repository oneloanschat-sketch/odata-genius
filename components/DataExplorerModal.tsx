
import React, { useEffect, useState } from 'react';
import { DatabaseSchema, SchemaEntity, DataPoint } from '../types';
import { executeODataQuery, fetchEntityCount } from '../services/odataService';
import { executeLocalQuery } from '../services/fileService';
import { executeMockSqlQuery } from '../services/mockSqlService';
import { executeMockTimbrQuery } from '../services/mockTimbrService';

interface DataExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: DatabaseSchema;
  baseUrl: string;
  username?: string;
  password?: string;
  localData?: DataPoint[];
  mode: 'odata' | 'file' | 'sql' | 'timbr';
}

export const DataExplorerModal: React.FC<DataExplorerModalProps> = ({ isOpen, onClose, schema, baseUrl, username, password, localData, mode }) => {
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
          if (mode === 'file' && localData) {
            // Local Mode Execution
            const result = executeLocalQuery(localData, `/${selectedEntity.name}?$top=100`);
            setData(result);
            setTotalCount(localData.length);
          } else if (mode === 'sql') {
             // SQL Mock Execution
             const result = await executeMockSqlQuery(`SELECT * FROM ${selectedEntity.name} LIMIT 100`);
             setData(result);
             setTotalCount(1000); // Mock count
          } else if (mode === 'timbr') {
             // Timbr Mock Execution
             const result = await executeMockTimbrQuery(`SELECT * FROM ${selectedEntity.name} LIMIT 100`);
             setData(result);
             setTotalCount(500); // Mock count
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
  }, [selectedEntity, baseUrl, isOpen, username, password, localData, mode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--color-surface-100)] flex flex-col animate-in slide-in-from-bottom duration-500 font-[Heebo]">
        
        {/* Full Screen Header */}
        <div className="flex justify-between items-center px-4 md:px-6 py-4 bg-[var(--color-surface-glass)] backdrop-blur-md border-b border-[var(--color-border-glass)] shadow-sm shrink-0 z-20">
          <div className="flex items-center gap-3 md:gap-4">
             <button 
                onClick={onClose} 
                className="group flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-surface-200)] rounded-xl transition-all text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-180 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="font-medium text-sm hidden md:inline">חזרה לדשבורד</span>
             </button>
             <div className="h-8 w-px bg-[var(--color-border-glass)] mx-2 hidden md:block"></div>
             <div>
                <h2 className="text-lg md:text-xl font-extrabold text-[var(--color-text-main)]">סייר נתונים</h2>
                <p className="text-xs md:text-sm text-[var(--color-text-muted)] hidden md:block">צפייה בכל הטבלאות, המטא-דאטה והנתונים הגולמיים</p>
             </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Sidebar - Entities List. On Mobile it becomes a top horizontal scroller */}
          <div className="w-full md:w-72 bg-[var(--color-surface-glass)] backdrop-blur-sm border-b md:border-b-0 md:border-l border-[var(--color-border-glass)] overflow-x-auto md:overflow-y-auto p-2 md:p-4 flex-shrink-0 flex md:block gap-2 no-scrollbar">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 md:mb-4 px-2 hidden md:block">ישויות ({schema.entities.length})</h3>
            <ul className="flex md:block gap-2 md:space-y-1">
              {schema.entities.map((entity) => (
                <li key={entity.name} className="flex-shrink-0">
                  <button
                    onClick={() => setSelectedEntity(entity)}
                    className={`w-auto md:w-full text-right px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                      ${selectedEntity?.name === entity.name 
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-primary)]/20' 
                        : 'text-[var(--color-text-muted)] bg-[var(--color-surface-200)] md:bg-transparent hover:bg-[var(--color-surface-200)] hover:text-[var(--color-text-main)]'}
                    `}
                  >
                    {entity.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface-100)] relative">
            
            {/* Toolbar / Tabs */}
            <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4 bg-[var(--color-surface-glass)] border-b border-[var(--color-border-glass)] shrink-0 z-10 overflow-x-auto">
               <div className="flex gap-6 md:gap-8">
                 <button 
                   onClick={() => setActiveTab('data')}
                   className={`pb-2 text-sm font-bold transition-all relative ${activeTab === 'data' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                 >
                   נתונים
                   {activeTab === 'data' && <span className="absolute -bottom-3.5 md:-bottom-4.5 right-0 w-full h-1 bg-[var(--color-primary)] rounded-t-full shadow-[0_-2px_8px_rgba(var(--color-primary),0.5)]"></span>}
                 </button>
                 <button 
                   onClick={() => setActiveTab('metadata')}
                   className={`pb-2 text-sm font-bold transition-all relative ${activeTab === 'metadata' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                 >
                   מבנה (Metadata)
                   {activeTab === 'metadata' && <span className="absolute -bottom-3.5 md:-bottom-4.5 right-0 w-full h-1 bg-[var(--color-primary)] rounded-t-full shadow-[0_-2px_8px_rgba(var(--color-primary),0.5)]"></span>}
                 </button>
               </div>
               
               {selectedEntity && (
                 <div className="text-[10px] md:text-xs font-mono text-[var(--color-text-main)] bg-[var(--color-surface-200)] px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-[var(--color-border-glass)] whitespace-nowrap">
                    {loading ? 'טוען ספירה...' : `סה"כ: ${totalCount !== null ? totalCount.toLocaleString() : '?'}`}
                 </div>
               )}
            </div>

            {/* Content Container - Ensure full height usage */}
            <div className="flex-1 overflow-hidden p-4 md:p-6 relative flex flex-col">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-100)]/70 backdrop-blur-sm z-20 rounded-2xl">
                   <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin h-10 w-10 text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-sm font-medium text-[var(--color-text-muted)]">טוען נתונים...</span>
                   </div>
                </div>
              )}

              {activeTab === 'data' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface-glass)] border border-[var(--color-border-glass)] rounded-2xl shadow-sm">
                  {data.length === 0 && !loading ? (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">אין נתונים להצגה בטבלה זו</div>
                  ) : (
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-[var(--color-border-glass)] text-sm text-right border-collapse">
                          <thead className="bg-[var(--color-surface-200)] sticky top-0 z-10 ring-1 ring-[var(--color-border-glass)]">
                            <tr>
                              {selectedEntity?.fields.map(field => (
                                <th key={field.name} className="px-4 py-3 md:px-6 md:py-4 font-bold text-[var(--color-text-muted)] whitespace-nowrap bg-[var(--color-surface-200)] border-b border-[var(--color-border-glass)]">
                                  {field.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border-glass)]">
                            {data.map((row, idx) => (
                              <tr key={idx} className="hover:bg-[var(--color-primary)]/5 transition-colors group">
                                {selectedEntity?.fields.map(field => (
                                  <td key={`${idx}-${field.name}`} className="px-4 py-2 md:px-6 md:py-3 text-[var(--color-text-main)] whitespace-nowrap group-hover:text-[var(--color-primary)] transition-colors">
                                    {row[field.name] !== undefined ? String(row[field.name]) : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                    </div>
                  )}
                  {data.length > 0 && <div className="p-2 border-t border-[var(--color-border-glass)] text-xs text-[var(--color-text-muted)] text-center bg-[var(--color-surface-200)]">* מציג 100 רשומות ראשונות</div>}
                </div>
              )}

              {activeTab === 'metadata' && selectedEntity && (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 pb-6">
                    {selectedEntity.fields.map((field) => (
                        <div key={field.name} className="bg-[var(--color-surface-glass)] backdrop-blur-md p-4 md:p-6 rounded-2xl border border-[var(--color-border-glass)] hover:border-[var(--color-primary)]/50 hover:shadow-lg transition-all group h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-[var(--color-text-main)] text-base md:text-lg group-hover:text-[var(--color-primary)] transition-colors">{field.name}</div>
                            <div className="text-[10px] font-mono text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded uppercase tracking-wider">
                                {field.type}
                            </div>
                        </div>
                        {field.description ? (
                            <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">{field.description}</p>
                        ) : (
                            <p className="text-xs text-[var(--color-text-muted)] italic mt-4 opacity-50">אין תיאור זמין</p>
                        )}
                        </div>
                    ))}
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
};
