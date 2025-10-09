/**
 * Auto Invalidation Module (v2.6.0)
 *
 * Automatically invalidates cache when write operations (INSERT/UPDATE/DELETE) occur.
 * Disabled by default for backward compatibility.
 */

let autoInvalidationEnabled = false;
let invalidationRules = {};

/**
 * Enables auto invalidation feature
 * @param {Object} config - Configuration options
 * @param {boolean} config.enabled - Enable/disable auto invalidation
 * @param {Object} config.tables - Table-specific invalidation patterns
 */
function enableAutoInvalidation(config = {}) {
    autoInvalidationEnabled = config.enabled !== false;
    invalidationRules = config.tables || {};
}

/**
 * Checks if auto invalidation is enabled
 */
function isAutoInvalidationEnabled() {
    return autoInvalidationEnabled || process.env.CORE_AUTO_INVALIDATION === 'true';
}

/**
 * Extracts table name from SQL query
 * @param {string} sql - SQL query
 * @returns {string|null} - Table name or null
 */
function extractTableName(sql) {
    // INSERT INTO users...
    const insertMatch = sql.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
    if (insertMatch) return insertMatch[1];

    // UPDATE users SET...
    const updateMatch = sql.match(/UPDATE\s+`?(\w+)`?/i);
    if (updateMatch) return updateMatch[1];

    // DELETE FROM users...
    const deleteMatch = sql.match(/DELETE\s+FROM\s+`?(\w+)`?/i);
    if (deleteMatch) return deleteMatch[1];

    // REPLACE INTO users...
    const replaceMatch = sql.match(/REPLACE\s+INTO\s+`?(\w+)`?/i);
    if (replaceMatch) return replaceMatch[1];

    return null;
}

/**
 * Checks if SQL is a write operation
 * @param {string} sql - SQL query
 * @returns {boolean}
 */
function isWriteOperation(sql) {
    return /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql.trim());
}

/**
 * Gets invalidation patterns for a table
 * @param {string} tableName - Table name
 * @returns {Array<string>} - Array of cache key patterns to invalidate
 */
function getInvalidationPatterns(tableName) {
    if (!tableName) return [];

    // User-defined rules take priority
    if (invalidationRules[tableName]) {
        const rules = invalidationRules[tableName];
        return Array.isArray(rules) ? rules : [rules];
    }

    // Default patterns: tableName_* and tableName:*
    return [`${tableName}_*`, `${tableName}:*`];
}

/**
 * Determines which cache patterns should be invalidated for a query
 * @param {string} sql - SQL query
 * @param {string|null} manualPattern - Manual invalidation pattern (takes priority)
 * @returns {Array<string>} - Array of patterns to invalidate
 */
function determineInvalidationPatterns(sql, manualPattern = null) {
    // Manual pattern takes priority
    if (manualPattern) {
        return Array.isArray(manualPattern) ? manualPattern : [manualPattern];
    }

    // Auto invalidation only if enabled
    if (!isAutoInvalidationEnabled()) {
        return [];
    }

    // Check if this is a write operation
    if (!isWriteOperation(sql)) {
        return [];
    }

    // Extract table name and get patterns
    const tableName = extractTableName(sql);
    return getInvalidationPatterns(tableName);
}

module.exports = {
    enableAutoInvalidation,
    isAutoInvalidationEnabled,
    extractTableName,
    isWriteOperation,
    getInvalidationPatterns,
    determineInvalidationPatterns
};
