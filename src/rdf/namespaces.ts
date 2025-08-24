/**
 * RDF Namespace management for GraphZep
 * Provides standardized URIs for Zep ontology and common RDF vocabularies
 */

export interface NamespaceMap {
  [prefix: string]: string;
}

export const ZEP_NAMESPACES: NamespaceMap = {
  // Zep-specific namespaces
  zep: 'http://graphzep.ai/ontology#',
  zepmem: 'http://graphzep.ai/memory#',
  zeptime: 'http://graphzep.ai/temporal#',
  zepent: 'http://graphzep.ai/entity#',
  
  // Standard RDF/OWL/RDFS namespaces
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  
  // Temporal and provenance
  time: 'http://www.w3.org/2006/time#',
  prov: 'http://www.w3.org/ns/prov#',
  
  // Schema.org for common entities
  schema: 'http://schema.org/',
  
  // FOAF for person/agent concepts
  foaf: 'http://xmlns.com/foaf/0.1/',
  
  // Dublin Core for metadata
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
};

export class NamespaceManager {
  private namespaces: NamespaceMap;
  
  constructor(customNamespaces?: NamespaceMap) {
    this.namespaces = { ...ZEP_NAMESPACES };
    if (customNamespaces) {
      this.namespaces = { ...this.namespaces, ...customNamespaces };
    }
  }
  
  /**
   * Expand a prefixed URI to full URI
   * @param prefixed - URI in prefix:localName format
   * @returns Full URI
   */
  expand(prefixed: string): string {
    const colonIndex = prefixed.indexOf(':');
    if (colonIndex === -1) {
      return prefixed; // Already a full URI
    }
    
    const prefix = prefixed.substring(0, colonIndex);
    const localName = prefixed.substring(colonIndex + 1);
    
    const namespace = this.namespaces[prefix];
    if (!namespace) {
      throw new Error(`Unknown namespace prefix: ${prefix}`);
    }
    
    return namespace + localName;
  }
  
  /**
   * Contract a full URI to prefixed form if possible
   * @param fullUri - Full URI
   * @returns Prefixed URI or original if no matching namespace
   */
  contract(fullUri: string): string {
    for (const [prefix, namespace] of Object.entries(this.namespaces)) {
      if (fullUri.startsWith(namespace)) {
        const localName = fullUri.substring(namespace.length);
        return `${prefix}:${localName}`;
      }
    }
    return fullUri; // Return original if no matching namespace
  }
  
  /**
   * Generate SPARQL prefix declarations
   * @param prefixesUsed - Optional array of prefixes to include, defaults to all
   * @returns SPARQL prefix declarations
   */
  getSparqlPrefixes(prefixesUsed?: string[]): string {
    const prefixes = prefixesUsed || Object.keys(this.namespaces);
    return prefixes
      .map(prefix => `PREFIX ${prefix}: <${this.namespaces[prefix]}>`)
      .join('\n');
  }
  
  /**
   * Generate Turtle prefix declarations
   * @param prefixesUsed - Optional array of prefixes to include, defaults to all
   * @returns Turtle prefix declarations
   */
  getTurtlePrefixes(prefixesUsed?: string[]): string {
    const prefixes = prefixesUsed || Object.keys(this.namespaces);
    return prefixes
      .map(prefix => `@prefix ${prefix}: <${this.namespaces[prefix]}> .`)
      .join('\n');
  }
  
  /**
   * Add or update a namespace
   * @param prefix - Namespace prefix
   * @param uri - Namespace URI
   */
  addNamespace(prefix: string, uri: string): void {
    this.namespaces[prefix] = uri;
  }
  
  /**
   * Get all registered namespaces
   * @returns Copy of namespace map
   */
  getAllNamespaces(): NamespaceMap {
    return { ...this.namespaces };
  }
  
  /**
   * Check if a prefix is registered
   * @param prefix - Namespace prefix to check
   * @returns True if prefix exists
   */
  hasPrefix(prefix: string): boolean {
    return prefix in this.namespaces;
  }
  
  /**
   * Get namespace URI for a prefix
   * @param prefix - Namespace prefix
   * @returns Namespace URI or undefined if not found
   */
  getNamespaceUri(prefix: string): string | undefined {
    return this.namespaces[prefix];
  }
}

/**
 * Default namespace manager instance
 */
export const defaultNamespaceManager = new NamespaceManager();

/**
 * Helper function to create URIs in the Zep namespace
 * @param localName - Local name within the zep namespace
 * @returns Full URI
 */
export function zepUri(localName: string): string {
  return ZEP_NAMESPACES.zep + localName;
}

/**
 * Helper function to create memory URIs
 * @param localName - Local name within the zepmem namespace
 * @returns Full URI
 */
export function zepMemoryUri(localName: string): string {
  return ZEP_NAMESPACES.zepmem + localName;
}

/**
 * Helper function to create entity URIs
 * @param localName - Local name within the zepent namespace
 * @returns Full URI
 */
export function zepEntityUri(localName: string): string {
  return ZEP_NAMESPACES.zepent + localName;
}

/**
 * Helper function to create temporal URIs
 * @param localName - Local name within the zeptime namespace
 * @returns Full URI
 */
export function zepTimeUri(localName: string): string {
  return ZEP_NAMESPACES.zeptime + localName;
}