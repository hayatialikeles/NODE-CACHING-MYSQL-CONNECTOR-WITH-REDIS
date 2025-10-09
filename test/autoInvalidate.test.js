/**
 * Auto Invalidation Tests (v2.6.0)
 *
 * Tests for automatic cache invalidation on write operations
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire');

describe('Auto Invalidation (v2.6.0)', () => {
    let autoInvalidate;
    let originalEnv;

    beforeEach(() => {
        // Save original env
        originalEnv = process.env.CORE_AUTO_INVALIDATION;
        delete process.env.CORE_AUTO_INVALIDATION;

        // Fresh module for each test
        delete require.cache[require.resolve('../core/autoInvalidate')];
        autoInvalidate = require('../core/autoInvalidate');
    });

    afterEach(() => {
        // Restore env
        if (originalEnv !== undefined) {
            process.env.CORE_AUTO_INVALIDATION = originalEnv;
        } else {
            delete process.env.CORE_AUTO_INVALIDATION;
        }
    });

    describe('enableAutoInvalidation / isAutoInvalidationEnabled', () => {
        it('should be disabled by default', () => {
            expect(autoInvalidate.isAutoInvalidationEnabled()).to.be.false;
        });

        it('should enable via function call', () => {
            autoInvalidate.enableAutoInvalidation({ enabled: true });
            expect(autoInvalidate.isAutoInvalidationEnabled()).to.be.true;
        });

        it('should enable via env variable', () => {
            process.env.CORE_AUTO_INVALIDATION = 'true';
            expect(autoInvalidate.isAutoInvalidationEnabled()).to.be.true;
        });

        it('should disable explicitly', () => {
            autoInvalidate.enableAutoInvalidation({ enabled: false });
            expect(autoInvalidate.isAutoInvalidationEnabled()).to.be.false;
        });

        it('should enable by default when config object is empty', () => {
            autoInvalidate.enableAutoInvalidation({});
            expect(autoInvalidate.isAutoInvalidationEnabled()).to.be.true;
        });

        it('should enable when config.enabled is not explicitly false', () => {
            autoInvalidate.enableAutoInvalidation({ enabled: true });
            expect(autoInvalidate.isAutoInvalidationEnabled()).to.be.true;
        });

        it('should accept custom table rules', () => {
            autoInvalidate.enableAutoInvalidation({
                enabled: true,
                tables: {
                    users: ['users_*', 'profiles_*'],
                    orders: 'orders_*'
                }
            });
            expect(autoInvalidate.isAutoInvalidationEnabled()).to.be.true;
        });

        it('should handle empty tables config', () => {
            autoInvalidate.enableAutoInvalidation({
                enabled: true,
                tables: {}
            });
            expect(autoInvalidate.isAutoInvalidationEnabled()).to.be.true;
        });
    });

    describe('isWriteOperation', () => {
        it('should detect INSERT operation', () => {
            expect(autoInvalidate.isWriteOperation('INSERT INTO users (name) VALUES (?)')).to.be.true;
        });

        it('should detect UPDATE operation', () => {
            expect(autoInvalidate.isWriteOperation('UPDATE users SET name = ? WHERE id = ?')).to.be.true;
        });

        it('should detect DELETE operation', () => {
            expect(autoInvalidate.isWriteOperation('DELETE FROM users WHERE id = ?')).to.be.true;
        });

        it('should detect REPLACE operation', () => {
            expect(autoInvalidate.isWriteOperation('REPLACE INTO users (id, name) VALUES (?, ?)')).to.be.true;
        });

        it('should return false for SELECT', () => {
            expect(autoInvalidate.isWriteOperation('SELECT * FROM users WHERE id = ?')).to.be.false;
        });

        it('should be case insensitive', () => {
            expect(autoInvalidate.isWriteOperation('insert into users...')).to.be.true;
            expect(autoInvalidate.isWriteOperation('UPDATE users...')).to.be.true;
            expect(autoInvalidate.isWriteOperation('DeLeTe FROM users...')).to.be.true;
        });

        it('should handle queries with leading whitespace', () => {
            expect(autoInvalidate.isWriteOperation('  INSERT INTO users...')).to.be.true;
            expect(autoInvalidate.isWriteOperation('\n\tUPDATE users...')).to.be.true;
        });
    });

    describe('extractTableName', () => {
        describe('INSERT queries', () => {
            it('should extract table from INSERT INTO', () => {
                expect(autoInvalidate.extractTableName('INSERT INTO users (name) VALUES (?)')).to.equal('users');
            });

            it('should extract table with backticks', () => {
                expect(autoInvalidate.extractTableName('INSERT INTO `users` (name) VALUES (?)')).to.equal('users');
            });

            it('should handle lowercase', () => {
                expect(autoInvalidate.extractTableName('insert into users (name) values (?)')).to.equal('users');
            });
        });

        describe('UPDATE queries', () => {
            it('should extract table from UPDATE', () => {
                expect(autoInvalidate.extractTableName('UPDATE users SET name = ? WHERE id = ?')).to.equal('users');
            });

            it('should extract table with backticks', () => {
                expect(autoInvalidate.extractTableName('UPDATE `users` SET name = ?')).to.equal('users');
            });

            it('should handle lowercase', () => {
                expect(autoInvalidate.extractTableName('update users set name = ?')).to.equal('users');
            });
        });

        describe('DELETE queries', () => {
            it('should extract table from DELETE FROM', () => {
                expect(autoInvalidate.extractTableName('DELETE FROM users WHERE id = ?')).to.equal('users');
            });

            it('should extract table with backticks', () => {
                expect(autoInvalidate.extractTableName('DELETE FROM `users` WHERE id = ?')).to.equal('users');
            });

            it('should handle lowercase', () => {
                expect(autoInvalidate.extractTableName('delete from users where id = ?')).to.equal('users');
            });
        });

        describe('REPLACE queries', () => {
            it('should extract table from REPLACE INTO', () => {
                expect(autoInvalidate.extractTableName('REPLACE INTO users (id, name) VALUES (?, ?)')).to.equal('users');
            });

            it('should extract table with backticks', () => {
                expect(autoInvalidate.extractTableName('REPLACE INTO `users` VALUES (?)')).to.equal('users');
            });

            it('should handle lowercase', () => {
                expect(autoInvalidate.extractTableName('replace into users values (?)')).to.equal('users');
            });
        });

        describe('Edge cases', () => {
            it('should return null for SELECT query', () => {
                expect(autoInvalidate.extractTableName('SELECT * FROM users')).to.be.null;
            });

            it('should return null for complex/unsupported queries', () => {
                expect(autoInvalidate.extractTableName('CREATE TABLE users...')).to.be.null;
                expect(autoInvalidate.extractTableName('DROP TABLE users')).to.be.null;
            });

            it('should extract from multi-line queries', () => {
                const sql = `
                    INSERT INTO users
                    (name, email)
                    VALUES (?, ?)
                `;
                expect(autoInvalidate.extractTableName(sql)).to.equal('users');
            });
        });
    });

    describe('getInvalidationPatterns', () => {
        beforeEach(() => {
            // Reset to default state
            autoInvalidate.enableAutoInvalidation({ enabled: true, tables: {} });
        });

        it('should return empty array for null table', () => {
            expect(autoInvalidate.getInvalidationPatterns(null)).to.deep.equal([]);
        });

        it('should return empty array for undefined table', () => {
            expect(autoInvalidate.getInvalidationPatterns(undefined)).to.deep.equal([]);
        });

        it('should return default patterns for unknown table', () => {
            const patterns = autoInvalidate.getInvalidationPatterns('users');
            expect(patterns).to.deep.equal(['users_*', 'users:*']);
        });

        it('should return custom pattern (string) if defined', () => {
            autoInvalidate.enableAutoInvalidation({
                enabled: true,
                tables: {
                    users: 'custom-users-*'
                }
            });

            const patterns = autoInvalidate.getInvalidationPatterns('users');
            expect(patterns).to.deep.equal(['custom-users-*']);
        });

        it('should return custom patterns (array) if defined', () => {
            autoInvalidate.enableAutoInvalidation({
                enabled: true,
                tables: {
                    users: ['users_*', 'profiles_*', 'sessions_*']
                }
            });

            const patterns = autoInvalidate.getInvalidationPatterns('users');
            expect(patterns).to.deep.equal(['users_*', 'profiles_*', 'sessions_*']);
        });

        it('should handle multiple tables with different rules', () => {
            autoInvalidate.enableAutoInvalidation({
                enabled: true,
                tables: {
                    users: ['users_*', 'profiles_*'],
                    orders: 'orders_*',
                    products: ['products_*']
                }
            });

            expect(autoInvalidate.getInvalidationPatterns('users')).to.deep.equal(['users_*', 'profiles_*']);
            expect(autoInvalidate.getInvalidationPatterns('orders')).to.deep.equal(['orders_*']);
            expect(autoInvalidate.getInvalidationPatterns('products')).to.deep.equal(['products_*']);
        });
    });

    describe('determineInvalidationPatterns (main function)', () => {
        beforeEach(() => {
            // Reset state
            delete process.env.CORE_AUTO_INVALIDATION;
            autoInvalidate.enableAutoInvalidation({ enabled: false });
        });

        describe('Manual pattern priority', () => {
            it('should return manual pattern (string) when provided', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns(
                    'INSERT INTO users...',
                    'manual-pattern-*'
                );
                expect(patterns).to.deep.equal(['manual-pattern-*']);
            });

            it('should return manual pattern (array) when provided', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns(
                    'INSERT INTO users...',
                    ['pattern1-*', 'pattern2-*']
                );
                expect(patterns).to.deep.equal(['pattern1-*', 'pattern2-*']);
            });

            it('should use manual pattern even if auto invalidation is disabled', () => {
                autoInvalidate.enableAutoInvalidation({ enabled: false });
                const patterns = autoInvalidate.determineInvalidationPatterns(
                    'INSERT INTO users...',
                    'manual-*'
                );
                expect(patterns).to.deep.equal(['manual-*']);
            });
        });

        describe('Auto invalidation disabled', () => {
            it('should return empty array when disabled', () => {
                autoInvalidate.enableAutoInvalidation({ enabled: false });
                const patterns = autoInvalidate.determineInvalidationPatterns('INSERT INTO users...');
                expect(patterns).to.deep.equal([]);
            });

            it('should return empty array when no manual pattern and disabled', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns('UPDATE users SET...');
                expect(patterns).to.deep.equal([]);
            });
        });

        describe('Auto invalidation enabled', () => {
            beforeEach(() => {
                autoInvalidate.enableAutoInvalidation({ enabled: true });
            });

            it('should return patterns for INSERT query', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns('INSERT INTO users (name) VALUES (?)');
                expect(patterns).to.deep.equal(['users_*', 'users:*']);
            });

            it('should return patterns for UPDATE query', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns('UPDATE orders SET status = ? WHERE id = ?');
                expect(patterns).to.deep.equal(['orders_*', 'orders:*']);
            });

            it('should return patterns for DELETE query', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns('DELETE FROM products WHERE id = ?');
                expect(patterns).to.deep.equal(['products_*', 'products:*']);
            });

            it('should return patterns for REPLACE query', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns('REPLACE INTO users (id, name) VALUES (?, ?)');
                expect(patterns).to.deep.equal(['users_*', 'users:*']);
            });

            it('should return empty array for SELECT query', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns('SELECT * FROM users WHERE id = ?');
                expect(patterns).to.deep.equal([]);
            });

            it('should return empty array for non-write operations', () => {
                expect(autoInvalidate.determineInvalidationPatterns('SHOW TABLES')).to.deep.equal([]);
                expect(autoInvalidate.determineInvalidationPatterns('DESCRIBE users')).to.deep.equal([]);
            });

            it('should use custom rules when configured', () => {
                autoInvalidate.enableAutoInvalidation({
                    enabled: true,
                    tables: {
                        users: ['users_*', 'profiles_*', 'sessions_*']
                    }
                });

                const patterns = autoInvalidate.determineInvalidationPatterns('INSERT INTO users (name) VALUES (?)');
                expect(patterns).to.deep.equal(['users_*', 'profiles_*', 'sessions_*']);
            });
        });

        describe('Real-world scenarios', () => {
            beforeEach(() => {
                autoInvalidate.enableAutoInvalidation({
                    enabled: true,
                    tables: {
                        users: ['users_*', 'profiles_*'],
                        orders: ['orders_*', 'analytics_*'],
                        products: 'products_*'
                    }
                });
            });

            it('should handle user registration (INSERT)', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns(
                    'INSERT INTO users (name, email) VALUES (?, ?)'
                );
                expect(patterns).to.deep.equal(['users_*', 'profiles_*']);
            });

            it('should handle order update', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns(
                    'UPDATE orders SET status = ? WHERE id = ?'
                );
                expect(patterns).to.deep.equal(['orders_*', 'analytics_*']);
            });

            it('should handle product deletion', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns(
                    'DELETE FROM products WHERE id = ?'
                );
                expect(patterns).to.deep.equal(['products_*']);
            });

            it('should use defaults for unconfigured table', () => {
                const patterns = autoInvalidate.determineInvalidationPatterns(
                    'INSERT INTO categories (name) VALUES (?)'
                );
                expect(patterns).to.deep.equal(['categories_*', 'categories:*']);
            });
        });
    });
});
