const DatabaseManager = require('./services/databaseManager_main');
const DDLManager = require('./services/ddlManager');
const MetadataManager = require('./services/metadataManager');
const OperationsManager = require('./services/operationsManager');
const MigrationManager = require('./services/MigrationManager');


class CombinedDatabaseManager extends DatabaseManager {
    constructor() {
        super();
        

        const ddlManager = new DDLManager();
        Object.getOwnPropertyNames(DDLManager.prototype)
            .forEach(method => {
                if (method !== 'constructor' && typeof ddlManager[method] === 'function') {
                    this[method] = ddlManager[method].bind(this);
                }
            });
            
        const metadataManager = new MetadataManager();
        Object.getOwnPropertyNames(MetadataManager.prototype)
            .forEach(method => {
                if (method !== 'constructor' && typeof metadataManager[method] === 'function' && !this[method]) {
                    this[method] = metadataManager[method].bind(this);
                }
            });
            
        const operationsManager = new OperationsManager();
        Object.getOwnPropertyNames(OperationsManager.prototype)
            .forEach(method => {
                if (method !== 'constructor' && typeof operationsManager[method] === 'function' && !this[method]) {
                    this[method] = operationsManager[method].bind(this);
                }
            });
            
        const migrationManager = new MigrationManager();
        Object.getOwnPropertyNames(MigrationManager.prototype)
            .forEach(method => {
                if (method !== 'constructor' && typeof migrationManager[method] === 'function' && !this[method]) {
                    this[method] = migrationManager[method].bind(this);
                }
            });
    }
}

module.exports = new CombinedDatabaseManager();