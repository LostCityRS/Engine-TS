import DbRowType from '#/cache/config/DbRowType.js';
import DbTableType from '#/cache/config/DbTableType.js';
import { printWarning } from '#/util/Logger.js';

// DbTableIndex is just an optimization to pre-compute lookups
export default class DbTableIndex {
    // Map of <TableColumnPacked, Map of <Value, Row IDs>>
    private static rows: Map<number, Map<string | number, number[]>> = new Map();

    static init() {
        this.rows = new Map();

        for (let tableId = 0; tableId < DbTableType.count; tableId++) {
            const table = DbTableType.get(tableId);
            const { types, props } = table;

            let indexed = false;
            for (let column = 0; column < types.length; column++) {
                if ((props[column] & DbTableType.INDEXED) !== 0) {
                    indexed = true;
                    break;
                }
            }
            if (!indexed) {
                continue;
            }

            const rows = DbRowType.getInTable(tableId);

            for (const row of rows) {
                for (let column = 0; column < row.columnValues.length; column++) {
                    if ((props[column] & DbTableType.INDEXED) === 0) {
                        continue;
                    }

                    // multiple types in a column are known as a tuple
                    const types = row.types[column];

                    if (types.length > 1) {
                        // indexed tuple
                        for (let fieldId = 0; fieldId < row.columnValues[column].length / types.length; fieldId++) {
                            for (let typeId = 0; typeId < types.length; typeId++) {
                                const tableColumnPacked = ((table.id & 0xffff) << 12) | ((column & 0x7f) << 4) | (typeId & 0xf);
                                const index = typeId + fieldId * types.length;
                                const value = row.columnValues[column][index];

                                const lookup: Map<string | number, number[]> = this.rows.get(tableColumnPacked) ?? new Map();

                                const rowIds = lookup.get(value) ?? [];
                                rowIds.push(row.id);

                                lookup.set(value, rowIds);
                                this.rows.set(tableColumnPacked, lookup);
                            }
                        }
                    } else {
                        // indexed list, or normal
                        const tableColumnPacked = ((table.id & 0xffff) << 12) | ((column & 0x7f) << 4);

                        for (const value of row.columnValues[column]) {
                            const lookup: Map<string | number, number[]> = this.rows.get(tableColumnPacked) ?? new Map();

                            const rowIds = lookup.get(value) ?? [];
                            rowIds.push(row.id);

                            lookup.set(value, rowIds);
                            this.rows.set(tableColumnPacked, lookup);
                        }
                    }
                }
            }
        }
    }

    static find(query: string | number, tableColumnPacked: number): number[] {
        const tuple = tableColumnPacked & 0xf;
        const rows = tuple === 0 ? this.rows.get(tableColumnPacked) : this.rows.get(tableColumnPacked - 1);

        if (typeof rows === 'undefined') {
            const tableId = (tableColumnPacked >> 12) & 0xffff;
            const column = (tableColumnPacked >> 4) & 0x7f;

            const table = DbTableType.get(tableId);
            printWarning(`dbtable ${table.debugname}:${table.columnNames[column]} is not INDEXED, finding will fail`);
            return [];
        }

        return rows.get(query) ?? [];
    }
}
