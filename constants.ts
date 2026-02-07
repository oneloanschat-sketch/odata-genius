import { DatabaseSchema, ChartType } from './types';

// This schema helps the AI understand what data is available to query.
export const MOCK_SCHEMA: DatabaseSchema = {
  entities: [
    {
      name: 'Orders',
      fields: [
        { name: 'OrderID', type: 'number' },
        { name: 'CustomerName', type: 'string' },
        { name: 'OrderDate', type: 'date' },
        { name: 'TotalAmount', type: 'number', description: 'The total value of the order in ILS' },
        { name: 'Region', type: 'string', description: 'Sales region (North, South, Center, etc.)' },
        { name: 'Status', type: 'string', description: 'Completed, Pending, Cancelled' }
      ]
    },
    {
      name: 'Products',
      fields: [
        { name: 'ProductID', type: 'number' },
        { name: 'ProductName', type: 'string' },
        { name: 'Category', type: 'string', description: 'Electronics, Furniture, Clothing' },
        { name: 'UnitPrice', type: 'number' },
        { name: 'StockLevel', type: 'number' }
      ]
    },
    {
      name: 'Employees',
      fields: [
        { name: 'EmployeeID', type: 'number' },
        { name: 'FullName', type: 'string' },
        { name: 'Department', type: 'string' },
        { name: 'SalesTarget', type: 'number' },
        { name: 'ActualSales', type: 'number' }
      ]
    }
  ]
};

export const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const SAMPLE_PROMPTS = [
  "תראה לי את סך המכירות לפי אזור בגרף עמודות",
  "מה התפלגות המלאי לפי קטגוריה?",
  "הצג לי את ביצועי המכירות של עובדים מול היעד שלהם",
  "מגמת מכירות לאורך זמן לפי תאריך הזמנה"
];