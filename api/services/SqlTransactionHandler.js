const Q = require('bluebird'),
    SqlTransactionFactory = require('./SqlTransactionFactory');

module.exports = new SqlTransactionHandler();

/**
 * Sql transaction facory
 */
function SqlTransactionHandler() {
    this.getTransactionStartHandler = getTransactionStartHandler;

    /**
     * Returns the transaction start handler for the given setup callback
     * 
     * @param {Function} transactionSetup callback
     * @returns {Function} the handler to start the transaction
     */
    function getTransactionStartHandler(transactionSetup) {

        const deferer = Q.defer();

        // prepare error to have the right call stack
        const error = new Error('The callback provided in the beginTransaction ' +
            'must return the promise chain to run within the transaction.');

        return (err, transaction) => {
            if (err) {
                // failed, reject rightaway
                deferer.reject(err);
                transactionSetup(deferer.promise);
            } else {
                const sqlTransaction = SqlTransactionFactory.CreateSqlTransaction(transaction);

                const promiseChain = transactionSetup(deferer.promise);

                if (!promiseChain || !promiseChain.catch || !promiseChain.finally) {
                    sqlTransaction.rollback();
                    // cannot throw error here since we are in an async callback
                    sails.log.error(error);
                    deferer.reject(error);
                    return;
                }

                promiseChain.catch((err) => {
                    if (!sqlTransaction.isHandled()) {
                        sails.log.error('Uncaught error during the transaction:', err);
                        // oops, unhandled catch, rollback!
                        sqlTransaction.rollback();
                    }
                })
                    .finally(() => {
                        // if unhandled at this point, chec if we need
                        // to commit or rollback. If it fails on commit
                        // it will rollback automatically
                        if (!sqlTransaction.isHandled()) {
                            sqlTransaction.commit();
                        }
                    });


                // everything is setup, trigger the queue to start
                deferer.resolve(sqlTransaction);
            }
        };
    }

}