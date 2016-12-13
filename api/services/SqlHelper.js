const Transaction = require('sails-mysql-transactions').Transaction;

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

        // start a new transaction
        Transaction.start(SqlTransactionHandler.getTransactionStartHandler(transactionSetup));
    }
}