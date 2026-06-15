// Local JSON file-based database fallback for offline execution
const fs = require('fs');
const path = require('path');

// Use /tmp on Vercel/serverless environments, or fallback to relative local_data
const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
const DATA_DIR = isVercel ? path.join('/tmp', 'local_data') : path.join(__dirname, 'local_data');

// Ensure database directory exists
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {
    console.warn(`Warning: Failed to create local database directory at ${DATA_DIR}:`, e);
}

function getFilePath(table) {
    return path.join(DATA_DIR, `${table}.json`);
}

function readTable(table) {
    const file = getFilePath(table);
    if (!fs.existsSync(file)) {
        // Initial fallbacks for default outbreaks
        if (table === 'disease_outbreaks') {
            return [
                {
                    id: 'd1',
                    disease_name: 'Dengue Fever',
                    location: 'Kerala',
                    district: 'Ernakulam',
                    severity: 'high',
                    cases: 25,
                    source: 'WHO',
                    coordinates: { lat: 10.0168, lng: 76.3078 },
                    precautions: ['Use mosquito repellent', 'Remove stagnant water', 'Wear long sleeves'],
                    last_updated: new Date().toISOString()
                },
                {
                    id: 'd2',
                    disease_name: 'Malaria',
                    location: 'Kerala',
                    district: 'Kozhikode',
                    severity: 'medium',
                    cases: 15,
                    source: 'WHO',
                    coordinates: { lat: 11.2588, lng: 75.7804 },
                    precautions: ['Sleep under insecticide-treated bed nets', 'Spray indoor walls with insecticide'],
                    last_updated: new Date().toISOString()
                }
            ];
        }
        return [];
    }
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        console.error(`Error reading local table ${table}:`, e);
        return [];
    }
}

function writeTable(table, data) {
    const file = getFilePath(table);
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error(`Error writing local table ${table}:`, e);
    }
}

const localDb = {
    insert: (table, row) => {
        const rows = readTable(table);
        const newRow = { id: row.id || Math.random().toString(36).substring(2, 11), ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        rows.push(newRow);
        writeTable(table, rows);
        return newRow;
    },

    upsert: (table, row, conflictKeys = ['id']) => {
        const rows = readTable(table);
        const index = rows.findIndex((r) => conflictKeys.every((key) => r[key] === row[key]));
        const updatedRow = { ...row, updated_at: new Date().toISOString() };
        if (index !== -1) {
            rows[index] = { ...rows[index], ...updatedRow };
            writeTable(table, rows);
            return rows[index];
        } else {
            const newRow = { id: row.id || Math.random().toString(36).substring(2, 11), ...updatedRow, created_at: new Date().toISOString() };
            rows.push(newRow);
            writeTable(table, rows);
            return newRow;
        }
    },

    findSingle: (table, filterFn) => {
        const rows = readTable(table);
        return rows.find(filterFn) || null;
    },

    findMany: (table, filterFn = () => true, sortField = 'created_at', descending = true) => {
        const rows = readTable(table);
        const filtered = rows.filter(filterFn);
        return filtered.sort((a, b) => {
            const valA = a[sortField] || '';
            const valB = b[sortField] || '';
            if (valA < valB) return descending ? 1 : -1;
            if (valA > valB) return descending ? -1 : 1;
            return 0;
        });
    }
};

module.exports = localDb;
