const Q = require('bluebird');

module.exports = new SqlTransactionFactory();

/**
 * Sql transaction facory
 */
function SqlTransactionFactory() {
    this.CreateSqlTransaction = CreateSqlTransaction;

    /**
     * Creates a new sql transaction
     * 
     * @param {any} transaction the sails-mysql-tranaction
     * @returns {SqlTransaction} the new transaction
     */
    function CreateSqlTransaction(transaction) {
        return new SqlTransaction(transaction);
    }

}

/**
 * Sql transaction object to pass along the begin transaction
 * 
 * @type {SqlTransaction}
 * @param {any} transaction the transaction from sails-mysql-transactions
 */
function SqlTransaction(transaction) {
    let committed = false;
    let rolledBack = false;
    const afterTransactionPromise = Q.defer();

    this.forModel = forModel;
    this.commit = commit;
    this.rollback = rollback;
    this.isHandled = isHandled;
    this.after = afterTransactionPromise.promise;

    /**
     * Attatch the query to the transaction before
     * starting a query
     * 
     * @param {any} sailsModel
     * @returns {Sails Model}
     */
    function forModel(sailsModel) {
        return sailsModel.transact(transaction);
    }
    /**
     * Commit the transaction
     */
    function commit() {
        if (isHandled()) {
            if (committed) {
                throw new Error('This transaction has already been committed');
            } else {
                throw new Error('This transaction has already been rolledback');
            }
        }

        committed = true;
        transaction.commit(err => {
            if (err) {
                sails.log.error(err);

                rolledBack = true;
                committed = false;
                afterTransactionPromise.reject();

                sails.log.debug('ROLLEDBACK!');
                return;
            }
            afterTransactionPromise.resolve();

            sails.log.debug('COMMIT!');
        });

        return this.after;
    }

    /**
     * Rolls back the transaction
     */
    function rollback() {
        const rollbackDeferer = Q.defer();
        if (isHandled()) {
            if (committed) {
                throw new Error('This transaction has already been committed');
            } else {
                throw new Error('This transaction has already been rolledback');
            }
        }
        rolledBack = true;

        transaction.rollback(err => {
            if (err) {
                rolledBack = true;
                afterTransactionPromise.reject();
                rollbackDeferer.reject();

                sails.log.error(err);
                sails.log.debug('ROLLBACK ERROR!');
                return;
            }
            afterTransactionPromise.reject();
            rollbackDeferer.resolve();

            sails.log.debug('ROLLBACK!');
        });

        // here we want another promise so we can do .rollback().then()
        // when it successfully rollback
        return rollbackDeferer.promise;
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