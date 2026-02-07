import { DatabaseSchema, SchemaEntity, SchemaField, DataPoint } from '../types';

/**
 * Helper to construct headers with Basic Auth if credentials provided
 */
const getHeaders = (username?: string, password?: string, isMetadata = false): HeadersInit => {
  const headers: HeadersInit = {};
  
  // For GET requests, Content-Type is not needed and can trigger strict CORS preflight checks.
  // We only set Accept to ensure we get the desired format.
  if (!isMetadata) {
    headers['Accept'] = 'application/json'; 
  }

  if (username && password) {
    // Basic Auth Encoding
    const credentials = btoa(`${username}:${password}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }
  return headers;
};

/**
 * Parses OData $metadata XML into a JSON schema structure.
 */
const parseMetadata = (xmlText: string): DatabaseSchema => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const entities: SchemaEntity[] = [];

  // 1. Map EntityType names to their Fields
  const entityTypeMap = new Map<string, SchemaField[]>();
  const entityTypes = xmlDoc.getElementsByTagName("EntityType");
  
  for (let i = 0; i < entityTypes.length; i++) {
    const et = entityTypes[i];
    const name = et.getAttribute("Name");
    if (!name) continue;

    const fields: SchemaField[] = [];
    const properties = et.getElementsByTagName("Property");
    
    for (let j = 0; j < properties.length; j++) {
      const prop = properties[j];
      fields.push({
        name: prop.getAttribute("Name") || "Unknown",
        type: prop.getAttribute("Type") || "Edm.String"
      });
    }
    entityTypeMap.set(name, fields);
  }

  // 2. Map EntitySets to EntityTypes
  const entitySets = xmlDoc.getElementsByTagName("EntitySet");
  
  if (entitySets.length > 0) {
    for (let i = 0; i < entitySets.length; i++) {
      const es = entitySets[i];
      const name = es.getAttribute("Name");
      const entityTypeFull = es.getAttribute("EntityType");
      
      if (!name || !entityTypeFull) continue;

      const entityTypeName = entityTypeFull.split('.').pop();
      
      if (entityTypeName && entityTypeMap.has(entityTypeName)) {
        entities.push({
          name: name,
          fields: entityTypeMap.get(entityTypeName)!
        });
      }
    }
  } else {
    entityTypeMap.forEach((fields, name) => {
      entities.push({ name, fields });
    });
  }

  return { entities };
};

/**
 * Fetches the metadata from the OData service.
 */
export const fetchServiceSchema = async (baseUrl: string, username?: string, password?: string): Promise<DatabaseSchema> => {
  const cleanUrl = baseUrl.trim().replace(/\/$/, "");
  const metadataUrl = `${cleanUrl}/$metadata`;

  try {
    const response = await fetch(metadataUrl, {
      headers: getHeaders(username, password, true)
    });
    
    if (!response.ok) {
       if (response.status === 401 || response.status === 403) {
         throw new Error("שגיאת הרשאה: בדוק את שם המשתמש והסיסמא.");
       }
       throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    
    const text = await response.text();
    return parseMetadata(text);
  } catch (error: any) {
    console.error("Metadata fetch error:", error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("שגיאת תקשורת (CORS) או שהשרת לא זמין. וודא שהכתובת תקינה ושהשרת מאפשר גישה מדפדפן.");
    }
    throw new Error(error.message || "לא ניתן להתחבר ל-API.");
  }
};

/**
 * Executes a specific OData query against the base URL.
 */
export const executeODataQuery = async (baseUrl: string, queryPath: string, username?: string, password?: string): Promise<DataPoint[]> => {
  const cleanUrl = baseUrl.trim().replace(/\/$/, "");
  const url = `${cleanUrl}${queryPath.startsWith('/') ? '' : '/'}${queryPath}`;
  
  try {
    const response = await fetch(url, {
      headers: getHeaders(username, password)
    });

    if (!response.ok) {
       throw new Error(`OData Error: ${response.statusText} (URL: ${url})`);
    }
    const json = await response.json();
    
    if (json.value && Array.isArray(json.value)) {
      return json.value;
    }
    return Array.isArray(json) ? json : [];
  } catch (error: any) {
    console.error("Query execution error:", error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("שגיאת תקשורת (CORS).");
    }
    throw error;
  }
};

/**
 * Fetches the total count of records for a specific entity using $count=true
 */
export const fetchEntityCount = async (baseUrl: string, entityName: string, username?: string, password?: string): Promise<number> => {
  const cleanUrl = baseUrl.trim().replace(/\/$/, "");
  const url = `${cleanUrl}/${entityName}?$top=0&$count=true`;
  
  try {
    const response = await fetch(url, {
      headers: getHeaders(username, password)
    });
    if (!response.ok) return 0;
    const json = await response.json();
    
    if (typeof json['@odata.count'] === 'number') {
      return json['@odata.count'];
    }
    return 0;
  } catch (e) {
    return 0;
  }
};