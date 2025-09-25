const DatabaseManager = require('./databaseManager_main');
const { Pool } = require('pg');

class MigrationManager extends DatabaseManager {


    async migrate(firebirdConnectionId: any, postgresConfig: any) {
        const pg = new Pool(postgresConfig);

        try {

            const tablesResult = await this.getTables(firebirdConnectionId);

            if (!tablesResult.success || !tablesResult.data.length) {
                console.log('tablasResult', tablesResult);
                throw new Error('No se encontraron tablas o no estas conectado a la bd de firebrd');
            }

            for(let table of tablesResult.data){
                await pg.query(`DROP TABLE IF EXISTS ${table.TABLE_NAME.trim().toLowerCase()} CASCADE;`);
            }

            for (let table of tablesResult.data) {
                const tableName = table.TABLE_NAME.trim();
                const columnsResult = await this.getTablesColumns(firebirdConnectionId, tableName);
                const createSQL = this.makeCreateTable(tableName, columnsResult.data);
                await pg.query(createSQL);


                const dataResult = await this.executeQuery(firebirdConnectionId, `SELECT * FROM ${tableName}`);
                if (dataResult.success && dataResult.data?.length > 0) {
                    await this.copyData(pg, tableName, dataResult.data);
                }
            }


            for (let table of tablesResult.data) {
                await this.addForeignKeys(pg, firebirdConnectionId, table.TABLE_NAME.trim());
            }

            
            const viewsResult = await this.getViews(firebirdConnectionId);
            if (viewsResult.success && viewsResult.data) {
                for (let view of viewsResult.data) {
                    const viewDDL = await this.generateViewDDL(firebirdConnectionId, view.VIEW_NAME);
                    if (viewDDL.success) {
                        const pgViewSQL = this.convertViewToPostgres(view.VIEW_NAME, viewDDL.data);
                        await pg.query(pgViewSQL);
                    }
                }
            }

            return 'OK';

        } catch (error) {
            return 'ERROR: ' + (error instanceof Error ? error.message : String(error));

        } finally {
            await pg.end();
        }
    }

    async addForeignKeys(pg: { query: (arg0: string) => any; }, connectionId: any, tableName: string) {
        try{
        const query = `
            SELECT 
                TRIM(ISG.RDB$FIELD_NAME) AS COLUMN_NAME,
                TRIM(REF.RDB$RELATION_NAME) AS REFERENCED_TABLE_NAME,
                TRIM(ISG_REF.RDB$FIELD_NAME) AS REFERENCED_COLUMN_NAME
            FROM RDB$RELATION_CONSTRAINTS RC
            INNER JOIN RDB$REF_CONSTRAINTS REFC ON RC.RDB$CONSTRAINT_NAME = REFC.RDB$CONSTRAINT_NAME
            INNER JOIN RDB$RELATION_CONSTRAINTS REF ON REFC.RDB$CONST_NAME_UQ = REF.RDB$CONSTRAINT_NAME
            INNER JOIN RDB$INDEX_SEGMENTS ISG ON RC.RDB$INDEX_NAME = ISG.RDB$INDEX_NAME
            INNER JOIN RDB$INDEX_SEGMENTS ISG_REF ON REF.RDB$INDEX_NAME = ISG_REF.RDB$INDEX_NAME
            WHERE RC.RDB$RELATION_NAME = UPPER(?)
            AND RC.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY'
            AND ISG.RDB$FIELD_POSITION = ISG_REF.RDB$FIELD_POSITION
        `;

         const result = await this.executeQuery(connectionId, query, tableName);

        //alter table "tabla" add constraint fk_"tabla"_"colunma"_foreign key ("columna") references "tabla_referenciada"("columna_referenciada");
        if (result.success && result.data) {
            for (const fk of result.data) {
                const fkSQL = `
                    ALTER TABLE ${tableName.toLowerCase()} 
                    ADD CONSTRAINT fk_${tableName.toLowerCase()}_${fk.COLUMN_NAME.toLowerCase()}
                    FOREIGN KEY (${fk.COLUMN_NAME.toLowerCase()}) 
                    REFERENCES ${fk.REFERENCED_TABLE_NAME.toLowerCase()}(${fk.REFERENCED_COLUMN_NAME.toLowerCase()})
                `;
                console.error("sentencia de fksql: ", fkSQL);
                await pg.query(fkSQL);
                
            }
        }
    }catch(error: any){
        console.error('Error en foraneas',error.message);
    }
    }


    formatPostgresDefault(defaultValue: string, type: string | string[]) {
        if (!defaultValue) return '';

        const cleanValue = defaultValue.replace(/^['"]+|['"]+$/g, '');

        if (cleanValue === 'CURRENT_TIMESTAMP' || cleanValue === 'NOW()') return 'CURRENT_TIMESTAMP';
        if (cleanValue === 'TRUE' || cleanValue === 'true') return 'true';
        if (cleanValue === 'FALSE' || cleanValue === 'false') return 'false';
        if (cleanValue === 'NULL' || cleanValue === 'null') return 'NULL';

        if (type.includes('INT') || type.includes('NUMERIC') || type.includes('DECIMAL') || type.includes('FLOAT')) {
            return cleanValue;
        }
        return `'${cleanValue.replace(/'/g, "''")}'`;
    }

    getPostgresType(firebirdType: number, length: any, precision = null, scale = null) {

        if (scale !== null && scale !== 0) {
            const actualScale = Math.abs(scale);
            return precision ? `NUMERIC(${precision},${actualScale})` : 'DECIMAL(10,2)';
            
        }

        if (firebirdType === 8) return 'INTEGER';
        if (firebirdType === 7) return 'SMALLINT';
        if (firebirdType === 16) return 'BIGINT';


        if (firebirdType === 12) return 'DATE';
        if (firebirdType === 35) return 'TIMESTAMP';
        if (firebirdType === 13) return 'TIME';

        if (firebirdType === 10) return 'REAL';
        if (firebirdType === 11 || firebirdType === 27) return 'DOUBLE PRECISION';

        if (firebirdType === 14) return length ? `CHAR(${length})` : 'CHAR(1)';
        if (firebirdType === 37 || firebirdType === 40) return length ? `VARCHAR(${length})` : 'TEXT';
        if (firebirdType === 261) return 'TEXT';

        return 'TEXT';
    }


    makeCreateTable(tableName: string, columns: any) {
        let sql = `DROP TABLE IF EXISTS ${tableName.toLowerCase()};\n`;
        sql += `CREATE TABLE ${tableName.toLowerCase()} (\n`;

        const cols = [];
        const primaryKeys = [];


        for (let col of columns) {
            if (col.isPrimaryKey) {
                primaryKeys.push(col.name.toLowerCase());
            }
        }


        for (let col of columns) {
            const name = col.name.toLowerCase();
            const type = this.getPostgresType(col.dataType, col.maxLength, col.precision, col.scale);
            const nullable = col.isNullable ? '' : ' NOT NULL';

            let defaultValue = '';
            if (col.defaultValue && col.defaultValue.trim() && col.defaultValue.trim().toUpperCase() !== 'NULL') {
                const formatted = this.formatPostgresDefault(col.defaultValue, type);
                if (formatted && formatted !== 'NULL') {
                    defaultValue = ` DEFAULT ${formatted}`;
                }
            }

            cols.push(`  ${name} ${type}${nullable}${defaultValue}`);
        }


        if (primaryKeys.length === 1) {
            for (let i = 0; i < cols.length; i++) {
                const col = cols[i];
                if (col && typeof col === 'string' && col.includes(primaryKeys[0])) {
                    cols[i] += ' PRIMARY KEY';
                    break;
                }
            }
        } else if (primaryKeys.length > 1) {
            cols.push(`  PRIMARY KEY (${primaryKeys.join(', ')})`);
        }

        sql += cols.join(',\n') + '\n);';
        return sql;
    }


    convertViewToPostgres(viewName: string, firebirdViewDDL: any) {
        let sql = `DROP VIEW IF EXISTS ${viewName.toLowerCase()};\n`;

        let viewSource = firebirdViewDDL;
        if (typeof viewSource === 'object' && viewSource.VIEW_SOURCE) {
            viewSource = viewSource.VIEW_SOURCE;
        }

        viewSource = viewSource.replace(/CREATE\s+VIEW\s+[^\s]+\s+AS\s*/gi, '');

        viewSource = viewSource.replace(/FROM\s+([A-Z_]+)/gi, (match: any, tableName: string) => `FROM ${tableName.toLowerCase()}`);
        viewSource = viewSource.replace(/JOIN\s+([A-Z_]+)/gi, (match: any, tableName: string) => `JOIN ${tableName.toLowerCase()}`);

        sql += `CREATE VIEW ${viewName.toLowerCase()} AS\n${viewSource};`;

        return sql;
    }

    async copyData(pg: { query: (arg0: string, arg1: any[]) => any; }, tableName: string, rows: string | any[]) {
       
        if (rows.length === 0) return;

        const columns = Object.keys(rows[0]).map(c => c.toLowerCase());
        const values = [];
        const params = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowValues = [];
            for (let col of columns) {
                const val = row[col.toUpperCase()] || row[col] || null;
                params.push(val);
                rowValues.push(`$${params.length}`);
            }
            values.push(`(${rowValues.join(', ')})`);
        }

        const sql = `INSERT INTO ${tableName.toLowerCase()} (${columns.join(', ')}) VALUES ${values.join(', ')}`;
        await pg.query(sql, params);
    }
}

module.exports = MigrationManager;