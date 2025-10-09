const crypto = require('crypto');

/**
 * Auto Key Generation Module (v2.6.0)
 *
 * Automatically generates cache keys from SQL queries and parameters.
 * Disabled by default for backward compatibility.
 */

let autoKeyEnabled = false;

/**
 * Enables auto key generation feature
 * @param {Object} config - Configuration options
 */
function enableAutoKey(config = {}) {
    autoKeyEnabled = config.enabled !== false;
}

/**
 * Checks if auto key generation is enabled
 */
function isAutoKeyEnabled() {
    return autoKeyEnabled || process.env.CORE_AUTO_FEATURES === 'true';
}

/**
 * Creates a short hash from parameters
 * @param {Array} parameters - Query parameters
 * @returns {string} - 8-character hash
 */
function createParameterHash(parameters) {
    if (!parameters || parameters.length === 0) {
        return 'all';
    }

    return crypto
        .createHash('md5')
        .update(JSON.stringify(parameters))
        .digest('hex')
        .substring(0, 8);
}

/**
 * Extracts table name from SQL query
 * @param {string} sql - SQL query
 * @returns {string|null} - Table name or null
 */
function extractTableName(sql) {
    // SELECT FROM
    const selectMatch = sql.match(/FROM\s+`?(\w+)`?/i);
    if (selectMatch) return selectMatch[1];

    // INSERT INTO
    const insertMatch = sql.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
    if (insertMatch) return insertMatch[1];

    // UPDATE
    const updateMatch = sql.match(/UPDATE\s+`?(\w+)`?/i);
    if (updateMatch) return updateMatch[1];

    // DELETE FROM
    const deleteMatch = sql.match(/DELETE\s+FROM\s+`?(\w+)`?/i);
    if (deleteMatch) return deleteMatch[1];

    return null;
}

/**
 * Extracts WHERE conditions from SQL
 * @param {string} sql - SQL query
 * @returns {Array<string>} - Array of conditions
 */
function extractWhereConditions(sql) {
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER\s+BY|LIMIT|GROUP\s+BY|HAVING|$)/is);

    if (!whereMatch) {
        return [];
    }

    const whereClause = whereMatch[1].trim();

    // Split by AND/OR but preserve the column names
    const conditions = whereClause.split(/\s+(AND|OR)\s+/i)
        .filter(part => !/^(AND|OR)$/i.test(part.trim()));

    return conditions.map(c => c.trim());
}

/**
 * Extracts column names from WHERE conditions
 * @param {Array<string>} conditions - WHERE conditions
 * @returns {Array<string>} - Sorted column names
 */
function extractColumnNames(conditions) {
    const columns = [];

    for (const condition of conditions) {
        // Match: column_name = ?
        // Match: column_name > ?
        // Match: column_name IN (?)
        // Match: column_name LIKE ?
        const columnMatch = condition.match(/(\w+)\s*(?:=|>|<|>=|<=|!=|<>|IN|LIKE|NOT\s+IN|NOT\s+LIKE)/i);

        if (columnMatch) {
            columns.push(columnMatch[1].toLowerCase());
        }
    }

    // Sort for stable key generation
    return columns.sort();
}

/**
 * Generates cache key with detailed column information
 * @param {string} sql - SQL query
 * @param {Array} parameters - Query parameters
 * @returns {string} - Generated cache key
 */
function generateDetailedKey(sql, parameters) {
    const tableName = extractTableName(sql);

    if (!tableName) {
        // Fallback for complex queries
        const queryHash = crypto
            .createHash('md5')
            .update(sql)
            .digest('hex')
            .substring(0, 8);
        return `query:${queryHash}`;
    }

    const conditions = extractWhereConditions(sql);

    if (conditions.length === 0) {
        // No WHERE clause - generic cache key
        return `${tableName}:all`;
    }

    const columns = extractColumnNames(conditions);

    if (columns.length === 0) {
        // Complex WHERE clause without extractable columns
        const paramHash = createParameterHash(parameters);
        return `${tableName}:${paramHash}`;
    }

    // Build key with column names and parameter hash
    // Example: users:id:company_id:a7b3c2d1
    const columnPart = columns.join(':');
    const paramHash = createParameterHash(parameters);

    return `${tableName}:${columnPart}:${paramHash}`;
}

/**
 * Generates cache key with simple parameter hash
 * @param {string} sql - SQL query
 * @param {Array} parameters - Query parameters
 * @returns {string} - Generated cache key
 */
function generateSimpleKey(sql, parameters) {
    const tableName = extractTableName(sql);

    if (!tableName) {
        const queryHash = crypto
            .createHash('md5')
            .update(sql)
            .digest('hex')
            .substring(0, 8);
        return `query:${queryHash}`;
    }

    const paramHash = createParameterHash(parameters);
    return `${tableName}:${paramHash}`;
}

/**
 * Main function: Generates cache key from SQL and parameters
 *
 * Strategy:
 * - Simple queries (1-3 params): Detailed key with column names
 * - Complex queries (4+ params): Simple hash-based key
 *
 * @param {string} sql - SQL query
 * @param {Array} parameters - Query parameters
 * @param {Object} options - Options { strategy: 'detailed'|'simple' }
 * @returns {string} - Generated cache key
 */
function generateCacheKey(sql, parameters, options = {}) {
    const strategy = options.strategy || 'auto';

    if (strategy === 'simple') {
        return generateSimpleKey(sql, parameters);
    }

    if (strategy === 'detailed') {
        return generateDetailedKey(sql, parameters);
    }

    // Auto strategy: choose based on parameter count
    if (!parameters || parameters.length <= 3) {
        return generateDetailedKey(sql, parameters);
    }

    return generateSimpleKey(sql, parameters);
}

module.exports = {
    enableAutoKey,
    isAutoKeyEnabled,
    generateCacheKey,
    createParameterHash,
    extractTableName,
    extractWhereConditions,
    extractColumnNames,

    // For testing
    _generateDetailedKey: generateDetailedKey,
    _generateSimpleKey: generateSimpleKey
};
