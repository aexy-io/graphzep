# Graphzep Documentation

Welcome to the Graphzep documentation. This guide provides comprehensive information about the architecture, design patterns, and implementation details of the Graphzep temporal knowledge graph framework.

## Table of Contents

1. [Architecture Overview](./architecture.md) - High-level system design and components
2. [Data Flow](./data-flow.md) - How data moves through the system
3. [Entity Extraction](./entity-extraction.md) - NLP pipeline for entity and relation extraction
4. [Graph Storage](./graph-storage.md) - Database drivers and storage patterns
5. [Search & Retrieval](./search-retrieval.md) - Hybrid search implementation
6. [API Reference](./api-reference.md) - Detailed API documentation
7. [Getting Started](./getting-started.md) - Quick start guide and examples

## Quick Links

- [Main README](../README.md)
- [Examples](../examples/)
- [Source Code](../src/)

## Overview

Graphzep is a TypeScript framework for building temporally-aware knowledge graphs with the following key features:

- **Bi-temporal data model** - Tracks both when facts are true and when they were recorded
- **Incremental updates** - Add new information without reprocessing existing data
- **Hybrid search** - Combines semantic embeddings, keyword search, and graph traversal
- **Multiple backends** - Supports Neo4j, FalkorDB, and Amazon Neptune
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