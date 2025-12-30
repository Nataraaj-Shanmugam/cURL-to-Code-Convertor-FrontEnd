import type { ParsedCurl } from "@/types/curl";

/**
 * Detect data format from parsed cURL data with comprehensive checks
 */
export function detectDataFormat(parsedData: ParsedCurl): "json" | "xml" | "both" {
  const headers = parsedData.headers || {};
  const data = parsedData.data;
  const rawData = parsedData.raw_data;
  
  let hasJsonIndicator = false;
  let hasXmlIndicator = false;

  // 1. Check Content-Type header (highest priority)
  const contentType = findHeaderValue(headers, 'content-type');
  if (contentType) {
    if (isJsonContentType(contentType)) {
      hasJsonIndicator = true;
    }
    if (isXmlContentType(contentType)) {
      hasXmlIndicator = true;
    }
  }

  // 2. Check request body content
  const bodyContent = typeof data === 'string' ? data : rawData;
  if (bodyContent && typeof bodyContent === 'string') {
    const trimmed = bodyContent.trim();
    
    if (isXmlContent(trimmed)) {
      hasXmlIndicator = true;
    } else if (isJsonContent(trimmed)) {
      hasJsonIndicator = true;
    }
  }

  // 3. Check if data is already parsed as object (likely JSON)
  if (data && typeof data === 'object' && !rawData) {
    hasJsonIndicator = true;
  }

  // 4. Check Accept header (secondary indicator)
  const accept = findHeaderValue(headers, 'accept');
  if (accept) {
    const acceptJson = isJsonContentType(accept);
    const acceptXml = isXmlContentType(accept);
    
    // Accept header provides additional context
    if (acceptJson && !hasJsonIndicator) {
      hasJsonIndicator = true;
    }
    if (acceptXml && !hasXmlIndicator) {
      hasXmlIndicator = true;
    }
  }

  // 5. Determine final format
  if (hasJsonIndicator && hasXmlIndicator) {
    return 'both';
  }
  if (hasXmlIndicator) {
    return 'xml';
  }
  if (hasJsonIndicator) {
    return 'json';
  }

  // Default: Try to intelligently guess
  return guessFormatFromContext(parsedData);
}

/**
 * Find header value case-insensitively
 */
function findHeaderValue(headers: Record<string, string>, headerName: string): string | undefined {
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === headerName.toLowerCase()
  );
  return entry?.[1]?.toLowerCase();
}

/**
 * Check if content type indicates JSON
 */
function isJsonContentType(contentType: string): boolean {
  const jsonTypes = [
    'application/json',
    'application/vnd.api+json',
    'application/ld+json',
    'text/json'
  ];
  return jsonTypes.some(type => contentType.includes(type));
}

/**
 * Check if content type indicates XML
 */
function isXmlContentType(contentType: string): boolean {
  const xmlTypes = [
    'application/xml',
    'text/xml',
    'application/soap+xml',
    'application/xhtml+xml',
    'application/rss+xml',
    'application/atom+xml'
  ];
  return xmlTypes.some(type => contentType.includes(type));
}

/**
 * Check if content is XML format
 */
function isXmlContent(content: string): boolean {
  const trimmed = content.trim();
  
  // Check for XML declaration
  if (trimmed.startsWith('<?xml')) {
    return true;
  }
  
  // Check for opening XML tag
  if (trimmed.startsWith('<')) {
    // Basic XML validation: must have closing tag or self-closing
    // and should not look like HTML
    const hasClosingTag = trimmed.includes('</') || trimmed.includes('/>');
    const looksLikeHtml = /^<!DOCTYPE html|^<html|^<head|^<body/i.test(trimmed);
    
    return hasClosingTag && !looksLikeHtml;
  }
  
  return false;
}

/**
 * Check if content is JSON format
 */
function isJsonContent(content: string): boolean {
  const trimmed = content.trim();
  
  // Check for JSON object or array
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      // If parsing fails, might still be JSON with variables/templates
      return true;
    }
  }
  
  return false;
}

/**
 * Guess format from additional context when direct indicators are absent
 */
function guessFormatFromContext(parsedData: ParsedCurl): "json" | "xml" {
  const url = parsedData.url?.toLowerCase() || '';
  const method = parsedData.method?.toUpperCase() || '';
  
  // URL path indicators
  if (url.includes('/xml') || url.includes('.xml')) {
    return 'xml';
  }
  if (url.includes('/json') || url.includes('.json') || url.includes('/api/')) {
    return 'json';
  }
  
  // SOAP endpoints typically use XML
  if (url.includes('soap') || url.includes('wsdl')) {
    return 'xml';
  }
  
  // REST APIs typically use JSON
  if (url.includes('/rest/') || url.includes('/api/v')) {
    return 'json';
  }
  
  // Check for other headers that might indicate format
  const headers = parsedData.headers || {};
  const soapAction = findHeaderValue(headers, 'soapaction');
  if (soapAction) {
    return 'xml';
  }
  
  // Default to JSON (most common for modern APIs)
  return 'json';
}

/**
 * Get user-friendly label for data format
 */
export function getDataFormatLabel(format: "json" | "xml" | "both"): string {
  const labels = {
    json: "JSON",
    xml: "XML",
    both: "JSON + XML"
  };
  return labels[format];
}

/**
 * Get description for data format
 */
export function getDataFormatDescription(format: "json" | "xml" | "both"): string {
  const descriptions = {
    json: "Includes Jackson annotations for JSON serialization",
    xml: "Includes JAXB annotations for XML binding",
    both: "Includes both Jackson (JSON) and JAXB (XML) annotations"
  };
  return descriptions[format];
}

/**
 * Get detailed detection info (useful for debugging/display)
 */
export function getFormatDetectionInfo(parsedData: ParsedCurl): {
  detectedFormat: "json" | "xml" | "both";
  confidence: "high" | "medium" | "low";
  indicators: string[];
} {
  const headers = parsedData.headers || {};
  const data = parsedData.data;
  const rawData = parsedData.raw_data;
  const indicators: string[] = [];
  let confidence: "high" | "medium" | "low" = "low";
  
  // Check Content-Type
  const contentType = findHeaderValue(headers, 'content-type');
  if (contentType) {
    if (isJsonContentType(contentType)) {
      indicators.push(`Content-Type: ${contentType} (JSON)`);
      confidence = "high";
    } else if (isXmlContentType(contentType)) {
      indicators.push(`Content-Type: ${contentType} (XML)`);
      confidence = "high";
    }
  }
  
  // Check body content
  const bodyContent = typeof data === 'string' ? data : rawData;
  if (bodyContent && typeof bodyContent === 'string') {
    const trimmed = bodyContent.trim();
    if (isXmlContent(trimmed)) {
      indicators.push("Request body contains XML content");
      if (confidence !== "high") confidence = "medium";
    } else if (isJsonContent(trimmed)) {
      indicators.push("Request body contains JSON content");
      if (confidence !== "high") confidence = "medium";
    }
  }
  
  // Check Accept header
  const accept = findHeaderValue(headers, 'accept');
  if (accept) {
    if (isJsonContentType(accept)) {
      indicators.push(`Accept: ${accept} (JSON)`);
    } else if (isXmlContentType(accept)) {
      indicators.push(`Accept: ${accept} (XML)`);
    }
  }
  
  const detectedFormat = detectDataFormat(parsedData);
  
  if (indicators.length === 0) {
    indicators.push("No explicit format indicators found, using default");
  }
  
  return {
    detectedFormat,
    confidence,
    indicators
  };
}