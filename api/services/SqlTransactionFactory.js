const Promise = require('bluebird'),
    mysql = require('sails-mysql/node_modules/mysql'),
    _ = require('lodash'),
    TransactionConnectionPool = require('./TransactionConnectionPool'),
    uuid = require('uuid');

module.exports = new SqlTransactionFactory();

/**
 * Sql transaction facory
 */
function SqlTransactionFactory() {
    const connectionSource = createSource(sails.config.connections[sails.config.models.connection]);
    this.CreateSqlTransaction = CreateSqlTransaction;

    /**
     * Creates a new sql transaction
     * 
     * @param {any} transaction the sails-mysql-tranaction
     * @returns {SqlTransaction} the new transaction
     */
    function CreateSqlTransaction() {
        return new Promise((resolve, reject) => {
            connectionSource.getConnection((err, connection) => {
                if (err) {
                    reject(err);
                    return;
                }
                const transactionId = uuid();
                try{
                    TransactionConnectionPool.registerConnection(transactionId, connection);
                }catch(err){
                    sails.log.error(err);
                    reject(err);
                    return;
                }

                connection.query('START TRANSACTION', err =>{
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve(new SqlTransaction(transactionId, connection));
                });
            });
        });
    }

}

/**
 * Sql transaction object to pass along the begin transaction
 * 
 * @type {SqlTransaction}
 * @param {MySqlConnection} connection the mysql connection
 */
function SqlTransaction(transactionId, connection) {
    // Functions to wrap to pass the explicit connection when available
    const functionsToWrap = [
        'create',
        'update',
        'find',
        'findOrCreate',
        'destroy',
        'count'
    ];

    let committed = false;
    let rolledBack = false;
    let resolveAfterTransactionPromise;
    let rejectAfterTransactionPromise;

    this.id = id;
    this.forModel = forModel;
    this.commit = commit;
    this.rollback = rollback;
    this.isHandled = isHandled;
    this.after = new Promise((resolve, reject) => {
        resolveAfterTransactionPromise = resolve;
        rejectAfterTransactionPromise = reject;
    });


    /**
     * @returns {string} the transaction id
     */
    function id(){
        return transactionId;
    }
    /**
     * Attatch the query to the transaction before
     * starting a query
     * 
     * @param {any} sailsModel
     * @returns {Sails Model}
     */
    function forModel(sailsModel) {
        const modelClone = _.cloneDeep(sailsModel);
        _.each(functionsToWrap, functionName => {
            const originalFunction = modelClone[functionName];
            modelClone[functionName] = function(data) {
                
                if(_.isArray(data)){
                    _.each(data, d => d.mySqlTransactionId = id());
                }else{
                    data.mySqlTransactionId = id();
                }

                return originalFunction.apply(modelClone, arguments);
            };
        });

        return modelClone;
    }
    /**
     * Commit the transaction
     */
    function commit() {
        if (isHandled()) {
            if (committed) {
                return Promise.reject('This transaction has already been committed');
            } else {
                return Promise.reject('This transaction has already been rolledback');
            }
        }

        committed = true;
        connection.commit((err) => {
            connection.release(() => {
                TransactionConnectionPool.unregisterConnection(id());
                if (err) {
                    sails.log.error(err);

                    rolledBack = true;
                    committed = false;
                    rejectAfterTransactionPromise(err);

                    sails.log.debug('ROLLEDBACK!');
                    return;
                }


                resolveAfterTransactionPromise();
                sails.log.debug('COMMIT!');
            });
            
        });

        return this.after;
    }

    /**
     * Rolls back the transaction
     */
    function rollback() {
        let resolveRollback,
            rejectRollback;
        const rollbackPromise = new Promise((resolve, reject) => {
            resolveRollback = resolve;
            rejectRollback = reject;
        });
        if (isHandled()) {
            if (committed) {
                return Promise.reject('This transaction has already been committed');
            } else {
                return Promise.reject('This transaction has already been rolledback');
            }
        }
        rolledBack = true;

        connection.rollback((err) => {
            // after rollback, release the connection right away
            connection.release(() => {
                TransactionConnectionPool.unregisterConnection(id());
                if (err) {
                    rolledBack = true;
                    rejectAfterTransactionPromise();
                    rejectRollback(err);

                    sails.log.error(err);
                    sails.log.debug('ROLLBACK ERROR!');
                    return;
                }

                rejectAfterTransactionPromise();
                resolveRollback();

                sails.log.debug('ROLLBACK!');
            });
            
        });

        // here we want another promise so we can do .rollback().then()
        // when it successfully rollback
        return rollbackPromise;
    }

    /**
     * Checks if this transaction has been handled
     * 
     * @returns true if committed or rolled back
     */
    function isHandled() {
        return committed || rolledBack;
    }
}


/**
 * Create db connection source based on configuration parameter provided.
 *
 * @param {object} config mySQL config
 * @returns {mySQL.Source}
 */
function createSource(config) {
    // otherwise, we create an object that mimics the api of pool, but returns new connections instead of
    // from a pool
    return {
        getConnection: function (callback) {
            let conn,
                error;

            try {
                conn = mysql.createConnection(config);
                // override the `release` function to allow release to act as `end` and as such mimic the pool api.
                conn._release = conn.release;
                conn.release = conn.end;
            }
            catch (err) {
                error = err;
            }

            callback(error, conn);
        },

        // poolless connection source does not require to end, but we still expose the API for parity.
        end: function () { }
    };
}