import { DataPoint } from '../types';

/**
 * In a real app, this would perform a fetch request to an actual OData endpoint.
 * Here, we simulate the logic by parsing the query string loosely and generating realistic mock data.
 */
export const fetchODataData = async (query: string): Promise<DataPoint[]> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const lowerQuery = query.toLowerCase();
  
  // Logic to mock "Orders" related queries
  if (lowerQuery.includes('orders')) {
    
    // Group by Region
    if (lowerQuery.includes('region') || lowerQuery.includes('groupby((region))')) {
      return [
        { name: 'צפון', value: 150000 },
        { name: 'מרכז', value: 420000 },
        { name: 'דרום', value: 180000 },
        { name: 'ירושלים', value: 210000 },
        { name: 'שרון', value: 300000 },
      ];
    }

    // Group by Status
    if (lowerQuery.includes('status')) {
      return [
        { name: 'הושלם', value: 850 },
        { name: 'ממתין', value: 120 },
        { name: 'בוטל', value: 45 },
      ];
    }

    // Trend over time (OrderDate)
    if (lowerQuery.includes('orderdate') || lowerQuery.includes('date')) {
      return [
        { name: '01/2024', value: 45000 },
        { name: '02/2024', value: 52000 },
        { name: '03/2024', value: 48000 },
        { name: '04/2024', value: 61000 },
        { name: '05/2024', value: 59000 },
        { name: '06/2024', value: 72000 },
      ];
    }
  }

  // Logic to mock "Products" related queries
  if (lowerQuery.includes('products')) {
    // By Category
    if (lowerQuery.includes('category')) {
      return [
        { name: 'אלקטרוניקה', value: 1200 },
        { name: 'ריהוט', value: 450 },
        { name: 'ביגוד', value: 800 },
        { name: 'ספורט', value: 300 },
      ];
    }
     // Stock Levels
     if (lowerQuery.includes('stock')) {
       return [
         { name: 'מחשבים ניידים', value: 45 },
         { name: 'מסכים', value: 120 },
         { name: 'מקלדות', value: 300 },
         { name: 'עכברים', value: 450 },
       ];
     }
  }

  // Logic to mock "Employees" related queries
  if (lowerQuery.includes('employees')) {
    // Sales vs Target
    return [
      { name: 'דני', actual: 120000, target: 100000 },
      { name: 'שרה', actual: 95000, target: 100000 },
      { name: 'יוסי', actual: 140000, target: 120000 },
      { name: 'מיכל', actual: 110000, target: 110000 },
    ];
  }

  // Fallback random data if query isn't recognized
  return [
    { name: 'A', value: Math.floor(Math.random() * 100) },
    { name: 'B', value: Math.floor(Math.random() * 100) },
    { name: 'C', value: Math.floor(Math.random() * 100) },
  ];
};