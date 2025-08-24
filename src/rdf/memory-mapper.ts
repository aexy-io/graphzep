/**
 * RDF Memory Mapper for GraphZep
 * Converts Zep memory types to RDF triples and back
 */

import { v4 as uuidv4 } from 'uuid';
import { NamespaceManager, zepUri, zepMemoryUri, zepEntityUri } from './namespaces.js';
import { ZepMemory, ZepFact, MemoryType } from '../zep/types.js';
import { EpisodicNode, EntityNode } from '../types/index.js';
import { RDFTriple } from '../drivers/rdf-driver.js';

export interface RDFMemoryMapperConfig {
  namespaceManager?: NamespaceManager;
  includeEmbeddings?: boolean;
  embeddingSchema?: 'base64' | 'vector-ref' | 'compressed';
}

export class RDFMemoryMapper {
  private nsManager: NamespaceManager;
  private config: RDFMemoryMapperConfig;
  
  constructor(config: RDFMemoryMapperConfig = {}) {
    this.nsManager = config.namespaceManager || new NamespaceManager();
    this.config = {
      includeEmbeddings: true,
      embeddingSchema: 'vector-ref',
      ...config
    };
  }
  
  /**
   * Convert Episodic Memory to RDF triples
   */
  episodicToRDF(memory: ZepMemory): RDFTriple[] {
    const memoryUri = zepMemoryUri(`episodic/${memory.uuid}`);
    const triples: RDFTriple[] = [];
    
    // Core memory triples
    triples.push(
      {
        subject: memoryUri,
        predicate: 'rdf:type',
        object: 'zep:EpisodicMemory'
      },
      {
        subject: memoryUri,
        predicate: 'zep:uuid',
        object: { value: memory.uuid, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: memoryUri,
        predicate: 'zep:content',
        object: { value: memory.content, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: memoryUri,
        predicate: 'zep:sessionId',
        object: { value: memory.sessionId, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: memoryUri,
        predicate: 'zep:createdAt',
        object: { value: memory.createdAt.toISOString(), type: 'literal', datatype: 'xsd:dateTime' }
      },
      {
        subject: memoryUri,
        predicate: 'zep:validFrom',
        object: { value: memory.validFrom.toISOString(), type: 'literal', datatype: 'xsd:dateTime' }
      },
      {
        subject: memoryUri,
        predicate: 'zep:accessCount',
        object: { value: memory.accessCount.toString(), type: 'literal', datatype: 'xsd:integer' }
      }
    );
    
    // Optional properties
    if (memory.userId) {
      triples.push({
        subject: memoryUri,
        predicate: 'zep:userId',
        object: { value: memory.userId, type: 'literal', datatype: 'xsd:string' }
      });
    }
    
    if (memory.validUntil) {
      triples.push({
        subject: memoryUri,
        predicate: 'zep:validUntil',
        object: { value: memory.validUntil.toISOString(), type: 'literal', datatype: 'xsd:dateTime' }
      });
    }
    
    if (memory.lastAccessedAt) {
      triples.push({
        subject: memoryUri,
        predicate: 'zep:lastAccessedAt',
        object: { value: memory.lastAccessedAt.toISOString(), type: 'literal', datatype: 'xsd:dateTime' }
      });
    }
    
    if (memory.relevanceScore !== undefined) {
      triples.push({
        subject: memoryUri,
        predicate: 'zep:relevanceScore',
        object: { value: memory.relevanceScore.toString(), type: 'literal', datatype: 'xsd:float' }
      });
    }
    
    if (memory.summary) {
      triples.push({
        subject: memoryUri,
        predicate: 'zep:summary',
        object: { value: memory.summary, type: 'literal', datatype: 'xsd:string' }
      });
    }
    
    // Handle embeddings
    if (memory.embedding && this.config.includeEmbeddings) {
      triples.push(...this.embeddingToRDF(memoryUri, memory.embedding));
    }
    
    // Handle metadata
    if (memory.metadata) {
      triples.push(...this.metadataToRDF(memoryUri, memory.metadata));
    }
    
    // Handle facts
    if (memory.facts && memory.facts.length > 0) {
      triples.push(...this.factsToRDF(memoryUri, memory.facts));
    }
    
    return triples;
  }
  
  /**
   * Convert Semantic Memory (Facts) to RDF triples using reification
   */
  semanticToRDF(fact: ZepFact): RDFTriple[] {
    const factUri = zepMemoryUri(`semantic/${fact.uuid}`);
    const statementUri = zepMemoryUri(`statement/${fact.uuid}`);
    const triples: RDFTriple[] = [];
    
    // The actual fact as a direct triple
    triples.push({
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object
    });
    
    // Reified statement with metadata
    triples.push(
      {
        subject: factUri,
        predicate: 'rdf:type',
        object: 'zep:SemanticMemory'
      },
      {
        subject: factUri,
        predicate: 'zep:uuid',
        object: { value: fact.uuid, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: factUri,
        predicate: 'zep:hasStatement',
        object: statementUri
      },
      {
        subject: statementUri,
        predicate: 'rdf:type',
        object: 'rdf:Statement'
      },
      {
        subject: statementUri,
        predicate: 'rdf:subject',
        object: fact.subject
      },
      {
        subject: statementUri,
        predicate: 'rdf:predicate',
        object: fact.predicate
      },
      {
        subject: statementUri,
        predicate: 'rdf:object',
        object: fact.object
      },
      {
        subject: factUri,
        predicate: 'zep:confidence',
        object: { value: fact.confidence.toString(), type: 'literal', datatype: 'xsd:float' }
      },
      {
        subject: factUri,
        predicate: 'zep:validFrom',
        object: { value: fact.validFrom.toISOString(), type: 'literal', datatype: 'xsd:dateTime' }
      }
    );
    
    // Optional valid until
    if (fact.validUntil) {
      triples.push({
        subject: factUri,
        predicate: 'zep:validUntil',
        object: { value: fact.validUntil.toISOString(), type: 'literal', datatype: 'xsd:dateTime' }
      });
    }
    
    // Source memory references
    fact.sourceMemoryIds.forEach(memoryId => {
      triples.push({
        subject: factUri,
        predicate: 'zep:derivedFrom',
        object: zepMemoryUri(`episodic/${memoryId}`)
      });
    });
    
    // Handle metadata
    if (fact.metadata) {
      triples.push(...this.metadataToRDF(factUri, fact.metadata));
    }
    
    return triples;
  }
  
  /**
   * Convert Procedural Memory to RDF triples
   */
  proceduralToRDF(memory: ZepMemory): RDFTriple[] {
    const memoryUri = zepMemoryUri(`procedural/${memory.uuid}`);
    const triples: RDFTriple[] = [];
    
    // Base procedural memory structure
    triples.push(
      {
        subject: memoryUri,
        predicate: 'rdf:type',
        object: 'zep:ProceduralMemory'
      },
      {
        subject: memoryUri,
        predicate: 'zep:uuid',
        object: { value: memory.uuid, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: memoryUri,
        predicate: 'zep:content',
        object: { value: memory.content, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: memoryUri,
        predicate: 'zep:sessionId',
        object: { value: memory.sessionId, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: memoryUri,
        predicate: 'zep:createdAt',
        object: { value: memory.createdAt.toISOString(), type: 'literal', datatype: 'xsd:dateTime' }
      },
      {
        subject: memoryUri,
        predicate: 'zep:validFrom',
        object: { value: memory.validFrom.toISOString(), type: 'literal', datatype: 'xsd:dateTime' }
      }
    );
    
    // Add procedure-specific properties
    if (memory.metadata?.steps) {
      const stepsUri = `${memoryUri}/steps`;
      triples.push({
        subject: memoryUri,
        predicate: 'zep:hasSteps',
        object: stepsUri
      });
      
      memory.metadata.steps.forEach((step: string, index: number) => {
        const stepUri = `${stepsUri}/${index}`;
        triples.push(
          {
            subject: stepsUri,
            predicate: `zep:step${index}`,
            object: stepUri
          },
          {
            subject: stepUri,
            predicate: 'rdf:type',
            object: 'zep:ProcedureStep'
          },
          {
            subject: stepUri,
            predicate: 'zep:stepOrder',
            object: { value: index.toString(), type: 'literal', datatype: 'xsd:integer' }
          },
          {
            subject: stepUri,
            predicate: 'zep:stepContent',
            object: { value: step, type: 'literal', datatype: 'xsd:string' }
          }
        );
      });
    }
    
    // Handle other optional properties similar to episodic memory
    if (memory.userId) {
      triples.push({
        subject: memoryUri,
        predicate: 'zep:userId',
        object: { value: memory.userId, type: 'literal', datatype: 'xsd:string' }
      });
    }
    
    if (memory.summary) {
      triples.push({
        subject: memoryUri,
        predicate: 'zep:summary',
        object: { value: memory.summary, type: 'literal', datatype: 'xsd:string' }
      });
    }
    
    return triples;
  }
  
  /**
   * Convert Entity to RDF triples
   */
  entityToRDF(entity: EntityNode): RDFTriple[] {
    const entityUri = zepEntityUri(entity.uuid);
    const triples: RDFTriple[] = [];
    
    triples.push(
      {
        subject: entityUri,
        predicate: 'rdf:type',
        object: 'zep:Entity'
      },
      {
        subject: entityUri,
        predicate: 'zep:uuid',
        object: { value: entity.uuid, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: entityUri,
        predicate: 'zep:name',
        object: { value: entity.name, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: entityUri,
        predicate: 'zep:entityType',
        object: { value: entity.entityType, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: entityUri,
        predicate: 'zep:summary',
        object: { value: entity.summary, type: 'literal', datatype: 'xsd:string' }
      },
      {
        subject: entityUri,
        predicate: 'zep:createdAt',
        object: { value: entity.createdAt.toISOString(), type: 'literal', datatype: 'xsd:dateTime' }
      }
    );
    
    // Add entity type-specific class
    const entityTypeClass = this.getEntityTypeClass(entity.entityType);
    if (entityTypeClass) {
      triples.push({
        subject: entityUri,
        predicate: 'rdf:type',
        object: entityTypeClass
      });
    }
    
    // Handle embeddings
    if (entity.summaryEmbedding && this.config.includeEmbeddings) {
      triples.push(...this.embeddingToRDF(entityUri, entity.summaryEmbedding));
    }
    
    return triples;
  }
  
  /**
   * Convert RDF triples back to ZepMemory
   */
  rdfToZepMemory(triples: RDFTriple[]): ZepMemory | null {
    const memoryMap = this.groupTriplesBySubject(triples);
    
    for (const [subject, subjectTriples] of memoryMap.entries()) {
      const typeTriple = subjectTriples.find(t => t.predicate === 'rdf:type');
      
      if (typeTriple && 
          (typeTriple.object === 'zep:EpisodicMemory' || 
           typeTriple.object === 'zep:SemanticMemory' ||
           typeTriple.object === 'zep:ProceduralMemory')) {
        
        return this.constructZepMemoryFromTriples(subject, subjectTriples);
      }
    }
    
    return null;
  }
  
  private embeddingToRDF(subjectUri: string, embedding: number[]): RDFTriple[] {
    const triples: RDFTriple[] = [];
    
    switch (this.config.embeddingSchema) {
      case 'base64':
        const encoded = Buffer.from(new Float32Array(embedding).buffer).toString('base64');
        triples.push({
          subject: subjectUri,
          predicate: 'zep:hasEmbedding',
          object: { value: encoded, type: 'literal', datatype: 'xsd:base64Binary' }
        });
        break;
        
      case 'vector-ref':
        // Store reference to external vector store
        const vectorId = uuidv4();
        triples.push({
          subject: subjectUri,
          predicate: 'zep:hasEmbedding',
          object: { value: `vector://${vectorId}`, type: 'literal', datatype: 'xsd:anyURI' }
        });
        break;
        
      case 'compressed':
        // Simple compression - store as comma-separated values
        const compressed = embedding.map(v => v.toFixed(6)).join(',');
        triples.push({
          subject: subjectUri,
          predicate: 'zep:hasEmbedding',
          object: { value: compressed, type: 'literal', datatype: 'xsd:string' }
        });
        break;
    }
    
    // Store embedding metadata
    triples.push({
      subject: subjectUri,
      predicate: 'zep:embeddingDimension',
      object: { value: embedding.length.toString(), type: 'literal', datatype: 'xsd:integer' }
    });
    
    return triples;
  }
  
  private metadataToRDF(subjectUri: string, metadata: Record<string, any>): RDFTriple[] {
    const triples: RDFTriple[] = [];
    
    for (const [key, value] of Object.entries(metadata)) {
      const metadataUri = `${subjectUri}/metadata/${key}`;
      
      triples.push(
        {
          subject: subjectUri,
          predicate: 'zep:hasMetadata',
          object: metadataUri
        },
        {
          subject: metadataUri,
          predicate: 'rdf:type',
          object: 'zep:Metadata'
        },
        {
          subject: metadataUri,
          predicate: 'zep:key',
          object: { value: key, type: 'literal', datatype: 'xsd:string' }
        },
        {
          subject: metadataUri,
          predicate: 'zep:value',
          object: { value: JSON.stringify(value), type: 'literal', datatype: 'xsd:string' }
        }
      );
    }
    
    return triples;
  }
  
  private factsToRDF(memoryUri: string, facts: ZepFact[]): RDFTriple[] {
    const triples: RDFTriple[] = [];
    
    facts.forEach(fact => {
      const factTriples = this.semanticToRDF(fact);
      triples.push(...factTriples);
      
      // Link fact to memory
      triples.push({
        subject: memoryUri,
        predicate: 'zep:hasFact',
        object: zepMemoryUri(`semantic/${fact.uuid}`)
      });
    });
    
    return triples;
  }
  
  private getEntityTypeClass(entityType: string): string | null {
    const typeMap: Record<string, string> = {
      'person': 'zep:Person',
      'organization': 'zep:Organization',
      'location': 'zep:Location',
      'event': 'zep:Event',
      'concept': 'zep:Concept'
    };
    
    return typeMap[entityType.toLowerCase()] || null;
  }
  
  private groupTriplesBySubject(triples: RDFTriple[]): Map<string, RDFTriple[]> {
    const grouped = new Map<string, RDFTriple[]>();
    
    for (const triple of triples) {
      if (!grouped.has(triple.subject)) {
        grouped.set(triple.subject, []);
      }
      grouped.get(triple.subject)!.push(triple);
    }
    
    return grouped;
  }
  
  private constructZepMemoryFromTriples(subject: string, triples: RDFTriple[]): ZepMemory {
    const memory: Partial<ZepMemory> = {
      facts: []
    };
    
    for (const triple of triples) {
      switch (triple.predicate) {
        case 'zep:uuid':
          memory.uuid = this.getLiteralValue(triple.object) as string;
          break;
        case 'zep:content':
          memory.content = this.getLiteralValue(triple.object) as string;
          break;
        case 'zep:sessionId':
          memory.sessionId = this.getLiteralValue(triple.object) as string;
          break;
        case 'zep:createdAt':
          memory.createdAt = new Date(this.getLiteralValue(triple.object) as string);
          break;
        case 'zep:validFrom':
          memory.validFrom = new Date(this.getLiteralValue(triple.object) as string);
          break;
        case 'zep:validUntil':
          memory.validUntil = new Date(this.getLiteralValue(triple.object) as string);
          break;
        case 'zep:accessCount':
          memory.accessCount = parseInt(this.getLiteralValue(triple.object) as string);
          break;
        case 'zep:relevanceScore':
          memory.relevanceScore = parseFloat(this.getLiteralValue(triple.object) as string);
          break;
        case 'rdf:type':
          if (triple.object === 'zep:EpisodicMemory') {
            memory.memoryType = MemoryType.EPISODIC;
          } else if (triple.object === 'zep:SemanticMemory') {
            memory.memoryType = MemoryType.SEMANTIC;
          } else if (triple.object === 'zep:ProceduralMemory') {
            memory.memoryType = MemoryType.PROCEDURAL;
          }
          break;
      }
    }
    
    return memory as ZepMemory;
  }
  
  private getLiteralValue(object: string | { value: string; type: string; datatype?: string; language?: string }): string | number | boolean | Date {
    if (typeof object === 'string') {
      return object;
    }
    
    const { value, datatype } = object;
    
    if (datatype === 'xsd:integer') {
      return parseInt(value);
    } else if (datatype === 'xsd:float' || datatype === 'xsd:double') {
      return parseFloat(value);
    } else if (datatype === 'xsd:boolean') {
      return value === 'true';
    } else if (datatype === 'xsd:dateTime') {
      return new Date(value);
    }
    
    return value;
  }
}