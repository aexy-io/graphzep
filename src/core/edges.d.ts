import { z } from 'zod';
import { BaseEdge, EntityEdge, EpisodicEdge, CommunityEdge, GraphDriver } from '../types/index.js';
export declare const BaseEdgeSchema: z.ZodObject<{
    uuid: z.ZodDefault<z.ZodString>;
    groupId: z.ZodString;
    sourceNodeUuid: z.ZodString;
    targetNodeUuid: z.ZodString;
    createdAt: z.ZodDefault<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    uuid: string;
    groupId: string;
    createdAt: Date;
    sourceNodeUuid: string;
    targetNodeUuid: string;
}, {
    groupId: string;
    sourceNodeUuid: string;
    targetNodeUuid: string;
    uuid?: string | undefined;
    createdAt?: Date | undefined;
}>;
export declare const EntityEdgeSchema: z.ZodObject<{
    uuid: z.ZodDefault<z.ZodString>;
    groupId: z.ZodString;
    sourceNodeUuid: z.ZodString;
    targetNodeUuid: z.ZodString;
    createdAt: z.ZodDefault<z.ZodDate>;
} & {
    name: z.ZodString;
    factIds: z.ZodArray<z.ZodString, "many">;
    episodes: z.ZodArray<z.ZodString, "many">;
    expiredAt: z.ZodOptional<z.ZodDate>;
    validAt: z.ZodDate;
    invalidAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    uuid: string;
    name: string;
    groupId: string;
    createdAt: Date;
    factIds: string[];
    validAt: Date;
    sourceNodeUuid: string;
    targetNodeUuid: string;
    episodes: string[];
    invalidAt?: Date | undefined;
    expiredAt?: Date | undefined;
}, {
    name: string;
    groupId: string;
    factIds: string[];
    validAt: Date;
    sourceNodeUuid: string;
    targetNodeUuid: string;
    episodes: string[];
    uuid?: string | undefined;
    createdAt?: Date | undefined;
    invalidAt?: Date | undefined;
    expiredAt?: Date | undefined;
}>;
export declare const EpisodicEdgeSchema: z.ZodObject<{
    uuid: z.ZodDefault<z.ZodString>;
    groupId: z.ZodString;
    sourceNodeUuid: z.ZodString;
    targetNodeUuid: z.ZodString;
    createdAt: z.ZodDefault<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    uuid: string;
    groupId: string;
    createdAt: Date;
    sourceNodeUuid: string;
    targetNodeUuid: string;
}, {
    groupId: string;
    sourceNodeUuid: string;
    targetNodeUuid: string;
    uuid?: string | undefined;
    createdAt?: Date | undefined;
}>;
export declare const CommunityEdgeSchema: z.ZodObject<{
    uuid: z.ZodDefault<z.ZodString>;
    groupId: z.ZodString;
    sourceNodeUuid: z.ZodString;
    targetNodeUuid: z.ZodString;
    createdAt: z.ZodDefault<z.ZodDate>;
} & {
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    factIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    uuid: string;
    name: string;
    groupId: string;
    createdAt: Date;
    sourceNodeUuid: string;
    targetNodeUuid: string;
    factIds?: string[] | undefined;
    description?: string | undefined;
}, {
    name: string;
    groupId: string;
    sourceNodeUuid: string;
    targetNodeUuid: string;
    uuid?: string | undefined;
    createdAt?: Date | undefined;
    factIds?: string[] | undefined;
    description?: string | undefined;
}>;
export declare abstract class Edge implements BaseEdge {
    uuid: string;
    groupId: string;
    sourceNodeUuid: string;
    targetNodeUuid: string;
    createdAt: Date;
    constructor(data: BaseEdge);
    abstract save(driver: GraphDriver): Promise<void>;
    delete(driver: GraphDriver): Promise<void>;
    static deleteByUuids(driver: GraphDriver, uuids: string[]): Promise<void>;
    static getByUuid(driver: GraphDriver, uuid: string): Promise<Edge | null>;
}
export declare class EntityEdgeImpl extends Edge implements EntityEdge {
    name: string;
    factIds: string[];
    episodes: string[];
    expiredAt?: Date;
    validAt: Date;
    invalidAt?: Date;
    constructor(data: EntityEdge);
    save(driver: GraphDriver): Promise<void>;
}
export declare class EpisodicEdgeImpl extends Edge implements EpisodicEdge {
    save(driver: GraphDriver): Promise<void>;
}
export declare class CommunityEdgeImpl extends Edge implements CommunityEdge {
    name: string;
    description?: string;
    factIds?: string[];
    constructor(data: CommunityEdge);
    save(driver: GraphDriver): Promise<void>;
}
