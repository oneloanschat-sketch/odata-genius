
import { DataPoint } from '../types';

/**
 * Simulates executing a SQL query against BigQuery.
 * 
 * --- REAL IMPLEMENTATION NOTE ---
 * Browsers cannot connect directly to BigQuery due to security and CORS.
 * You must use a backend proxy (Node.js/Python).
 * 
 * Example Backend Call:
 * 
 * export const executeRealSqlQuery = async (query: string, projectId: string, datasetId: string): Promise<DataPoint[]> => {
 *   const response = await fetch('https://YOUR-BACKEND-API.com/api/bigquery/execute', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ query, projectId, datasetId })
 *   });
 *   return await response.json();
 * };
 */
export const executeMockSqlQuery = async (query: string, projectId?: string, datasetId?: string): Promise<DataPoint[]> => {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));

  // Log to console to show we received the real credentials
  console.log(`[SQL Service] Executing on Project: ${projectId}, Dataset: ${datasetId}`);
  console.log(`[SQL Query]: ${query}`);

  const lower = query.toLowerCase();

  // Mock logic based on keywords
  if (lower.includes('count')) {
    return [{ value: Math.floor(Math.random() * 5000) + 1000 }];
  }

  if (lower.includes('sum')) {
     return [{ value: Math.floor(Math.random() * 500000) + 50000 }];
  }

  if (lower.includes('group by') || lower.includes('orders')) {
     if (lower.includes('country') || lower.includes('region')) {
        return [
            { name: 'Israel', value: 45000 },
            { name: 'USA', value: 120000 },
            { name: 'UK', value: 30000 },
            { name: 'Germany', value: 60000 }
        ];
     }
     if (lower.includes('date') || lower.includes('month')) {
        return [
            { name: '2024-01', value: 100 },
            { name: '2024-02', value: 120 },
            { name: '2024-03', value: 90 },
            { name: '2024-04', value: 150 }
        ];
     }
  }
  
  // Default fallback data for visualization
  return [
     { name: 'Category A', value: 100 },
     { name: 'Category B', value: 200 },
     { name: 'Category C', value: 150 },
     { name: 'Category D', value: 50 }
  ];
};
