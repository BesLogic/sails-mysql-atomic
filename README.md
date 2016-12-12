# Sails MySql Transactions Helper

This is an installable hook that wraps the sails-mysql-transactions hook to add support for promises

This hook will add a `transactionId` attribute to all models in order to work properly

# How it works:

Everything starts with the `SqlHelper.beginTransaction(...)` method.

You need to provide a callback that setups the transaction promise. The promise will pass a transaction object with the following methods available:


`.commit() -> Promise`
> Commits the transaction manually and return the promise that gets resolved if the commit is successful, otherwise the promise is rejected.

`.rollback() -> Promise`
> Rollbacks the transaction manually and return the promise that gets resolved if the rollback is successful, otherwise the promise is rejected.

`.after -> Promise`
> A global promise of the transaction. If the transaction is committed, this promise will be resolved. If it has been rollbacked, this promise is rejected.

`.forModel(SailsModel) -> SailsModel`
> This connects the opened transaction to the sails model to prepare the query for the transaction


# Example (taken from my tests):
```
 //note here we are not wraping the function with 
 // brackets so it returns the promise rightaway
SqlHelper.beginTransaction(transactionPromise =>
        transactionPromise.then(...)
);


// otherwise we must return the promise like this:
SqlHelper.beginTransaction(transactionPromise => {
        return transactionPromise.then(...);
});

// handling transaction result:

SqlHelper.beginTransaction(transactionPromise =>
    transactionPromise.then(transaction => {
        transaction.after.then(() => {
            // handle transaction success after commit
        })
        .catch(() => {
            // handle transaction error after rollback
        });

        return transaction.forModel(Dog)
            .create({ name: 'fido' })
            // we can chose to handle the commit or rollback manually, 
            // which is preferrable. The service will add a fallback commit 
            // on success or rollback on error in whenever we get an uncommitted
            // transaction or uncaught exception.

            // This is how we handle stuff manually:
            // manual commit
            .then(() => transaction.commit()
                        .then(/*[optional] commit success*/)
                        .catch(/*[optional] commit failed*/));
            // manual rollback
            .catch(() => transaction.rollback()
                        .then(/*[optional] rollback success*/)
                        .catch(/*[optional] rollback failed*/));
    })
);

```