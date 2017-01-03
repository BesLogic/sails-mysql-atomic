const Promise = require('bluebird'),
    SqlTransactionFactory = require('./SqlTransactionFactory');

module.exports = new SqlHelper();

/**
 * Sql helper service
 */
function SqlHelper() {

    this.beginTransaction = beginTransaction;

    /**
     * Begins a new mysql transaction and with a setup callback that 
     * must return the transaction promise chain to be be committed or
     * rolled back at any time. If not handled manually,
     * it will be comitted or rolled back automatically
     * depending on the promise resolution.
     * 
     * @param {Function} transactionSetup callback that gets invoked with the transaction promise to setup before resolving it
     * 
     * @returns {Promise<SqlTransaction>} the transaction promise
     */
    function beginTransaction(transactionSetup) {

        // prepare error to have the right call stack
        const error = new Error('The callback provided in the beginTransaction ' +
            'must return the promise chain to run within the transaction.');

        return SqlTransactionFactory.CreateSqlTransaction()
            .then(sqlTransaction => {
                const promiseChain = transactionSetup(sqlTransaction);

                if (!promiseChain || !promiseChain.catch || !promiseChain.then) {
                    sqlTransaction.rollback();
                    // cannot throw error here since we are in an async callback
                    sails.log.error(error);
                    return Promise.reject(error);
                }

                promiseChain.then(data => {
                    // if unhandled at this point, chec if we need
                    // to commit or rollback. If it fails on commit
                    // it will rollback automatically
                    if (!sqlTransaction.isHandled()) {
                        sqlTransaction.commit(data);
                    }
                },
                (err) => {
                    if (!sqlTransaction.isHandled()) {
                        // oops, unhandled catch, rollback!
                        sqlTransaction.rollback(err);
                    }

                    throw err;
                });

                // return the global transaction promise (resolve = commit success, reject = rollback)
                return sqlTransaction.after;
            });


    }
}