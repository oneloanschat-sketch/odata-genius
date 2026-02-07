
import { GoogleGenAI, Type } from "@google/genai";
import { DashboardWidgetConfig, ChartType, DatabaseSchema, DataPoint, AnalysisResult } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

// Model Configuration
const MODEL_PRO = "gemini-3-pro-preview";
const MODEL_FLASH = "gemini-3-flash-preview";

// Helper to handle API calls with specific error handling for quotas
const safeGenerateContent = async (params: any, modelId: string) => {
    const ai = getAiClient();
    try {
        return await ai.models.generateContent({
            model: modelId,
            ...params
        });
    } catch (error: any) {
        console.error(`Gemini API Error (${modelId}):`, JSON.stringify(error, null, 2));
        
        const isQuotaError = 
            error.status === 429 || 
            error.code === 429 || 
            (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED'))) ||
            (error.error && error.error.code === 429);

        if (isQuotaError) {
             throw new Error("QUOTA_EXCEEDED");
        }
        throw error;
    }
};

// Helper to ensure OData Query is valid URL path
const fixODataQuery = (config: any): any => {
  if (config.sqlQuery) return config; // Skip for SQL

  let query = config.odataQuery?.trim() || "";
  const entity = config.entity?.trim();

  if (!query || !entity) return config;

  // Case 1: Query starts with $ or ? (e.g. $apply=... or ?filter=...)
  // We need to prepend /Entity? (or /Entity if ? is present)
  if (query.startsWith('$')) {
    config.odataQuery = `/${entity}?${query}`;
    return config;
  }
  if (query.startsWith('?')) {
    config.odataQuery = `/${entity}${query}`;
    return config;
  }

  // Case 2: Query starts with the Entity Name but missing leading slash
  // e.g. "Orders?$select..."
  if (!query.startsWith('/')) {
     if (query.toLowerCase().startsWith(entity.toLowerCase())) {
         config.odataQuery = `/${query}`;
     } else {
         // Case 3: Random string that doesn't look like a path, assume it's parameters
         config.odataQuery = `/${entity}?${query}`;
     }
  }

  // Case 4: Query is just "/Orders" (no params), ensure it's valid
  if (query === `/${entity}`) {
      return config;
  }
  
  return config;
};

export const generateDashboardConfig = async (
  userPrompt: string, 
  schema: DatabaseSchema,
  mode: 'odata' | 'file' | 'sql' | 'timbr' = 'odata'
): Promise<DashboardWidgetConfig> => {
  const schemaContext = JSON.stringify(schema);
  
  let systemInstruction = '';

  if (mode === 'sql') {
    systemInstruction = `
      You are an expert BigQuery SQL analyst.
      Translate the user's Hebrew request into a GoogleSQL (Standard SQL) query.
      
      Schema: ${schemaContext}

      Rules:
      1. Write a valid SELECT statement.
      2. Use simple aggregations (SUM, COUNT, AVG) if needed.
      3. ALWAYS LIMIT results (LIMIT 100).
      4. Group by relevant columns if using aggregations.
      5. Identify the main table name as 'entity'.
    `;
  } else if (mode === 'timbr') {
    systemInstruction = `
      You are an expert Semantic SQL Analyst using Timbr.ai.
      Your goal is to query a Knowledge Graph (Ontology).
      
      Schema (Concepts & Relationships): ${schemaContext}
      
      Rules:
      1. Write a VALID Timbr Semantic SQL query.
      2. Utilize Relationships! You can traverse graphs using dot notation. 
         Example: 'SELECT customer.name, SUM(customer.orders.amount) FROM dt_concepts.customer GROUP BY 1'.
         Do NOT use JOINs unless necessary. Use the relationship properties defined in schema.
      3. Concepts are usually prefixed with 'dt_concepts.'.
      4. Return the query in 'sqlQuery' field.
      5. Identify the main Concept name as 'entity'.
      6. Translate the user request from Hebrew.
    `;
  } else {
    // OData Mode
    systemInstruction = `
      You are an expert OData analyst.
      Your goal is to translate a user's natural language request (in Hebrew) into a configuration object for a dashboard widget.
      
      Current OData Schema (Entities and Fields):
      ${schemaContext}
      
      Rules:
      1. Create a VALID OData v4 query string. 
         - CRITICAL: Do NOT use $apply, aggregate, or groupby. Most OData services do not support them and return 400 Bad Request.
         - INSTEAD: Fetch the raw data using $select, $filter, $orderby.
         - LIMIT: Always use $top to limit results (e.g., $top=100) to prevent performance issues.
         - The Frontend will handle the aggregation (sum/count/average) of the raw data.
         - Example: To show "Sales by Country", query "/Orders?$select=ShipCountry,Freight&$top=100". Do NOT group by ShipCountry in the query.
         - Example: For KPI "Total Sales", query "/Orders?$select=Freight&$top=500". The frontend will sum it.
         - CRITICAL: The 'odataQuery' MUST start with the Entity Set name. Example: "/Orders?..."
      2. Determine the best chart type.
      3. Identify 'entity' (the main EntitySet name being queried, e.g., Orders).
      4. Return JSON.
    `;
  }

  try {
    const response = await safeGenerateContent({
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 1024 }, 
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Title in Hebrew" },
            description: { type: Type.STRING, description: "Short description in Hebrew" },
            chartType: { type: Type.STRING, enum: [ChartType.BAR, ChartType.LINE, ChartType.PIE, ChartType.AREA, ChartType.KPICARD] },
            odataQuery: { type: Type.STRING, description: "For OData: Full path starting with /EntityName. For SQL/Timbr: Leave empty." },
            sqlQuery: { type: Type.STRING, description: "For SQL/Timbr Mode: The SELECT query. For OData: Leave empty." },
            xAxisKey: { type: Type.STRING, description: "JSON key for X Axis" },
            dataKey: { type: Type.STRING, description: "JSON key for Y Axis" },
            entity: { type: Type.STRING, description: "The EntitySet/Table/Concept name" }
          },
          required: ["title", "description", "chartType", "xAxisKey", "dataKey", "entity"],
        }
      }
    }, MODEL_FLASH);

    if (!response.text) throw new Error("No response from AI");
    let result = JSON.parse(response.text);
    
    // Apply fix to ensure valid URL only for OData
    if (mode === 'odata' || mode === 'file') {
        result = fixODataQuery(result);
    }

    return {
      id: crypto.randomUUID(),
      ...result,
      alerts: []
    };
  } catch (error: any) {
     if (error.message === "QUOTA_EXCEEDED") {
       throw new Error("מכסת השימוש ב-AI הגיעה לקצה (שגיאה 429). אנא נסה שוב בעוד דקה.");
     }
     throw error;
  }
};

export const suggestDashboards = async (
    schema: DatabaseSchema, 
    mode: 'odata' | 'file' | 'sql' | 'timbr' = 'odata'
): Promise<DashboardWidgetConfig[]> => {
  const schemaContext = JSON.stringify(schema);

  let prompt = '';
  
  if (mode === 'sql') {
    prompt = `
      Based on the schema, generate 4 dashboard widgets using BigQuery SQL.
      Requirements: 2 KPIs, 2 Charts. Use 'sqlQuery' field. Hebrew titles.
      Schema: ${schemaContext}
    `;
  } else if (mode === 'timbr') {
    prompt = `
      Based on the Knowledge Graph Schema, generate 4 dashboard widgets using Timbr Semantic SQL.
      Requirements:
      1. Leverage graph relationships (e.g. concept.relationship.property).
      2. 2 KPIs, 2 Charts.
      3. Use 'sqlQuery'.
      4. Hebrew titles.
      Schema: ${schemaContext}
    `;
  } else {
    prompt = `
      Based on the provided OData Schema, generate a comprehensive dashboard structure with 4 distinct widgets.
      Requirements:
      1. Exactly 2 'kpi', 2 'chart' widgets.
      2. Do NOT use $apply or aggregate. Query RAW data.
      3. Use Hebrew for titles.
      Schema: ${schemaContext}
    `;
  }

  try {
    // Use Flash for suggestions
    const response = await safeGenerateContent({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 2048 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  chartType: { type: Type.STRING, enum: [ChartType.BAR, ChartType.LINE, ChartType.PIE, ChartType.AREA, ChartType.KPICARD] },
                  odataQuery: { type: Type.STRING, description: "For OData" },
                  sqlQuery: { type: Type.STRING, description: "For SQL/Timbr" },
                  xAxisKey: { type: Type.STRING },
                  dataKey: { type: Type.STRING },
                  entity: { type: Type.STRING }
                },
                required: ["title", "description", "chartType", "xAxisKey", "dataKey", "entity"]
              }
            }
          }
        }
      }
    }, MODEL_FLASH);

    if (!response.text) throw new Error("No response");
    const result = JSON.parse(response.text);
    
    return result.suggestions.map((s: any) => {
      let final = s;
      if (mode === 'odata' || mode === 'file') {
          final = fixODataQuery(s);
      }
      return {
        id: crypto.randomUUID(),
        ...final,
        alerts: []
      };
    });
  } catch (error: any) {
    if (error.message === "QUOTA_EXCEEDED") {
      throw new Error("מכסת השימוש ב-AI הגיעה לקצה (שגיאה 429). אנא נסה שוב בעוד דקה.");
    }
    throw error;
  }
};

/**
 * Analyzes raw data sample and schema to generate structured visual insights (KPIs, Charts, Findings).
 */
export const generateAdvancedInsights = async (schema: DatabaseSchema, dataSample: DataPoint[], sourceEntity: string): Promise<AnalysisResult> => {
  
  // Prepare context
  const schemaStr = JSON.stringify(schema);
  const dataStr = JSON.stringify(dataSample.slice(0, 50)); // Limit to 50 rows to save tokens

  const prompt = `
    You are a senior business intelligence analyst.
    Analyze the provided data sample and schema for the entity: "${sourceEntity}".
    
    Generate a structured analysis report in JSON format containing:
    1. 'summary': A brief executive summary in Hebrew (2 sentences).
    2. 'metrics': 3-4 Key Performance Indicators (KPIs) derived from the data (e.g., Total Sales, Avg Price).
    3. 'charts': 2 visual charts that show interesting trends or distributions based on the sample data.
    4. 'findings': 3 distinct business anomalies or insights, classified by severity.

    Ensure all text fields (titles, descriptions, labels) are in HEBREW.
    
    Schema: ${schemaStr}
    Data Sample: ${dataStr}
  `;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        metrics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              value: { type: Type.STRING },
              change: { type: Type.STRING, description: "e.g. +12% or 'Stable'" },
              trend: { type: Type.STRING, enum: ['up', 'down', 'neutral'] }
            },
            required: ['label', 'value', 'trend']
          }
        },
        charts: {
           type: Type.ARRAY,
           items: {
             type: Type.OBJECT,
             properties: {
               title: { type: Type.STRING },
               type: { type: Type.STRING, enum: ['bar', 'line', 'pie'] },
               description: { type: Type.STRING },
               data: {
                 type: Type.ARRAY,
                 items: {
                   type: Type.OBJECT,
                   properties: {
                     name: { type: Type.STRING },
                     value: { type: Type.NUMBER }
                   },
                   required: ['name', 'value']
                 }
               }
             },
             required: ['title', 'type', 'data']
           }
        },
        findings: {
          type: Type.ARRAY,
          items: {
             type: Type.OBJECT,
             properties: {
               title: { type: Type.STRING },
               description: { type: Type.STRING },
               severity: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
             },
             required: ['title', 'description', 'severity']
          }
        }
      },
      required: ['summary', 'metrics', 'charts', 'findings']
    }
  };

  let response;

  try {
    // 1. Use FLASH directly to avoid 429 quota issues with PRO
    response = await safeGenerateContent({
      contents: prompt,
      config: {
        ...config,
        thinkingConfig: { thinkingBudget: 2048 }
      }
    }, MODEL_FLASH);

  } catch (error: any) {
    if (error.message === "QUOTA_EXCEEDED") {
         throw new Error("מכסת השימוש ב-AI הגיעה לקצה (שגיאה 429). אנא נסה שוב בעוד דקה.");
    }
    throw error;
  }

  if (!response?.text) throw new Error("Failed to generate analysis");
  
  const parsed = JSON.parse(response.text);

  // Return with metadata
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sourceEntity: sourceEntity,
    ...parsed
  };
};
