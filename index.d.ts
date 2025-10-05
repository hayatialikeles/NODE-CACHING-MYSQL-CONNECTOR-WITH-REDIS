/**
 * Type definitions for node-caching-mysql-connector-with-redis
 * Project: https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS
 * Definitions by: Ali Hayati Keleş
 */

/// <reference types="node" />

declare module 'node-caching-mysql-connector-with-redis' {
    /**
     * MySQL query result type
     */
    export interface QueryResult {
        affectedRows?: number;
        insertId?: number;
        warningCount?: number;
        message?: string;
        protocol41?: boolean;
        changedRows?: number;
        fieldCount?: number;
        serverStatus?: number;
    }

    /**
     * Pagination result structure
     */
    export interface PaginationResult<T = any> {
        totalCount: number;
        pageCount: number;
        detail: T[];
    }

    /**
     * Redis client interface
     */
    export interface RedisClient {
        [key: string]: any;
    }

    // ==================== DATABASE FUNCTIONS ====================

    /**
     * Executes a SQL query and returns the result from the cache or the database.
     * If a resetCacheName is provided, it deletes the cache item before executing the query.
     *
     * @param sql - The SQL query to execute
     * @param parameters - The parameters to be passed to the SQL query
     * @param resetCacheName - The name of the cache item to reset (optional)
     * @param database - The database name to switch to (optional)
     * @returns A promise that resolves with the result of the query
     *
     * @example
     * ```typescript
     * const result = await QuaryCache(
     *   "INSERT INTO users SET name = ?, email = ?",
     *   ["John", "john@example.com"],
     *   "users-cache"
     * );
     * console.log(result.insertId);
     * ```
     */
    export function QuaryCache(
        sql: string,
        parameters: any[],
        resetCacheName?: string | null,
        database?: string | null
    ): Promise<QueryResult>;

    /**
     * Retrieves data from cache or database based on the provided SQL query and parameters.
     * If the data is found in the cache, it is returned. Otherwise, the data is fetched from the database,
     * stored in the cache, and then returned.
     *
     * @param sql - The SQL query to be executed
     * @param parameters - The parameters to be passed to the SQL query
     * @param cacheName - The name of the cache to store the data
     * @param database - The database name to switch to (optional)
     * @returns A promise that resolves to the retrieved data
     *
     * @example
     * ```typescript
     * interface User {
     *   id: number;
     *   name: string;
     *   email: string;
     * }
     *
     * const users = await getCacheQuery<User>(
     *   "SELECT * FROM users WHERE company_id = ?",
     *   [123],
     *   "users-company-123"
     * );
     * ```
     */
    export function getCacheQuery<T = any>(
        sql: string,
        parameters: any[],
        cacheName: string,
        database?: string | null
    ): Promise<T[]>;

    /**
     * Retrieves paginated data from cache or database based on the provided SQL query and parameters.
     * If the data is available in cache, it is returned directly. Otherwise, the data is fetched from the database,
     * paginated, and then stored in the cache for future use.
     *
     * @param sql - The SQL query to execute
     * @param parameters - The parameters to be used in the SQL query
     * @param cacheName - The name of the cache to store the data
     * @param page - The page number of the data to retrieve (0-based)
     * @param pageSize - The number of records per page (default: 30)
     * @param database - The database name to switch to (optional)
     * @returns A promise that resolves to an object containing the paginated data
     *
     * @example
     * ```typescript
     * interface Product {
     *   id: number;
     *   name: string;
     *   price: number;
     * }
     *
     * const result = await getCacheQueryPagination<Product>(
     *   "SELECT * FROM products WHERE category = ?",
     *   [5],
     *   "products-cat-5-page-0",
     *   0,
     *   25
     * );
     *
     * console.log(`Total: ${result.totalCount}`);
     * console.log(`Pages: ${result.pageCount}`);
     * result.detail.forEach(product => console.log(product.name));
     * ```
     */
    export function getCacheQueryPagination<T = any>(
        sql: string,
        parameters: any[],
        cacheName: string,
        page: number,
        pageSize?: number,
        database?: string | null
    ): Promise<PaginationResult<T>>;

    // ==================== REDIS FUNCTIONS ====================

    /**
     * Retrieves an item from Redis cache
     *
     * @param key - The cache key
     * @returns A promise that resolves to the cached data or empty array if not found
     *
     * @example
     * ```typescript
     * const userData = await getArrayItem<User>('user-123');
     * if (userData.length > 0) {
     *   console.log(userData);
     * }
     * ```
     */
    export function getArrayItem<T = any>(key: string): Promise<T[]>;

    /**
     * Stores an item in Redis cache with optional expiry
     *
     * @param key - The cache key
     * @param array - The data to cache
     * @param expiryDate - Time to live in seconds (default: 40000)
     * @returns A promise that resolves to the cached data
     *
     * @example
     * ```typescript
     * await addArrayItem('user-123', userData, 3600); // 1 hour TTL
     * ```
     */
    export function addArrayItem<T = any>(
        key: string,
        array: T[],
        expiryDate?: number
    ): Promise<T[]>;

    /**
     * Deletes one or more keys from Redis cache
     *
     * @param keys - Single key or array of keys to delete
     * @returns A promise that resolves when deletion is complete
     *
     * @example
     * ```typescript
     * // Delete single key
     * await delKeyItem('user-123');
     *
     * // Delete multiple keys
     * await delKeyItem(['user-123', 'user-456', 'user-789']);
     * ```
     */
    export function delKeyItem(keys: string | string[]): Promise<void>;

    /**
     * Deletes all keys matching a prefix pattern from Redis cache
     *
     * @param keys - Single prefix or array of prefixes
     * @returns A promise that resolves when deletion is complete
     *
     * @example
     * ```typescript
     * // Delete all keys starting with "users-"
     * await delPrefixKeyItem('users-');
     *
     * // Delete multiple prefixes
     * await delPrefixKeyItem(['users-', 'products-', 'orders-']);
     * ```
     */
    export function delPrefixKeyItem(keys: string | string[]): Promise<void>;

    /**
     * Returns the raw Redis client instance
     *
     * @returns The Redis client
     *
     * @example
     * ```typescript
     * const client = getRedisClient();
     * client.set('custom-key', 'value');
     * ```
     */
    export function getRedisClient(): RedisClient;

    // ==================== BACKWARD COMPATIBILITY ====================

    /**
     * Default export for backward compatibility with v2.4.x
     *
     * @example
     * ```typescript
     * // v2.4.x style (still supported)
     * import dbConnector = require('node-caching-mysql-connector-with-redis');
     * dbConnector.QuaryCache(...);
     *
     * // v2.5.0 style (recommended)
     * import { QuaryCache, getCacheQuery } from 'node-caching-mysql-connector-with-redis';
     * QuaryCache(...);
     * ```
     */
    const connector: {
        QuaryCache: typeof QuaryCache;
        getCacheQuery: typeof getCacheQuery;
        getCacheQueryPagination: typeof getCacheQueryPagination;
        getArrayItem: typeof getArrayItem;
        addArrayItem: typeof addArrayItem;
        delKeyItem: typeof delKeyItem;
        delPrefixKeyItem: typeof delPrefixKeyItem;
        getRedisClient: typeof getRedisClient;
    };

    export default connector;
}
