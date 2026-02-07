
import { DataPoint } from '../types';

/**
 * Simulates executing a Semantic SQL query against a Timbr Knowledge Graph.
 */
export const executeMockTimbrQuery = async (query: string): Promise<DataPoint[]> => {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 1000));

  const lower = query.toLowerCase();

  // Logic to simulate graph traversal results
  
  // Example: SELECT customer.name, COUNT(orders.id) ...
  if (lower.includes('customer') && lower.includes('count')) {
    return [
      { name: 'Acme Corp', value: 150 },
      { name: 'Globex Inc', value: 89 },
      { name: 'Soylent Corp', value: 45 },
      { name: 'Initech', value: 210 },
      { name: 'Umbrella Corp', value: 320 }
    ];
  }

  // Example: SELECT products.category, AVG(orders.amount) ...
  if (lower.includes('category') || lower.includes('product')) {
     return [
       { name: 'Electronics', value: 450.50 },
       { name: 'Books', value: 120.20 },
       { name: 'Home', value: 340.00 },
       { name: 'Garden', value: 89.90 }
     ];
  }

  // Example: Graph relationship depth
  if (lower.includes('orders.amount')) {
     return [
        { name: 'Q1 2024', value: 1200000 },
        { name: 'Q2 2024', value: 1450000 },
        { name: 'Q3 2024', value: 1100000 },
        { name: 'Q4 2024', value: 1800000 }
     ];
  }
  
  // Default fallback data for visualization
  return [
     { name: 'Concept A', value: 500 },
     { name: 'Concept B', value: 300 },
     { name: 'Concept C', value: 800 },
     { name: 'Concept D', value: 200 }
  ];
};
