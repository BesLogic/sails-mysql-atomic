const Q = require('bluebird'),
    Transaction = require('sails-mysql-transactions').Transaction;

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
        const deferer = Q.defer();

        // start a new transaction
        Transaction.start((err, transaction) => {
            if (err) {
                // failed, reject rightaway
                deferer.reject(err);
            } else {
                const sqlTransaction = new SqlTransaction(transaction);

                const promiseChain = transactionSetup(deferer.promise);

                if(!promiseChain || !promiseChain.catch || !promiseChain.finally){
                    sqlTransaction.rollback();
                    throw new Error('The callback provided in the beginTransaction ' +
                    'must return the promise chain to run within the transaction.');
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
        });
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
    this.wrap = wrapWrapper;

    /**
     * Wrapper around the `transaction.wrap` method, since it uses
     * `this`, we cannot expose the method directly
     * 
     * @param {any} valueToWrap
     */
    function wrapWrapper(valueToWrap){
        return transaction.wrap(valueToWrap);
    }

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