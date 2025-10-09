const { expect } = require('chai');
const {
    generateCacheKey,
    createParameterHash,
    extractTableName,
    extractWhereConditions,
    extractColumnNames,
    enableAutoKey,
    isAutoKeyEnabled,
    _generateDetailedKey,
    _generateSimpleKey
} = require('../core/autoKey');

describe('Auto Key Generation (v2.6.0)', () => {
    afterEach(() => {
        delete process.env.CORE_AUTO_FEATURES;
        enableAutoKey({ enabled: false });
    });

    describe('enableAutoKey / isAutoKeyEnabled', () => {
        it('should be disabled by default', () => {
            expect(isAutoKeyEnabled()).to.be.false;
        });

        it('should enable via function call', () => {
            enableAutoKey({ enabled: true });
            expect(isAutoKeyEnabled()).to.be.true;
        });

        it('should enable via env variable', () => {
            process.env.CORE_AUTO_FEATURES = 'true';
            expect(isAutoKeyEnabled()).to.be.true;
        });

        it('should disable explicitly', () => {
            enableAutoKey({ enabled: false });
            expect(isAutoKeyEnabled()).to.be.false;
        });
    });

    describe('createParameterHash', () => {
        it('should return "all" for empty parameters', () => {
            expect(createParameterHash([])).to.equal('all');
            expect(createParameterHash(null)).to.equal('all');
        });

        it('should create 8-character hash', () => {
            const hash = createParameterHash([123, 'active']);
            expect(hash).to.be.a('string');
            expect(hash.length).to.equal(8);
        });

        it('should create consistent hash for same parameters', () => {
            const hash1 = createParameterHash([123, 'active']);
            const hash2 = createParameterHash([123, 'active']);
            expect(hash1).to.equal(hash2);
        });

        it('should create different hash for different parameters', () => {
            const hash1 = createParameterHash([123, 'active']);
            const hash2 = createParameterHash([123, 'inactive']);
            expect(hash1).to.not.equal(hash2);
        });
    });

    describe('extractTableName', () => {
        it('should extract table from SELECT query', () => {
            expect(extractTableName('SELECT * FROM users')).to.equal('users');
            expect(extractTableName('SELECT id FROM `orders`')).to.equal('orders');
            expect(extractTableName('select name from products')).to.equal('products');
        });

        it('should extract table from INSERT query', () => {
            expect(extractTableName('INSERT INTO users (name) VALUES (?)')).to.equal('users');
            expect(extractTableName('INSERT INTO `orders` SET id = ?')).to.equal('orders');
        });

        it('should extract table from UPDATE query', () => {
            expect(extractTableName('UPDATE users SET name = ?')).to.equal('users');
            expect(extractTableName('UPDATE `orders` SET status = ?')).to.equal('orders');
        });

        it('should extract table from DELETE query', () => {
            expect(extractTableName('DELETE FROM users WHERE id = ?')).to.equal('users');
            expect(extractTableName('DELETE FROM `orders`')).to.equal('orders');
        });

        it('should return null for complex queries', () => {
            expect(extractTableName('SHOW TABLES')).to.be.null;
            expect(extractTableName('CREATE TABLE users')).to.be.null;
        });
    });

    describe('extractWhereConditions', () => {
        it('should return empty array for no WHERE clause', () => {
            expect(extractWhereConditions('SELECT * FROM users')).to.deep.equal([]);
        });

        it('should extract single condition', () => {
            const conditions = extractWhereConditions('SELECT * FROM users WHERE id = ?');
            expect(conditions).to.have.lengthOf(1);
            expect(conditions[0]).to.include('id');
        });

        it('should extract multiple AND conditions', () => {
            const conditions = extractWhereConditions(
                'SELECT * FROM users WHERE id = ? AND status = ?'
            );
            expect(conditions.length).to.be.greaterThan(1);
        });

        it('should extract multiple OR conditions', () => {
            const conditions = extractWhereConditions(
                'SELECT * FROM users WHERE status = ? OR role = ?'
            );
            expect(conditions.length).to.be.greaterThan(1);
        });

        it('should stop at ORDER BY', () => {
            const conditions = extractWhereConditions(
                'SELECT * FROM users WHERE id = ? ORDER BY name'
            );
            expect(conditions).to.have.lengthOf(1);
        });

        it('should stop at LIMIT', () => {
            const conditions = extractWhereConditions(
                'SELECT * FROM users WHERE id = ? LIMIT 10'
            );
            expect(conditions).to.have.lengthOf(1);
        });
    });

    describe('extractColumnNames', () => {
        it('should extract column from = operator', () => {
            const columns = extractColumnNames(['id = ?']);
            expect(columns).to.deep.equal(['id']);
        });

        it('should extract column from comparison operators', () => {
            expect(extractColumnNames(['age > ?'])).to.deep.equal(['age']);
            expect(extractColumnNames(['price < ?'])).to.deep.equal(['price']);
            expect(extractColumnNames(['count >= ?'])).to.deep.equal(['count']);
        });

        it('should extract column from IN operator', () => {
            const columns = extractColumnNames(['status IN (?)']);
            expect(columns).to.deep.equal(['status']);
        });

        it('should extract column from LIKE operator', () => {
            const columns = extractColumnNames(['name LIKE ?']);
            expect(columns).to.deep.equal(['name']);
        });

        it('should extract multiple columns', () => {
            const columns = extractColumnNames(['id = ?', 'status = ?', 'company_id = ?']);
            expect(columns).to.have.lengthOf(3);
            expect(columns).to.include('id');
            expect(columns).to.include('status');
            expect(columns).to.include('company_id');
        });

        it('should sort columns for stable keys', () => {
            const columns1 = extractColumnNames(['company_id = ?', 'id = ?']);
            const columns2 = extractColumnNames(['id = ?', 'company_id = ?']);
            expect(columns1).to.deep.equal(columns2);
        });

        it('should normalize to lowercase', () => {
            const columns = extractColumnNames(['UserId = ?', 'STATUS = ?']);
            expect(columns).to.include('userid');
            expect(columns).to.include('status');
        });
    });

    describe('generateDetailedKey', () => {
        it('should generate key for simple SELECT with WHERE', () => {
            const key = _generateDetailedKey('SELECT * FROM users WHERE id = ?', [123]);
            expect(key).to.include('users');
            expect(key).to.include('id');
        });

        it('should generate key with multiple columns sorted', () => {
            const key1 = _generateDetailedKey(
                'SELECT * FROM orders WHERE user_id = ? AND status = ?',
                [123, 'active']
            );
            const key2 = _generateDetailedKey(
                'SELECT * FROM orders WHERE status = ? AND user_id = ?',
                ['active', 123]
            );

            // Keys should have same structure (sorted columns)
            expect(key1).to.include('orders');
            expect(key2).to.include('orders');
        });

        it('should generate "table:all" for no WHERE clause', () => {
            const key = _generateDetailedKey('SELECT * FROM users', []);
            expect(key).to.equal('users:all');
        });

        it('should fallback to hash for complex queries', () => {
            const key = _generateDetailedKey('SELECT * FROM users WHERE status IN (?)', [
                ['active', 'pending']
            ]);
            expect(key).to.include('users:');
        });

        it('should fallback to query:hash when table name cannot be extracted', () => {
            const key = _generateDetailedKey('SHOW TABLES', []);
            expect(key).to.match(/^query:[a-f0-9]{8}$/);
        });

        it('should handle complex WHERE without extractable columns', () => {
            // WHERE clause exists but columns can't be extracted (function call)
            const key = _generateDetailedKey('SELECT * FROM users WHERE RAND() < 0.5', [123]);
            // Should fallback to table:paramHash
            expect(key).to.match(/^users:[a-f0-9]{8}$/);
        });
    });

    describe('generateSimpleKey', () => {
        it('should generate table:hash format', () => {
            const key = _generateSimpleKey('SELECT * FROM users WHERE id = ?', [123]);
            expect(key).to.match(/^users:[a-f0-9]{8}$/);
        });

        it('should generate consistent hash for same params', () => {
            const key1 = _generateSimpleKey('SELECT * FROM users WHERE id = ?', [123]);
            const key2 = _generateSimpleKey('SELECT * FROM users WHERE id = ?', [123]);
            expect(key1).to.equal(key2);
        });

        it('should generate different hash for different params', () => {
            const key1 = _generateSimpleKey('SELECT * FROM users WHERE id = ?', [123]);
            const key2 = _generateSimpleKey('SELECT * FROM users WHERE id = ?', [456]);
            expect(key1).to.not.equal(key2);
        });

        it('should handle complex parameter objects', () => {
            const key = _generateSimpleKey('SELECT * FROM orders WHERE data = ?', [
                { status: 'active', user_id: 123, items: [1, 2, 3] }
            ]);
            expect(key).to.match(/^orders:[a-f0-9]{8}$/);
        });

        it('should fallback to query:hash when table name cannot be extracted', () => {
            const key = _generateSimpleKey('DESCRIBE users', []);
            expect(key).to.match(/^query:[a-f0-9]{8}$/);
        });
    });

    describe('generateCacheKey (main function)', () => {
        describe('Auto strategy (default)', () => {
            it('should use detailed key for 1-3 parameters', () => {
                const key = generateCacheKey('SELECT * FROM users WHERE id = ?', [123]);
                expect(key).to.include('users');
                expect(key).to.include('id');
            });

            it('should use simple key for 4+ parameters', () => {
                const key = generateCacheKey(
                    'SELECT * FROM orders WHERE a = ? AND b = ? AND c = ? AND d = ?',
                    [1, 2, 3, 4]
                );
                expect(key).to.match(/^orders:[a-f0-9]{8}$/);
            });
        });

        describe('Strategy: simple', () => {
            it('should always use simple hash', () => {
                const key = generateCacheKey(
                    'SELECT * FROM users WHERE id = ?',
                    [123],
                    { strategy: 'simple' }
                );
                expect(key).to.match(/^users:[a-f0-9]{8}$/);
            });
        });

        describe('Strategy: detailed', () => {
            it('should always use detailed key', () => {
                const key = generateCacheKey(
                    'SELECT * FROM orders WHERE a = ? AND b = ? AND c = ? AND d = ?',
                    [1, 2, 3, 4],
                    { strategy: 'detailed' }
                );
                expect(key).to.include('orders');
                expect(key).to.not.match(/^orders:[a-f0-9]{8}$/); // Not simple format
            });
        });

        describe('Real-world scenarios', () => {
            it('should handle user lookup query', () => {
                const key = generateCacheKey('SELECT * FROM users WHERE id = ?', [123]);
                expect(key).to.include('users:id');
            });

            it('should handle filtered list query', () => {
                const key = generateCacheKey(
                    'SELECT * FROM orders WHERE user_id = ? AND status = ?',
                    [123, 'active']
                );
                expect(key).to.include('orders');
                expect(key).to.include('status');
                expect(key).to.include('user_id');
            });

            it('should handle pagination query', () => {
                const key = generateCacheKey(
                    'SELECT * FROM products WHERE category = ? ORDER BY price LIMIT 10',
                    [5]
                );
                expect(key).to.include('products');
                expect(key).to.include('category');
            });

            it('should handle complex JOIN query', () => {
                const key = generateCacheKey(
                    'SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id WHERE u.id = ?',
                    [123]
                );
                // Should fallback to simple or query hash
                expect(key).to.be.a('string');
                expect(key.length).to.be.greaterThan(0);
            });
        });

        describe('Normalization (WHERE order independence)', () => {
            it('should generate same key for different WHERE order', () => {
                const key1 = generateCacheKey(
                    'SELECT * FROM orders WHERE user_id = ? AND status = ?',
                    [123, 'active']
                );
                const key2 = generateCacheKey(
                    'SELECT * FROM orders WHERE status = ? AND user_id = ?',
                    ['active', 123]
                );

                // Column names should be sorted, so keys have same structure
                const extractColumns = (key) => key.split(':').slice(1, -1).sort().join(':');
                expect(extractColumns(key1)).to.equal(extractColumns(key2));
            });
        });
    });
});
