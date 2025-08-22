import { z } from 'zod';
import { BaseNode, EntityNode, EpisodicNode, CommunityNode, EpisodeType, GraphDriver } from '../types/index.js';
export declare const EpisodeTypeSchema: z.ZodNativeEnum<typeof EpisodeType>;
export declare const BaseNodeSchema: z.ZodObject<{
    uuid: z.ZodDefault<z.ZodString>;
    name: z.ZodString;
    groupId: z.ZodString;
    labels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodDefault<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    uuid: string;
    name: string;
    groupId: string;
    labels: string[];
    createdAt: Date;
}, {
    name: string;
    groupId: string;
    uuid?: string | undefined;
    labels?: string[] | undefined;
    createdAt?: Date | undefined;
}>;
export declare const EntityNodeSchema: z.ZodObject<{
    uuid: z.ZodDefault<z.ZodString>;
    name: z.ZodString;
    groupId: z.ZodString;
    labels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodDefault<z.ZodDate>;
} & {
    entityType: z.ZodString;
    summary: z.ZodString;
    summaryEmbedding: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    factIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    uuid: string;
    name: string;
    groupId: string;
    labels: string[];
    createdAt: Date;
    entityType: string;
    summary: string;
    summaryEmbedding?: number[] | undefined;
    factIds?: string[] | undefined;
}, {
    name: string;
    groupId: string;
    entityType: string;
    summary: string;
    uuid?: string | undefined;
    labels?: string[] | undefined;
    createdAt?: Date | undefined;
    summaryEmbedding?: number[] | undefined;
    factIds?: string[] | undefined;
}>;
export declare const EpisodicNodeSchema: z.ZodObject<{
    uuid: z.ZodDefault<z.ZodString>;
    name: z.ZodString;
    groupId: z.ZodString;
    labels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodDefault<z.ZodDate>;
} & {
    episodeType: z.ZodNativeEnum<typeof EpisodeType>;
    content: z.ZodString;
    embedding: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    validAt: z.ZodDate;
    invalidAt: z.ZodOptional<z.ZodDate>;
    referenceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    uuid: string;
    name: string;
    groupId: string;
    labels: string[];
    createdAt: Date;
    episodeType: EpisodeType;
    content: string;
    validAt: Date;
    embedding?: number[] | undefined;
    invalidAt?: Date | undefined;
    referenceId?: string | undefined;
}, {
    name: string;
    groupId: string;
    episodeType: EpisodeType;
    content: string;
    validAt: Date;
    uuid?: string | undefined;
    labels?: string[] | undefined;
    createdAt?: Date | undefined;
    embedding?: number[] | undefined;
    invalidAt?: Date | undefined;
    referenceId?: string | undefined;
}>;
export declare const CommunityNodeSchema: z.ZodObject<{
    uuid: z.ZodDefault<z.ZodString>;
    name: z.ZodString;
    groupId: z.ZodString;
    labels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodDefault<z.ZodDate>;
} & {
    communityLevel: z.ZodNumber;
    summary: z.ZodString;
    summaryEmbedding: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    factIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    uuid: string;
    name: string;
    groupId: string;
    labels: string[];
    createdAt: Date;
    summary: string;
    communityLevel: number;
    summaryEmbedding?: number[] | undefined;
    factIds?: string[] | undefined;
}, {
    name: string;
    groupId: string;
    summary: string;
    communityLevel: number;
    uuid?: string | undefined;
    labels?: string[] | undefined;
    createdAt?: Date | undefined;
    summaryEmbedding?: number[] | undefined;
    factIds?: string[] | undefined;
}>;
export declare abstract class Node implements BaseNode {
    uuid: string;
    name: string;
    groupId: string;
    labels: string[];
    createdAt: Date;
    constructor(data: BaseNode);
    abstract save(driver: GraphDriver): Promise<void>;
    delete(driver: GraphDriver): Promise<void>;
    static getByUuid(driver: GraphDriver, uuid: string): Promise<Node | null>;
}
export declare class EntityNodeImpl extends Node implements EntityNode {
    entityType: string;
    summary: string;
    summaryEmbedding?: number[];
    factIds?: string[];
    constructor(data: EntityNode);
    save(driver: GraphDriver): Promise<void>;
}
export declare class EpisodicNodeImpl extends Node implements EpisodicNode {
    episodeType: EpisodeType;
    content: string;
    embedding?: number[];
    validAt: Date;
    invalidAt?: Date;
    referenceId?: string;
    constructor(data: EpisodicNode);
    save(driver: GraphDriver): Promise<void>;
}
export declare class CommunityNodeImpl extends Node implements CommunityNode {
    communityLevel: number;
    summary: string;
    summaryEmbedding?: number[];
    factIds?: string[];
    constructor(data: CommunityNode);
    save(driver: GraphDriver): Promise<void>;
}
