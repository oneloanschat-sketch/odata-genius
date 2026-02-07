import * as XLSX from 'xlsx';
import { DatabaseSchema, SchemaEntity, DataPoint } from '../types';

/**
 * Parses an Excel or CSV file and returns the raw data and inferred schema.
 */
export const parseFile = async (file: File): Promise<{ data: DataPoint[], schema: DatabaseSchema }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Assume first sheet is the main data
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<DataPoint>(sheet);
        
        if (jsonData.length === 0) {
          reject(new Error("הקובץ ריק או לא תקין"));
          return;
        }

        // Infer Schema from the first few rows
        const fields = Object.keys(jsonData[0]).map(key => {
            // Simple type inference
            const val = jsonData[0][key];
            let type = 'Edm.String';
            if (typeof val === 'number') type = 'Edm.Double';
            if (val instanceof Date) type = 'Edm.DateTimeOffset';
            if (typeof val === 'boolean') type = 'Edm.Boolean';
            
            return { name: key, type };
        });

        // Create a schema that mimics OData structure
        // We treat the file as a single EntitySet named "Sheet1" (or sanitized filename)
        const entityName = "Data"; 
        
        const schema: DatabaseSchema = {
            entities: [{
                name: entityName,
                fields: fields
            }]
        };

        resolve({ data: jsonData, schema });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

/**
 * Executes a "Mock" OData query against local JSON data.
 * Supports basic $filter, $orderby, $top, $select.
 * DOES NOT support complex $apply/groupby (user receives raw data).
 */
export const executeLocalQuery = (data: DataPoint[], odataQuery: string): DataPoint[] => {
  let result = [...data];
  
  // 1. Parse Query Parameters
  const params = new URLSearchParams(odataQuery.split('?')[1]);
  
  // 2. Filter ($filter)
  const filter = params.get('$filter');
  if (filter) {
    // Very basic parser for: Field eq 'Value' / Field gt 100
    // Warning: insecure eval-like behavior, suitable for local demo only.
    result = result.filter(row => {
        try {
            // Replace OData operators with JS operators
            let jsCondition = filter
                .replace(/ eq /g, ' == ')
                .replace(/ ne /g, ' != ')
                .replace(/ gt /g, ' > ')
                .replace(/ lt /g, ' < ')
                .replace(/ ge /g, ' >= ')
                .replace(/ le /g, ' <= ')
                .replace(/ and /g, ' && ')
                .replace(/ or /g, ' || ');
            
            // Handle string quotes - ensure they match keys in row
            // Simple approach: Iterate keys and replace "Key" with "row['Key']" in the string
            // This is fragile but works for simple demos.
            Object.keys(row).forEach(key => {
                // Regex to find the key not surrounded by quotes
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                // Check if key is actually in the filter string
                if (jsCondition.match(regex)) {
                     // Check if value is string and needs quotes? 
                     // Usually OData passes strings as 'value'.
                     // We just replace Key with row.Key access
                     // We need to be careful not to replace inside string literals.
                     
                     // Safer simple hack:
                     const val = row[key];
                     const valStr = typeof val === 'string' ? `'${val}'` : val;
                     jsCondition = jsCondition.replace(new RegExp(`\\b${key}\\b`, 'g'), String(valStr));
                }
            });

            // If the condition still contains field names that weren't replaced (maybe nulls), 
            // this eval might fail. 
            // Improved strategy: Use Function constructor with 'row' scope? 
            // Let's rely on a simpler manual check for single condition if complex fail.
            
            // fallback for single condition: "Region eq 'North'"
            const parts = filter.split(' ');
            if (parts.length === 3) {
                const [key, op, valRaw] = parts;
                const val = valRaw.replace(/'/g, ""); // remove quotes
                const rowVal = row[key];
                
                if (op === 'eq') return String(rowVal) == val;
                if (op === 'ne') return String(rowVal) != val;
                if (op === 'gt') return Number(rowVal) > Number(val);
                if (op === 'lt') return Number(rowVal) < Number(val);
            }
            
            return true; // Default keep if complex
        } catch (e) {
            return true; 
        }
    });
  }

  // 3. Sort ($orderby)
  const orderby = params.get('$orderby');
  if (orderby) {
      const parts = orderby.split(' ');
      const key = parts[0];
      const dir = parts[1] === 'desc' ? -1 : 1;
      
      result.sort((a, b) => {
          if (a[key] < b[key]) return -1 * dir;
          if (a[key] > b[key]) return 1 * dir;
          return 0;
      });
  }

  // 4. Select ($select) - Project fields
  const select = params.get('$select');
  if (select) {
      const keys = select.split(',').map(s => s.trim());
      result = result.map(row => {
          const newRow: any = {};
          keys.forEach(k => {
              if (row[k] !== undefined) newRow[k] = row[k];
          });
          return newRow;
      });
  }

  // 5. Top ($top)
  const top = params.get('$top');
  if (top) {
      result = result.slice(0, Number(top));
  }

  return result;
};