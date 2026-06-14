const { createClient } = require('@supabase/supabase-js');
const localDb = require('./local_db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

function isNetworkFetchFailure(error) {
    if (!error) return false;
    const message = (error.message ? String(error.message) : '').toLowerCase();
    const details = (error.details ? String(error.details) : '').toLowerCase();
    return message.includes('fetch failed') || details.includes('fetch failed') || message.includes('failed to fetch') || details.includes('enotfound');
}

class MockBuilder {
    constructor(table) {
        this.table = table;
        this.filters = [];
        this.sortField = 'created_at';
        this.descending = true;
        this.limitNum = null;
        this.isSingle = false;
        this.isMaybeSingle = false;
        this.upsertData = null;
        this.insertData = null;
        this.updateData = null;
        this.selectFields = '*';
        this.conflictKeys = ['id'];
    }

    select(fields = '*') {
        this.selectFields = fields;
        return this;
    }

    eq(col, val) {
        this.filters.push((row) => row[col] === val);
        return this;
    }

    order(field, options = {}) {
        this.sortField = field;
        this.descending = options.ascending === false;
        return this;
    }

    limit(num) {
        this.limitNum = num;
        return this;
    }

    single() {
        this.isSingle = true;
        return this;
    }

    maybeSingle() {
        this.isMaybeSingle = true;
        return this;
    }

    insert(data) {
        this.insertData = data;
        return this;
    }

    update(data) {
        this.updateData = data;
        return this;
    }

    upsert(data, options = {}) {
        this.upsertData = data;
        if (options.onConflict) {
            this.conflictKeys = options.onConflict.split(',').map(k => k.trim());
        }
        return this;
    }

    not(col, op, val) {
        if (op === 'is' && val === null) {
            this.filters.push((row) => row[col] !== null && row[col] !== undefined);
        } else {
            this.filters.push((row) => row[col] !== val);
        }
        return this;
    }

    delete() {
        this.isDelete = true;
        return this;
    }

    lt(col, val) {
        this.filters.push((row) => row[col] < val);
        return this;
    }

    gt(col, val) {
        this.filters.push((row) => row[col] > val);
        return this;
    }

    lte(col, val) {
        this.filters.push((row) => row[col] <= val);
        return this;
    }

    gte(col, val) {
        this.filters.push((row) => row[col] >= val);
        return this;
    }

    then(onfulfilled, onrejected) {
        let resultData = null;
        let resultError = null;

        try {
            if (this.insertData) {
                const arr = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
                const inserted = arr.map(row => localDb.insert(this.table, row));
                resultData = Array.isArray(this.insertData) ? inserted : inserted[0];
            } else if (this.updateData) {
                const rows = localDb.findMany(this.table, (r) => this.filters.every(f => f(r)));
                rows.forEach(r => {
                    localDb.upsert(this.table, { ...r, ...this.updateData }, ['id']);
                });
                resultData = rows.length === 1 ? rows[0] : rows;
            } else if (this.upsertData) {
                const arr = Array.isArray(this.upsertData) ? this.upsertData : [this.upsertData];
                const upserted = arr.map(row => localDb.upsert(this.table, row, this.conflictKeys));
                resultData = Array.isArray(this.upsertData) ? upserted : upserted[0];
            } else if (this.isDelete) {
                const filterFn = (row) => this.filters.every(f => f(row));
                const allRows = localDb.findMany(this.table, () => true);
                const toDelete = allRows.filter(filterFn);
                const remaining = allRows.filter(r => !toDelete.some(d => d.id === r.id));
                
                const fs = require('fs');
                const path = require('path');
                const file = path.join(__dirname, 'local_data', `${this.table}.json`);
                fs.writeFileSync(file, JSON.stringify(remaining, null, 2), 'utf8');
                
                resultData = toDelete;
            } else {
                // SELECT
                const filterFn = (row) => this.filters.every(f => f(row));
                if (this.isSingle || this.isMaybeSingle) {
                    resultData = localDb.findSingle(this.table, filterFn);
                } else {
                    resultData = localDb.findMany(this.table, filterFn, this.sortField, this.descending);
                    if (this.limitNum) {
                        resultData = resultData.slice(0, this.limitNum);
                    }
                }
            }
        } catch (e) {
            resultError = e;
        }

        return Promise.resolve({ data: resultData, error: resultError }).then(onfulfilled, onrejected);
    }
}

class ProxyQueryBuilder {
    constructor(table, originalQuery, actions = [], fallbackState = { useFallback: false }) {
        this.table = table;
        this.originalQuery = originalQuery;
        this.actions = actions;
        this.fallbackState = fallbackState;
    }

    static create(table, originalQuery, actions = [], fallbackState = { useFallback: false }) {
        const builder = new ProxyQueryBuilder(table, originalQuery, actions, fallbackState);
        return new Proxy(builder, {
            get(target, prop, receiver) {
                if (prop === 'then') {
                    if (target.fallbackState.useFallback) {
                        return target.replayOnMock().then;
                    }
                    
                    const originalThen = target.originalQuery.then;
                    return function(onfulfilled, onrejected) {
                        return originalThen.call(target.originalQuery, (result) => {
                            if (result.error && isNetworkFetchFailure(result.error)) {
                                console.log(`Supabase wrapper: Runtime fetch error detected on table "${target.table}". Gracefully switching to offline local DB.`);
                                target.fallbackState.useFallback = true;
                                return target.replayOnMock().then(onfulfilled, onrejected);
                            }
                            return onfulfilled(result);
                        }, (err) => {
                            if (isNetworkFetchFailure(err)) {
                                target.fallbackState.useFallback = true;
                                return target.replayOnMock().then(onfulfilled, onrejected);
                            }
                            if (onrejected) return onrejected(err);
                            throw err;
                        });
                    };
                }

                if (typeof target.originalQuery[prop] === 'function') {
                    return function(...args) {
                        const nextQuery = target.originalQuery[prop](...args);
                        const nextActions = [...target.actions, { method: prop, args }];
                        return ProxyQueryBuilder.create(target.table, nextQuery, nextActions, target.fallbackState);
                    };
                }

                return target[prop] !== undefined ? target[prop] : target.originalQuery[prop];
            }
        });
    }

    replayOnMock() {
        let mock = new MockBuilder(this.table);
        for (const action of this.actions) {
            if (typeof mock[action.method] === 'function') {
                mock = mock[action.method](...action.args);
            }
        }
        return mock;
    }
}

function createClientWrapper(url, key, options) {
    let realClient = null;
    const fallbackState = { useFallback: false };

    if (!url || !key) {
        console.warn('Supabase URL or Key is missing. Defaulting to offline local DB fallback.');
        fallbackState.useFallback = true;
    } else {
        try {
            realClient = createClient(url, key, options);
        } catch (e) {
            console.error('Failed to initialize Supabase client:', e);
            fallbackState.useFallback = true;
        }
    }

    return {
        auth: realClient ? realClient.auth : {
            signUp: async () => ({ data: { user: null }, error: new Error('Supabase Client not initialized') }),
            signInWithPassword: async () => ({ data: { user: null }, error: new Error('Supabase Client not initialized') }),
            signOut: async () => ({ error: null })
        },
        from: (table) => {
            if (fallbackState.useFallback || !realClient) {
                return new MockBuilder(table);
            }
            return ProxyQueryBuilder.create(table, realClient.from(table), [], fallbackState);
        }
    };
}

module.exports = {
    createClient: createClientWrapper
};

