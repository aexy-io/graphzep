# Graphzep Documentation

Welcome to the Graphzep documentation. This guide provides comprehensive information about the architecture, design patterns, and implementation details of the Graphzep temporal knowledge graph framework.

## Table of Contents

1. [Architecture Overview](./architecture.md) - High-level system design and components
2. [Data Flow](./data-flow.md) - How data moves through the system
3. [Entity Extraction](./entity-extraction.md) - NLP pipeline for entity and relation extraction
4. [Graph Storage](./graph-storage.md) - Database drivers and storage patterns
5. [Search & Retrieval](./search-retrieval.md) - Hybrid search implementation
6. [RDF Architecture](./rdf-architecture.md) - RDF/SPARQL support and semantic web integration
7. [RDF Integration](./rdf-integration.md) - Practical RDF integration patterns and best practices
8. [Getting Started](./getting-started.md) - Quick start guide and examples

## Quick Links

- [Main README](../README.md)
- [Examples](../examples/)
- [Source Code](../src/)

## Overview

Graphzep is a TypeScript framework for building temporally-aware knowledge graphs with the following key features:

- **Bi-temporal data model** - Tracks both when facts are true and when they were recorded
- **Incremental updates** - Add new information without reprocessing existing data
- **Hybrid search** - Combines semantic embeddings, keyword search, and graph traversal
- **Multiple backends** - Supports Neo4j, FalkorDB, RDF triple stores, and Amazon Neptune
- **RDF/Semantic Web** - Full SPARQL 1.1 support with ontology management and multiple serialization formats
- **Type-safe** - Full TypeScript support with Zod schema validation
- **Production-ready** - HTTP server, MCP integration, and Docker deployment

## Core Concepts

### Episodes
The fundamental unit of information in Graphzep. Episodes represent discrete pieces of content (text or JSON) that are processed to extract entities and relationships.

### Entities
Named objects extracted from episodes (people, places, organizations, concepts). Each entity has:
- Unique identifier (UUID)
- Name and type
- Summary description
- Embedding for semantic search
- Temporal validity

### Relations
Connections between entities that represent facts or relationships. Relations include:
- Source and target entities
- Relationship type/name
- Temporal validity periods
- Fact descriptions

### Temporal Model
Graphzep uses a bi-temporal model:
- **Valid Time**: When a fact is true in the real world
- **Transaction Time**: When the fact was recorded in the system

This enables powerful temporal queries and maintains historical accuracy.

### RDF and Semantic Web

Graphzep provides comprehensive RDF support, enabling semantic web integration:

#### RDF Triples
All Zep memories can be represented as RDF triples (subject-predicate-object statements):
- **Episodic memories** → `zep:EpisodicMemory` with temporal and contextual properties
- **Semantic facts** → Reified RDF statements with confidence scores
- **Entities** → Typed RDF resources with properties and relationships

#### SPARQL Queries
Execute powerful queries using SPARQL 1.1 with Zep-specific extensions:
```sparql
PREFIX zep: <http://graphzep.ai/ontology#>
SELECT ?memory ?content ?confidence
WHERE {
  ?memory a zep:EpisodicMemory ;
          zep:content ?content ;
          zep:confidence ?confidence .
  FILTER (?confidence > 0.8)
}
ORDER BY DESC(?confidence)
```

#### Ontology Management
- **Default Zep Ontology**: Defines memory types and properties
- **Custom Ontologies**: Load domain-specific ontologies (OWL, RDF/XML, Turtle)
- **Validation**: Automatic triple validation against loaded ontologies

#### Multiple Formats
Export knowledge graphs in various RDF formats:
- **Turtle** (.ttl) - Human-readable format
- **RDF/XML** (.rdf) - XML-based format  
- **JSON-LD** (.jsonld) - JSON-based linked data
- **N-Triples** (.nt) - Line-based format