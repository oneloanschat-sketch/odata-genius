
import React from 'react';
import { DashboardWidgetConfig, ChartType, DataPoint } from '../types';
import { WidgetCard } from './WidgetCard';

interface FuturisticBentoGridProps {
  widgets: DashboardWidgetConfig[];
  baseUrl: string;
  username?: string;
  password?: string;
  // Generic connection parameters for SQL/Timbr
  connectionParams?: { [key: string]: string };
  onRemove: (id: string) => void;
  onUpdate: (id: string, newConfig: Partial<DashboardWidgetConfig>) => void;
  onDrillDown: (config: DashboardWidgetConfig) => void;
  fileData?: DataPoint[];
}

export const FuturisticBentoGrid: React.FC<FuturisticBentoGridProps> = (props) => {
  return (
    <>
      <style>{`
        /* Container Queries Setup */
        .bento-container {
          container-type: inline-size;
          container-name: bento;
        }

        .bento-grid {
          display: grid;
          gap: 1.5rem;
          /* Default mobile layout */
          grid-template-columns: 1fr; 
          grid-auto-flow: dense;
        }

        /* Responsive Layout using Container Queries */
        @container bento (min-width: 600px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @container bento (min-width: 1200px) {
          .bento-grid {
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(auto-fill, minmax(220px, auto));
          }
          
          /* Spanning Logic for Bento Effect */
          .bento-item-chart {
            grid-column: span 2;
            grid-row: span 2;
          }
          
          .bento-item-kpi {
            grid-column: span 1;
            grid-row: span 1;
          }
        }

        /* Glassmorphism Card Style */
        .glass-card {
          background: var(--color-surface-glass);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--color-border-glass);
          box-shadow: var(--shadow-glass);
          border-radius: 1.5rem;
          /* Layout transition for smoother resizing */
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                      box-shadow 0.4s ease,
                      border-color 0.4s ease;
          overflow: hidden;
          position: relative;
        }

        /* Lighting effect on top edge */
        .glass-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(125deg, rgba(255,255,255,0.2) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.05) 100%);
          pointer-events: none;
          z-index: 1;
        }

        .glass-card:hover {
          transform: scale(1.02) translateY(-4px);
          border-color: var(--color-primary);
          box-shadow: 0 20px 40px -5px rgba(0,0,0,0.2), 0 0 20px -5px var(--color-primary);
          z-index: 10;
        }

        /* Typography Fluidity */
        .fluid-text-title {
          font-size: clamp(1rem, 0.8rem + 0.5vw, 1.5rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(to left, var(--color-text-main), var(--color-primary));
          -webkit-background-clip: text;
          color: transparent;
        }

        /* Subtle Fade-in and Slide-up Animation */
        @keyframes subtle-slide-up {
          0% { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          100% { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        .animate-enter {
          /* Using a spring-like bezier for a premium feel */
          animation: subtle-slide-up 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
        }
      `}</style>

      <div className="bento-container w-full p-2">
        {props.widgets.length === 0 ? (
           <div className="flex flex-col items-center justify-center min-h-[400px] glass-card animate-enter p-10 text-center border-dashed border-2 !border-[var(--color-border-glass)] !bg-transparent backdrop-blur-sm">
             <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center mb-6 shadow-lg shadow-[var(--color-primary)]/30">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
               </svg>
             </div>
             <h3 className="fluid-text-title mb-2 !text-3xl !text-[var(--color-text-main)]">הדשבורד העתידני שלך מוכן</h3>
             <p className="text-[var(--color-text-muted)] max-w-md mx-auto">
               הזן שאלה למעלה או לחץ על "הצע דשבורד אוטומטי" כדי להתחיל.
             </p>
           </div>
        ) : (
          <div className="bento-grid">
            {props.widgets.map((widget, index) => {
              const isKPI = widget.chartType === ChartType.KPICARD;
              const colClass = isKPI ? 'bento-item-kpi' : 'bento-item-chart';
              
              return (
                <div 
                  key={widget.id} 
                  className={`glass-card ${colClass} animate-enter`}
                  style={{ 
                    // Staggered delay for initial load
                    animationDelay: `${Math.min(index * 75, 800)}ms` 
                  }}
                >
                  <div className="h-full w-full relative z-10">
                    <WidgetCard 
                       config={widget} 
                       baseUrl={props.baseUrl} 
                       username={props.username}
                       password={props.password}
                       connectionParams={props.connectionParams}
                       onRemove={props.onRemove} 
                       onUpdate={props.onUpdate}
                       onDrillDown={props.onDrillDown}
                       _localDataRef={props.fileData}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
