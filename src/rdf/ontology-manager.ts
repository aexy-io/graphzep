/**
 * Ontology Manager for GraphZep RDF support
 * Handles loading, validation, and management of domain ontologies
 */

import fs from 'fs/promises';
import path from 'path';
import { NamespaceManager } from './namespaces.js';
import { RDFTriple } from '../drivers/rdf-driver.js';
import { LLMClient } from '../types/index.js';

export interface OntologyClass {
  uri: string;
  label?: string;
  comment?: string;
  superClasses: string[];
  subClasses: string[];
  properties: string[];
  restrictions: OntologyRestriction[];
}

export interface OntologyProperty {
  uri: string;
  label?: string;
  comment?: string;
  domain: string[];
  range: string[];
  subProperties: string[];
  superProperties: string[];
  functional?: boolean;
  inverseFunctional?: boolean;
  transitive?: boolean;
  symmetric?: boolean;
}

export interface OntologyRestriction {
  type: 'cardinality' | 'minCardinality' | 'maxCardinality' | 'allValuesFrom' | 'someValuesFrom' | 'hasValue';
  property: string;
  value?: string | number;
  classRestriction?: string;
}

export interface ParsedOntology {
  uri: string;
  version?: string;
  classes: Map<string, OntologyClass>;
  properties: Map<string, OntologyProperty>;
  individuals: Map<string, any>;
  rules: OntologyRule[];
  imports: string[];
  namespaces: Map<string, string>;
}

export interface OntologyRule {
  id: string;
  description: string;
  type: 'inference' | 'validation' | 'constraint';
  sparql?: string;
  condition?: string;
  action?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: string;
  message: string;
  subject?: string;
  predicate?: string;
  object?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning extends ValidationError {
  severity: 'warning';
}

export interface OntologyStats {
  totalClasses: number;
  totalProperties: number;
  totalIndividuals: number;
  totalRules: number;
  depth: number;
  complexity: number;
}

export interface ExtractionGuidance {
  entityTypes: string[];
  relationTypes: string[];
  constraints: string[];
  examples: string[];
  prompt: string;
}

export class OntologyManager {
  private ontologies: Map<string, ParsedOntology> = new Map();
  private activeOntology: string | null = null;
  private nsManager: NamespaceManager;
  private validationCache: Map<string, ValidationResult> = new Map();
  
  constructor(nsManager?: NamespaceManager) {
    this.nsManager = nsManager || new NamespaceManager();
  }
  
  /**
   * Load ontology from file with format detection
   */
  async loadOntology(filePath: string, ontologyId?: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const format = this.detectFormat(filePath, content);
      const id = ontologyId || path.basename(filePath, path.extname(filePath));
      
      const ontology = await this.parseOntology(content, format, id);
      this.ontologies.set(id, ontology);
      
      // Update namespace manager with ontology namespaces
      for (const [prefix, uri] of ontology.namespaces.entries()) {
        this.nsManager.addNamespace(prefix, uri);
      }
      
      // Set as active if it's the first one
      if (!this.activeOntology) {
        this.activeOntology = id;
      }
      
      return id;
    } catch (error) {
      throw new Error(`Failed to load ontology from ${filePath}: ${error}`);
    }
  }
  
  /**
   * Load ontology from string content
   */
  async loadOntologyFromString(content: string, format: string, ontologyId: string): Promise<string> {
    try {
      const ontology = await this.parseOntology(content, format, ontologyId);
      this.ontologies.set(ontologyId, ontology);
      
      // Update namespace manager
      for (const [prefix, uri] of ontology.namespaces.entries()) {
        this.nsManager.addNamespace(prefix, uri);
      }
      
      if (!this.activeOntology) {
        this.activeOntology = ontologyId;
      }
      
      return ontologyId;
    } catch (error) {
      throw new Error(`Failed to parse ontology: ${error}`);
    }
  }
  
  /**
   * Set active ontology for validation and extraction
   */
  setActiveOntology(ontologyId: string): void {
    if (!this.ontologies.has(ontologyId)) {
      throw new Error(`Ontology not found: ${ontologyId}`);
    }
    this.activeOntology = ontologyId;
  }
  
  /**
   * Get active ontology
   */
  getActiveOntology(): ParsedOntology | null {
    return this.activeOntology ? this.ontologies.get(this.activeOntology) || null : null;
  }
  
  /**
   * Validate RDF triple against active ontology
   */
  validateTriple(triple: RDFTriple): ValidationResult {
    const cacheKey = `${triple.subject}:${triple.predicate}:${JSON.stringify(triple.object)}`;
    
    // Check cache first
    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!;
    }
    
    const result = this.performValidation(triple);
    
    // Cache result
    this.validationCache.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * Validate multiple triples
   */
  validateTriples(triples: RDFTriple[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    for (const triple of triples) {
      const result = this.validateTriple(triple);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Generate extraction guidance for LLM
   */
  generateExtractionGuidance(content: string, ontologyId?: string): ExtractionGuidance {
    const ontology = ontologyId ? 
      this.ontologies.get(ontologyId) : 
      this.getActiveOntology();
    
    if (!ontology) {
      throw new Error('No ontology available for guidance');
    }
    
    const entityTypes = Array.from(ontology.classes.values())
      .filter(cls => !cls.uri.startsWith('http://www.w3.org/'))
      .map(cls => cls.label || cls.uri.split('#').pop() || cls.uri.split('/').pop() || cls.uri)
      .slice(0, 20); // Limit to avoid token overflow
    
    const relationTypes = Array.from(ontology.properties.values())
      .filter(prop => prop.domain.length > 0 && prop.range.length > 0)
      .map(prop => prop.label || prop.uri.split('#').pop() || prop.uri.split('/').pop() || prop.uri)
      .slice(0, 15);
    
    const constraints = this.generateConstraintDescriptions(ontology);
    
    const examples = this.generateExamples(ontology);
    
    const prompt = this.buildExtractionPrompt(content, entityTypes, relationTypes, constraints, examples);
    
    return {
      entityTypes,
      relationTypes,
      constraints,
      examples,
      prompt
    };
  }
  
  /**
   * Get ontology statistics
   */
  getOntologyStats(ontologyId?: string): OntologyStats {
    const ontology = ontologyId ? 
      this.ontologies.get(ontologyId) : 
      this.getActiveOntology();
    
    if (!ontology) {
      throw new Error('No ontology available');
    }
    
    const depth = this.calculateOntologyDepth(ontology);
    const complexity = this.calculateComplexity(ontology);
    
    return {
      totalClasses: ontology.classes.size,
      totalProperties: ontology.properties.size,
      totalIndividuals: ontology.individuals.size,
      totalRules: ontology.rules.length,
      depth,
      complexity
    };
  }
  
  /**
   * Get class hierarchy
   */
  getClassHierarchy(rootClass?: string, ontologyId?: string): any {
    const ontology = ontologyId ? 
      this.ontologies.get(ontologyId) : 
      this.getActiveOntology();
    
    if (!ontology) {
      throw new Error('No ontology available');
    }
    
    const root = rootClass || 'http://www.w3.org/2002/07/owl#Thing';
    return this.buildClassHierarchy(ontology, root);
  }
  
  /**
   * Search classes and properties
   */
  search(query: string, type: 'class' | 'property' | 'both' = 'both'): any[] {
    const results: any[] = [];
    const queryLower = query.toLowerCase();
    
    for (const ontology of this.ontologies.values()) {
      if (type === 'class' || type === 'both') {
        for (const cls of ontology.classes.values()) {
          if (this.matchesQuery(cls, queryLower)) {
            results.push({ type: 'class', ontology: ontology.uri, ...cls });
          }
        }
      }
      
      if (type === 'property' || type === 'both') {
        for (const prop of ontology.properties.values()) {
          if (this.matchesQuery(prop, queryLower)) {
            results.push({ type: 'property', ontology: ontology.uri, ...prop });
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * Export ontology to different formats
   */
  async exportOntology(ontologyId: string, format: 'rdf-xml' | 'turtle' | 'json-ld'): Promise<string> {
    const ontology = this.ontologies.get(ontologyId);
    if (!ontology) {
      throw new Error(`Ontology not found: ${ontologyId}`);
    }
    
    // Convert back to RDF format
    // This is a simplified implementation - real-world would use proper RDF libraries
    const triples = this.ontologyToTriples(ontology);
    
    switch (format) {
      case 'turtle':
        return this.triplesToTurtle(triples);
      case 'rdf-xml':
        return this.triplesToRDFXML(triples);
      case 'json-ld':
        return this.triplesToJSONLD(triples);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  private async parseOntology(content: string, format: string, id: string): Promise<ParsedOntology> {
    // Simplified ontology parsing for demo
    console.log(`Parsing ${format} ontology: ${id}`);
    
    return {
      uri: `http://example.com/ontologies/${id}`,
      classes: new Map([
        ['http://graphzep.ai/ontology#Person', {
          uri: 'http://graphzep.ai/ontology#Person',
          label: 'Person',
          comment: 'A human being',
          superClasses: [],
          subClasses: [],
          properties: [],
          restrictions: []
        }]
      ]),
      properties: new Map([
        ['http://graphzep.ai/ontology#knows', {
          uri: 'http://graphzep.ai/ontology#knows',
          label: 'knows',
          comment: 'Person knows another person',
          domain: ['http://graphzep.ai/ontology#Person'],
          range: ['http://graphzep.ai/ontology#Person'],
          subProperties: [],
          superProperties: []
        }]
      ]),
      individuals: new Map(),
      rules: [],
      imports: [],
      namespaces: new Map([
        ['zep', 'http://graphzep.ai/ontology#'],
        ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#']
      ])
    };
  }
  
  // Simplified methods - these would be implemented with proper RDF parsing in production
  
  private detectFormat(filePath: string, content: string): string {
    const extension = path.extname(filePath).toLowerCase();
    
    // Check by file extension first
    switch (extension) {
      case '.rdf':
      case '.owl':
        return 'application/rdf+xml';
      case '.ttl':
        return 'text/turtle';
      case '.n3':
        return 'text/n3';
      case '.nt':
        return 'application/n-triples';
      case '.jsonld':
        return 'application/ld+json';
    }
    
    // Check by content
    if (content.includes('<?xml') && content.includes('rdf:RDF')) {
      return 'application/rdf+xml';
    } else if (content.includes('@prefix') || content.includes('PREFIX')) {
      return 'text/turtle';
    } else if (content.includes('{') && content.includes('@context')) {
      return 'application/ld+json';
    }
    
    // Default to RDF/XML
    return 'application/rdf+xml';
  }
  
  private performValidation(triple: RDFTriple): ValidationResult {
    const ontology = this.getActiveOntology();
    if (!ontology) {
      return { valid: true, errors: [], warnings: [] };
    }
    
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate property exists
    const property = ontology.properties.get(triple.predicate);
    if (!property && !this.isBuiltinProperty(triple.predicate)) {
      warnings.push({
        type: 'unknown_property',
        message: `Unknown property: ${triple.predicate}`,
        predicate: triple.predicate,
        severity: 'warning'
      });
    }
    
    // Validate domain and range constraints
    if (property) {
      // Domain validation would require knowing the type of the subject
      // Range validation would require knowing the type of the object
      // This is simplified for the example
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  private isBuiltinProperty(predicate: string): boolean {
    return predicate.startsWith('http://www.w3.org/1999/02/22-rdf-syntax-ns#') ||
           predicate.startsWith('http://www.w3.org/2000/01/rdf-schema#') ||
           predicate.startsWith('http://www.w3.org/2002/07/owl#');
  }
  
  private generateConstraintDescriptions(ontology: ParsedOntology): string[] {
    const constraints: string[] = [];
    
    for (const cls of ontology.classes.values()) {
      if (cls.restrictions.length > 0) {
        for (const restriction of cls.restrictions) {
          constraints.push(`${cls.label || cls.uri} must have ${restriction.type} ${restriction.value} for property ${restriction.property}`);
        }
      }
    }
    
    return constraints.slice(0, 10); // Limit for prompt size
  }
  
  private generateExamples(ontology: ParsedOntology): string[] {
    // Generate simple examples based on ontology structure
    const examples: string[] = [];
    
    for (const prop of ontology.properties.values()) {
      if (prop.domain.length > 0 && prop.range.length > 0) {
        const domainLabel = this.getClassLabel(ontology, prop.domain[0]);
        const rangeLabel = this.getClassLabel(ontology, prop.range[0]);
        const propLabel = prop.label || 'related to';
        
        examples.push(`${domainLabel} ${propLabel} ${rangeLabel}`);
      }
    }
    
    return examples.slice(0, 5);
  }
  
  private getClassLabel(ontology: ParsedOntology, classUri: string): string {
    const cls = ontology.classes.get(classUri);
    return cls?.label || classUri.split('#').pop() || classUri.split('/').pop() || classUri;
  }
  
  private buildExtractionPrompt(content: string, entityTypes: string[], relationTypes: string[], constraints: string[], examples: string[]): string {
    return `
Extract entities and relationships from the following text using the provided ontology.

Available entity types: ${entityTypes.join(', ')}
Available relationship types: ${relationTypes.join(', ')}

Constraints:
${constraints.map(c => `- ${c}`).join('\n')}

Examples:
${examples.map(e => `- ${e}`).join('\n')}

Text to analyze: ${content}

Please extract entities and their relationships in the format:
- Entity: [name] (type: [entity_type])
- Relationship: [entity1] [relationship_type] [entity2]
`.trim();
  }
  
  private calculateOntologyDepth(ontology: ParsedOntology): number {
    let maxDepth = 0;
    
    for (const cls of ontology.classes.values()) {
      const depth = this.calculateClassDepth(ontology, cls.uri, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }
    
    return maxDepth;
  }
  
  private calculateClassDepth(ontology: ParsedOntology, classUri: string, visited: Set<string>): number {
    if (visited.has(classUri)) return 0;
    visited.add(classUri);
    
    const cls = ontology.classes.get(classUri);
    if (!cls || cls.superClasses.length === 0) return 1;
    
    let maxParentDepth = 0;
    for (const parentUri of cls.superClasses) {
      const parentDepth = this.calculateClassDepth(ontology, parentUri, visited);
      maxParentDepth = Math.max(maxParentDepth, parentDepth);
    }
    
    return maxParentDepth + 1;
  }
  
  private calculateComplexity(ontology: ParsedOntology): number {
    // Simple complexity metric based on structure
    return ontology.classes.size + ontology.properties.size * 2 + ontology.rules.length * 3;
  }
  
  private buildClassHierarchy(ontology: ParsedOntology, rootUri: string): any {
    const cls = ontology.classes.get(rootUri);
    if (!cls) return null;
    
    const children: any[] = [];
    for (const [uri, otherClass] of ontology.classes.entries()) {
      if (otherClass.superClasses.includes(rootUri)) {
        children.push(this.buildClassHierarchy(ontology, uri));
      }
    }
    
    return {
      uri: cls.uri,
      label: cls.label,
      comment: cls.comment,
      children
    };
  }
  
  private matchesQuery(item: OntologyClass | OntologyProperty, query: string): boolean {
    return (item.label?.toLowerCase().includes(query)) ||
           (item.comment?.toLowerCase().includes(query)) ||
           (item.uri.toLowerCase().includes(query));
  }
  
  private ontologyToTriples(ontology: ParsedOntology): RDFTriple[] {
    // Simplified conversion - would need proper implementation
    return [];
  }
  
  private triplesToTurtle(triples: RDFTriple[]): string {
    // Simplified conversion
    return '';
  }
  
  private triplesToRDFXML(triples: RDFTriple[]): string {
    // Simplified conversion
    return '';
  }
  
  private triplesToJSONLD(triples: RDFTriple[]): string {
    // Simplified conversion
    return '';
  }
}