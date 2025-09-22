const OperationsManager = require('./operationsManager');
const { Pool } = require('pg');

class MigrationManager extends OperationsManager {
    
    async migrate(firebirdConnectionId: any, postgresConfig: any) {
    const pg = new Pool(postgresConfig);
    
    try {
        const tablesResult = await this.getTables(firebirdConnectionId);

        if (!tablesResult.success) {
            throw new Error(`Error obteniendo tablas: ${tablesResult.message}`);
        }
        
        if (!tablesResult.data || !Array.isArray(tablesResult.data)) {
            throw new Error('No se pudieron obtener las tablas o la respuesta no es válida');
        }
        
        if (tablesResult.data.length === 0) {
            throw new Error('No se encontraron tablas para migrar');
        }
                
        // Primero crear todas las tablas sin foreign keys
        for (let table of tablesResult.data) {
            let tableName = table.TABLE_NAME.trim();
            
            let columnsResult = await this.getTablesColumns(firebirdConnectionId, tableName);
            
            if (!columnsResult.success || !columnsResult.data) {
                continue; // Saltar esta tabla y continuar
            }
            
            let createSQL = this.makeCreateTable(tableName, columnsResult.data);
            await pg.query(createSQL);
            
            // Insertar datos
            let dataResult = await this.executeQuery(firebirdConnectionId, `SELECT * FROM ${tableName}`);
            if (dataResult.success && dataResult.data && dataResult.data.length > 0) {
                await this.copyData(pg, tableName, dataResult.data);
            } 
        }
        

        // Luego agregar las foreign keys
        for (let table of tablesResult.data) {
            let tableName = table.TABLE_NAME.trim();
            try {
                await this.addForeignKeys(pg, firebirdConnectionId, tableName);
            } catch (error) {
            }
        }
        
        const viewsResult = await this.getViews(firebirdConnectionId);
        
        if (viewsResult.success && viewsResult.data && Array.isArray(viewsResult.data)) {
            for (let view of viewsResult.data) {
                let viewName = view.VIEW_NAME.trim();

                
                try {
                    let viewDDL = await this.generateViewDDL(firebirdConnectionId, viewName);
                    
                    if (viewDDL.success && viewDDL.data) {
                        let pgViewSQL = this.convertViewToPostgres(viewName, viewDDL.data);
                        await pg.query(pgViewSQL);
                    }
                } catch (error) {

                }
            }
        }
    
        return 'OK';
        
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error en migración:', errorMessage);
        return 'ERROR: ' + errorMessage;
    } finally {
        await pg.end();
    }
}
    
    async addForeignKeys(pg: any, connectionId: string, tableName: string) {
        try {
            const query = `
                SELECT 
                    TRIM(RC.RDB$CONSTRAINT_NAME) AS CONSTRAINT_NAME,
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
            
            if (result.success && result.data && result.data.length > 0) {
                for (const fk of result.data) {
                    const fkSQL = `
                        ALTER TABLE ${tableName.toLowerCase()} 
                        ADD CONSTRAINT fk_${tableName.toLowerCase()}_${fk.COLUMN_NAME.toLowerCase()}
                        FOREIGN KEY (${fk.COLUMN_NAME.toLowerCase()}) 
                        REFERENCES ${fk.REFERENCED_TABLE_NAME.toLowerCase()}(${fk.REFERENCED_COLUMN_NAME.toLowerCase()})
                    `;
                    await pg.query(fkSQL);
                }
            }
        } catch (error) {
        }
    }

formatPostgresDefault(defaultValue: string, type: string): string {
    if (!defaultValue) return '';
    
    const cleanValue = defaultValue.replace(/^['"]+|['"]+$/g, '');
    
    if (cleanValue === 'CURRENT_TIMESTAMP' || cleanValue === 'NOW()') {
        return 'CURRENT_TIMESTAMP';
    }
    
    if (cleanValue === 'TRUE' || cleanValue === 'true') {
        return 'true';
    }
    
    if (cleanValue === 'FALSE' || cleanValue === 'false') {
        return 'false';
    }
    
    if (cleanValue === 'NULL' || cleanValue === 'null') {
        return 'NULL';
    }
    
    if (type.includes('INT') || type.includes('NUMERIC') || type.includes('DECIMAL') || type.includes('FLOAT')) {
        return cleanValue;
    }
    
    return `'${cleanValue.replace(/'/g, "''")}'`;
}


getPostgresType(firebirdType: number, length: any, precision: any = null, scale: any = null) {
    if (scale !== null && scale !== 0) {
        if (precision && precision > 0) {
            const actualScale = Math.abs(scale);
            return `NUMERIC(${precision},${actualScale})`;
        } else {
            return 'DECIMAL(10,2)'; 
        }
    }
    
    if (firebirdType == 8) return 'INTEGER';
    if (firebirdType == 7) return 'SMALLINT';
    if (firebirdType == 16) {
        if (scale !== null && scale !== 0) {
            const actualScale = Math.abs(scale);
            return precision ? `NUMERIC(${precision},${actualScale})` : 'DECIMAL(10,2)';
        }
        return 'BIGINT';
    }
    
    if (firebirdType == 12) return 'DATE';
    if (firebirdType == 35) return 'TIMESTAMP';
    if (firebirdType == 13) return 'TIME';
    
    if (firebirdType == 10) return 'REAL';
    if (firebirdType == 11 || firebirdType == 27) return 'DOUBLE PRECISION';
    
    if (firebirdType == 14) return length ? `CHAR(${length})` : 'CHAR(1)';
    if (firebirdType == 37 || firebirdType == 40) return length ? `VARCHAR(${length})` : 'TEXT';
    if (firebirdType == 261) return 'TEXT'; // BLOB
    
    return 'TEXT'; 
}

makeCreateTable(tableName: string, columns: any) {
    let sql = `DROP TABLE IF EXISTS ${tableName.toLowerCase()};\n`;
    sql += `CREATE TABLE ${tableName.toLowerCase()} (\n`;
    
    let cols = [];
    let primaryKeyColumns = [];
    
    for (let col of columns) {
        if (col.isPrimaryKey) {
            primaryKeyColumns.push(col.name.toLowerCase());
        }
    }
    
    for (let col of columns) {
        let name = col.name.toLowerCase();
        let type = this.getPostgresType(col.dataType, col.maxLength, col.precision, col.scale);
        
        let nullable = col.isNullable ? '' : ' NOT NULL';
        let defaultValue = '';
        
        if (col.defaultValue && col.defaultValue.trim() !== '' && col.defaultValue.trim().toUpperCase() !== 'NULL') {
            const formattedDefault = this.formatPostgresDefault(col.defaultValue, type);
            if (formattedDefault && formattedDefault !== 'NULL') {
                defaultValue = ` DEFAULT ${formattedDefault}`;
            }
        }
        
        cols.push(`  ${name} ${type}${nullable}${defaultValue}`);
    }
    
    if (primaryKeyColumns.length === 1) {
        for (let i = 0; i < cols.length; i++) {
            const col = cols[i];
            if (col && col.includes(primaryKeyColumns[0])) {
                cols[i] += ' PRIMARY KEY';
                break;
            }
        }
    } else if (primaryKeyColumns.length > 1) {
        cols.push(`  PRIMARY KEY (${primaryKeyColumns.join(', ')})`);
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
        
        viewSource = viewSource.replace(/RDB\$[A-Z_]+/g, (match: string) => match.toLowerCase());
        viewSource = viewSource.replace(/TRIM\s*\(/gi, 'TRIM(');
        viewSource = viewSource.replace(/UPPER\s*\(/gi, 'UPPER(');
        viewSource = viewSource.replace(/LOWER\s*\(/gi, 'LOWER(');
        
        viewSource = viewSource.replace(/FROM\s+([A-Z_]+)/gi, (match: any, tableName: string) => {
            return `FROM ${tableName.toLowerCase()}`;
        });

        viewSource = viewSource.replace(/JOIN\s+([A-Z_]+)/gi, (match: any, tableName: string) => {
            return `JOIN ${tableName.toLowerCase()}`;
        });
        
        sql += `CREATE VIEW ${viewName.toLowerCase()} AS\n${viewSource};`;
        
        return sql;
    }
    
    async copyData(pg: any, tableName: string, rows: any[]) {
        if (rows.length == 0) return;
        
        let columns = Object.keys(rows[0]).map(c => c.toLowerCase());
        let values = [];
        let params = [];
        
        for (let i = 0; i < rows.length; i++) {
            let row = rows[i];
            let rowValues = [];
            for (let col of columns) {
                let val = row[col.toUpperCase()] || row[col] || null;
                params.push(val);
                rowValues.push(`$${params.length}`);
            }
            values.push(`(${rowValues.join(', ')})`);
        }
        
        let sql = `INSERT INTO ${tableName.toLowerCase()} (${columns.join(', ')}) VALUES ${values.join(', ')}`;
        await pg.query(sql, params);
    }
}

module.exports = MigrationManager;