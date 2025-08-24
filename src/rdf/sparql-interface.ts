/**
 * SPARQL Interface for GraphZep with full SPARQL 1.1 support
 * Provides high-level query interface with Zep-specific extensions
 */

import { OptimizedRDFDriver, RDFTriple } from '../drivers/rdf-driver.js';
import { NamespaceManager } from './namespaces.js';
import { ZepMemory, ZepFact, ZepSearchParams, ZepSearchResult, MemoryType } from '../zep/types.js';

export interface SPARQLQueryOptions {
  timeout?: number;
  limit?: number;
  offset?: number;
  orderBy?: string;
  descending?: boolean;
  temporalFilter?: TemporalFilter;
  confidenceThreshold?: number;
  includeInferred?: boolean;
}

export interface TemporalFilter {
  type: 'at' | 'between' | 'before' | 'after' | 'during';
  timestamp?: Date;
  startTime?: Date;
  endTime?: Date;
  validityCheck?: boolean; // Check if facts are valid at the given time
}

export interface SPARQLQueryResult {
  bindings: Record<string, any>[];
  count: number;
  executionTime: number;
  cached: boolean;
}

export class ZepSPARQLInterface {
  private driver: OptimizedRDFDriver;
  private nsManager: NamespaceManager;
  
  constructor(driver: OptimizedRDFDriver, nsManager?: NamespaceManager) {
    this.driver = driver;
    this.nsManager = nsManager || new NamespaceManager();
  }
  
  /**
   * Execute raw SPARQL query with automatic prefix addition
   */
  async query(sparqlQuery: string, options: SPARQLQueryOptions = {}): Promise<SPARQLQueryResult> {
    const startTime = Date.now();
    
    // Add prefixes if not already present
    const enhancedQuery = this.addZepPrefixes(sparqlQuery);
    
    // Apply options to query
    const finalQuery = this.applyQueryOptions(enhancedQuery, options);
    
    try {
      const results = await this.driver.executeQuery(finalQuery);
      
      return {
        bindings: results,
        count: results.length,
        executionTime: Date.now() - startTime,
        cached: false // TODO: implement cache detection
      };
    } catch (error) {
      throw new Error(`SPARQL query execution failed: ${error}`);
    }
  }
  
  /**
   * Search memories using SPARQL with Zep-specific optimizations
   */
  async searchMemories(params: ZepSearchParams): Promise<ZepSearchResult[]> {
    const query = this.buildMemorySearchQuery(params);
    const result = await this.query(query, {
      limit: params.limit,
      temporalFilter: params.timeRange ? {
        type: 'between',
        startTime: params.timeRange.start,
        endTime: params.timeRange.end
      } : undefined
    });
    
    return this.formatSearchResults(result.bindings);
  }
  
  /**
   * Get memories at a specific point in time
   */
  async getMemoriesAtTime(timestamp: Date, memoryTypes?: MemoryType[]): Promise<ZepMemory[]> {
    const typeFilter = memoryTypes ? 
      `FILTER(?type IN (${memoryTypes.map(t => `zep:${t.charAt(0).toUpperCase() + t.slice(1)}Memory`).join(', ')}))` :
      'FILTER(?type IN (zep:EpisodicMemory, zep:SemanticMemory, zep:ProceduralMemory))';
    
    const query = `
      SELECT ?memory ?type ?uuid ?content ?confidence ?sessionId ?createdAt ?validFrom ?validUntil
      WHERE {
        ?memory a ?type ;
                zep:uuid ?uuid ;
                zep:content ?content ;
                zep:confidence ?confidence ;
                zep:sessionId ?sessionId ;
                zep:createdAt ?createdAt ;
                zep:validFrom ?validFrom .
        
        ${typeFilter}
        FILTER(?validFrom <= "${timestamp.toISOString()}"^^xsd:dateTime)
        
        OPTIONAL { 
          ?memory zep:validUntil ?validUntil .
          FILTER(?validUntil > "${timestamp.toISOString()}"^^xsd:dateTime)
        }
      }
      ORDER BY DESC(?confidence) DESC(?createdAt)
    `;
    
    const result = await this.query(query);
    return this.formatMemoryResults(result.bindings);
  }
  
  /**
   * Get facts about entities with temporal constraints
   */
  async getFactsAboutEntity(entityName: string, validAt?: Date): Promise<ZepFact[]> {
    const timeConstraint = validAt ? `
      FILTER(?validFrom <= "${validAt.toISOString()}"^^xsd:dateTime)
      OPTIONAL { 
        ?fact zep:validUntil ?validUntil .
        FILTER(?validUntil > "${validAt.toISOString()}"^^xsd:dateTime)
      }
    ` : '';
    
    const query = `
      SELECT ?fact ?subject ?predicate ?object ?confidence ?validFrom ?validUntil ?sourceMemory
      WHERE {
        ?fact a zep:SemanticMemory ;
              zep:hasStatement ?statement ;
              zep:confidence ?confidence ;
              zep:validFrom ?validFrom .
        
        ?statement rdf:subject ?subject ;
                   rdf:predicate ?predicate ;
                   rdf:object ?object .
        
        OPTIONAL { ?fact zep:validUntil ?validUntil }
        OPTIONAL { ?fact zep:derivedFrom ?sourceMemory }
        
        FILTER(CONTAINS(LCASE(STR(?subject)), LCASE("${entityName}")) ||
               CONTAINS(LCASE(STR(?object)), LCASE("${entityName}")))
        
        ${timeConstraint}
      }
      ORDER BY DESC(?confidence) DESC(?validFrom)
    `;
    
    const result = await this.query(query);
    return this.formatFactResults(result.bindings);
  }
  
  /**
   * Find related entities using graph traversal
   */
  async findRelatedEntities(entityName: string, maxHops = 2, minConfidence = 0.5): Promise<any[]> {
    const query = `
      SELECT DISTINCT ?relatedEntity ?relationPath ?totalConfidence
      WHERE {
        {
          # Direct relations (1 hop)
          ?fact1 a zep:SemanticMemory ;
                 zep:hasStatement ?stmt1 ;
                 zep:confidence ?conf1 .
          
          ?stmt1 rdf:subject ?entity1 ;
                 rdf:predicate ?pred1 ;
                 rdf:object ?relatedEntity .
          
          FILTER(CONTAINS(LCASE(STR(?entity1)), LCASE("${entityName}")))
          FILTER(?conf1 >= ${minConfidence})
          
          BIND(?pred1 AS ?relationPath)
          BIND(?conf1 AS ?totalConfidence)
        }
        ${maxHops >= 2 ? `
        UNION {
          # Indirect relations (2 hops)
          ?fact1 a zep:SemanticMemory ;
                 zep:hasStatement ?stmt1 ;
                 zep:confidence ?conf1 .
          
          ?fact2 a zep:SemanticMemory ;
                 zep:hasStatement ?stmt2 ;
                 zep:confidence ?conf2 .
          
          ?stmt1 rdf:subject ?entity1 ;
                 rdf:predicate ?pred1 ;
                 rdf:object ?intermediate .
          
          ?stmt2 rdf:subject ?intermediate ;
                 rdf:predicate ?pred2 ;
                 rdf:object ?relatedEntity .
          
          FILTER(CONTAINS(LCASE(STR(?entity1)), LCASE("${entityName}")))
          FILTER(?conf1 >= ${minConfidence} && ?conf2 >= ${minConfidence})
          FILTER(?entity1 != ?relatedEntity)
          
          BIND(CONCAT(STR(?pred1), " -> ", STR(?pred2)) AS ?relationPath)
          BIND((?conf1 * ?conf2) AS ?totalConfidence)
        }
        ` : ''}
      }
      ORDER BY DESC(?totalConfidence)
    `;
    
    const result = await this.query(query);
    return result.bindings;
  }
  
  /**
   * Aggregate memories by session with statistics
   */
  async getSessionSummary(sessionId: string): Promise<any> {
    const query = `
      SELECT ?sessionId 
             (COUNT(?memory) AS ?totalMemories)
             (COUNT(?episodic) AS ?episodicCount)
             (COUNT(?semantic) AS ?semanticCount)
             (COUNT(?procedural) AS ?proceduralCount)
             (AVG(?confidence) AS ?avgConfidence)
             (MIN(?createdAt) AS ?sessionStart)
             (MAX(?createdAt) AS ?sessionEnd)
      WHERE {
        ?memory zep:sessionId "${sessionId}" ;
                zep:confidence ?confidence ;
                zep:createdAt ?createdAt .
        
        OPTIONAL {
          ?memory a zep:EpisodicMemory .
          BIND(?memory AS ?episodic)
        }
        
        OPTIONAL {
          ?memory a zep:SemanticMemory .
          BIND(?memory AS ?semantic)
        }
        
        OPTIONAL {
          ?memory a zep:ProceduralMemory .
          BIND(?memory AS ?procedural)
        }
      }
      GROUP BY ?sessionId
    `;
    
    const result = await this.query(query);
    return result.bindings[0] || null;
  }
  
  /**
   * Complex analytical query: Memory evolution over time
   */
  async getMemoryEvolution(timeWindow: 'day' | 'week' | 'month' = 'day', limit = 30): Promise<any[]> {
    const timeFormat = {
      day: '%Y-%m-%d',
      week: '%Y-W%U',
      month: '%Y-%m'
    };
    
    const query = `
      SELECT ?timePeriod
             (COUNT(?memory) AS ?memoryCount)
             (COUNT(?episodic) AS ?episodicCount)
             (COUNT(?semantic) AS ?semanticCount)
             (AVG(?confidence) AS ?avgConfidence)
      WHERE {
        ?memory a ?type ;
                zep:confidence ?confidence ;
                zep:createdAt ?createdAt .
        
        FILTER(?type IN (zep:EpisodicMemory, zep:SemanticMemory, zep:ProceduralMemory))
        
        # Group by time period
        BIND(STRFTIME("${timeFormat[timeWindow]}", ?createdAt) AS ?timePeriod)
        
        OPTIONAL {
          ?memory a zep:EpisodicMemory .
          BIND(?memory AS ?episodic)
        }
        
        OPTIONAL {
          ?memory a zep:SemanticMemory .
          BIND(?memory AS ?semantic)
        }
      }
      GROUP BY ?timePeriod
      ORDER BY DESC(?timePeriod)
      LIMIT ${limit}
    `;
    
    const result = await this.query(query);
    return result.bindings;
  }
  
  /**
   * Advanced reasoning query: Infer contradictions
   */
  async findContradictions(confidenceThreshold = 0.7): Promise<any[]> {
    const query = `
      SELECT ?entity ?predicate ?value1 ?value2 ?confidence1 ?confidence2 ?time1 ?time2
      WHERE {
        ?fact1 a zep:SemanticMemory ;
               zep:hasStatement ?stmt1 ;
               zep:confidence ?confidence1 ;
               zep:validFrom ?time1 .
        
        ?fact2 a zep:SemanticMemory ;
               zep:hasStatement ?stmt2 ;
               zep:confidence ?confidence2 ;
               zep:validFrom ?time2 .
        
        ?stmt1 rdf:subject ?entity ;
               rdf:predicate ?predicate ;
               rdf:object ?value1 .
        
        ?stmt2 rdf:subject ?entity ;
               rdf:predicate ?predicate ;
               rdf:object ?value2 .
        
        FILTER(?fact1 != ?fact2)
        FILTER(?value1 != ?value2)
        FILTER(?confidence1 >= ${confidenceThreshold})
        FILTER(?confidence2 >= ${confidenceThreshold})
        
        # Only consider overlapping time periods
        FILTER(?time1 <= ?time2)
        OPTIONAL {
          ?fact1 zep:validUntil ?until1 .
          FILTER(?until1 > ?time2)
        }
      }
      ORDER BY ?entity ?predicate
    `;
    
    const result = await this.query(query);
    return result.bindings;
  }
  
  private addZepPrefixes(query: string): string {
    if (query.includes('PREFIX')) {
      return query;
    }
    
    const prefixes = this.nsManager.getSparqlPrefixes([
      'zep', 'zepmem', 'zeptime', 'zepent',
      'rdf', 'rdfs', 'owl', 'xsd', 'prov'
    ]);
    
    return `${prefixes}\n\n${query}`;
  }
  
  private applyQueryOptions(query: string, options: SPARQLQueryOptions): string {
    let enhancedQuery = query;
    
    // Add temporal filters
    if (options.temporalFilter) {
      enhancedQuery = this.addTemporalFilter(enhancedQuery, options.temporalFilter);
    }
    
    // Add confidence threshold
    if (options.confidenceThreshold) {
      const confidenceFilter = `FILTER(?confidence >= ${options.confidenceThreshold})`;
      enhancedQuery = enhancedQuery.replace(/WHERE\s*\{/, `WHERE {\n    ${confidenceFilter}`);
    }
    
    // Add ordering
    if (options.orderBy && !enhancedQuery.includes('ORDER BY')) {
      const direction = options.descending ? 'DESC' : 'ASC';
      enhancedQuery += `\nORDER BY ${direction}(${options.orderBy})`;
    }
    
    // Add limit and offset
    if (options.limit && !enhancedQuery.includes('LIMIT')) {
      enhancedQuery += `\nLIMIT ${options.limit}`;
    }
    
    if (options.offset && !enhancedQuery.includes('OFFSET')) {
      enhancedQuery += `\nOFFSET ${options.offset}`;
    }
    
    return enhancedQuery;
  }
  
  private addTemporalFilter(query: string, filter: TemporalFilter): string {
    let temporalClause = '';
    
    switch (filter.type) {
      case 'at':
        if (filter.timestamp) {
          temporalClause = `
            FILTER(?validFrom <= "${filter.timestamp.toISOString()}"^^xsd:dateTime)
            OPTIONAL { 
              ?memory zep:validUntil ?validUntil .
              FILTER(?validUntil > "${filter.timestamp.toISOString()}"^^xsd:dateTime)
            }`;
        }
        break;
        
      case 'between':
        if (filter.startTime && filter.endTime) {
          temporalClause = `
            FILTER(?validFrom >= "${filter.startTime.toISOString()}"^^xsd:dateTime)
            FILTER(?validFrom <= "${filter.endTime.toISOString()}"^^xsd:dateTime)`;
        }
        break;
        
      case 'before':
        if (filter.timestamp) {
          temporalClause = `FILTER(?validFrom < "${filter.timestamp.toISOString()}"^^xsd:dateTime)`;
        }
        break;
        
      case 'after':
        if (filter.timestamp) {
          temporalClause = `FILTER(?validFrom > "${filter.timestamp.toISOString()}"^^xsd:dateTime)`;
        }
        break;
    }
    
    return query.replace(/WHERE\s*\{/, `WHERE {\n    ${temporalClause}`);
  }
  
  private buildMemorySearchQuery(params: ZepSearchParams): string {
    const typeFilter = params.memoryTypes?.length ? 
      `FILTER(?type IN (${params.memoryTypes.map(t => `zep:${t.charAt(0).toUpperCase() + t.slice(1)}Memory`).join(', ')}))` :
      '';
    
    const sessionFilter = params.sessionId ? `FILTER(?sessionId = "${params.sessionId}")` : '';
    const userFilter = params.userId ? `FILTER(?userId = "${params.userId}")` : '';
    const relevanceFilter = params.minRelevance ? `FILTER(?confidence >= ${params.minRelevance})` : '';
    
    // Text search using SPARQL's text functions
    const textFilter = `FILTER(CONTAINS(LCASE(?content), LCASE("${params.query}")))`;
    
    return `
      SELECT ?memory ?type ?uuid ?content ?confidence ?sessionId ?userId ?createdAt
      WHERE {
        ?memory a ?type ;
                zep:uuid ?uuid ;
                zep:content ?content ;
                zep:confidence ?confidence ;
                zep:sessionId ?sessionId ;
                zep:createdAt ?createdAt .
        
        OPTIONAL { ?memory zep:userId ?userId }
        
        ${typeFilter}
        ${sessionFilter}
        ${userFilter}
        ${relevanceFilter}
        ${textFilter}
      }
      ORDER BY DESC(?confidence) DESC(?createdAt)
    `;
  }
  
  private formatSearchResults(bindings: any[]): ZepSearchResult[] {
    return bindings.map(binding => ({
      memory: this.bindingToMemory(binding),
      score: binding.confidence || 0,
      distance: 1 - (binding.confidence || 0), // Convert confidence to distance
      highlights: [binding.content], // Simple highlighting
      context: [] // TODO: implement context retrieval
    }));
  }
  
  private formatMemoryResults(bindings: any[]): ZepMemory[] {
    return bindings.map(binding => this.bindingToMemory(binding));
  }
  
  private formatFactResults(bindings: any[]): ZepFact[] {
    return bindings.map(binding => ({
      uuid: binding.fact?.replace(/.*\//, '') || '',
      subject: binding.subject || '',
      predicate: binding.predicate || '',
      object: binding.object || '',
      confidence: binding.confidence || 0,
      sourceMemoryIds: binding.sourceMemory ? [binding.sourceMemory.replace(/.*\//, '')] : [],
      validFrom: new Date(binding.validFrom || Date.now()),
      validUntil: binding.validUntil ? new Date(binding.validUntil) : undefined,
      metadata: {}
    }));
  }
  
  private bindingToMemory(binding: any): ZepMemory {
    return {
      uuid: binding.uuid || '',
      sessionId: binding.sessionId || '',
      userId: binding.userId,
      content: binding.content || '',
      memoryType: this.parseMemoryType(binding.type),
      embedding: undefined, // TODO: retrieve embeddings
      metadata: {},
      createdAt: new Date(binding.createdAt || Date.now()),
      lastAccessedAt: undefined,
      accessCount: 0,
      relevanceScore: binding.confidence,
      summary: binding.summary,
      validFrom: new Date(binding.validFrom || binding.createdAt || Date.now()),
      validUntil: binding.validUntil ? new Date(binding.validUntil) : undefined,
      facts: []
    };
  }
  
  private parseMemoryType(typeUri?: string): MemoryType {
    if (!typeUri) return MemoryType.EPISODIC; // default
    if (typeUri.includes('EpisodicMemory')) return MemoryType.EPISODIC;
    if (typeUri.includes('SemanticMemory')) return MemoryType.SEMANTIC;
    if (typeUri.includes('ProceduralMemory')) return MemoryType.PROCEDURAL;
    return MemoryType.EPISODIC; // default
  }
}