
import { DataPoint } from '../types';

/**
 * Simulates executing a SQL query against BigQuery.
 * In a real app, this would call a backend proxy that holds the Service Account credentials.
 */
export const executeMockSqlQuery = async (query: string): Promise<DataPoint[]> => {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));

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
