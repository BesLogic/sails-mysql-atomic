![alt tag](https://travis-ci.org/BesLogic/sails-mysql-atomic.svg?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/BesLogic/sails-mysql-atomic/badge.svg?branch=master)](https://coveralls.io/github/BesLogic/sails-mysql-atomic?branch=master)
# Sails MySql Atomic 

This is an installable hook that adds easy sql transactions with support for promise syntax

# How to install it:
Remove your dependency to `sails-mysql`. It is bundled with this package.

```
npm install sails-mysql-atomic --save
```

Then change your db connection to use the right adapter:
```
myConnectionName : {
    adapter: 'sails-mysql-atomic',
    host: 'xxxxxxx',
    user: 'xxxxxxx',
    password: 'xxxxxxx',
    database: 'xxxxxxx'
}
```

# How it works:

This hook will add a `mySqlTransactionId` attribute to all models in order to work properly

Everything starts with the `SqlHelper.beginTransaction(...) -> Promise` method.

You need to provide a callback that receives a transaction object and that must return a promise. The transaction object has the following methods available:


`.commit() -> Promise`
> Commits the transaction manually and return the promise that gets resolved if the commit is successful, otherwise the promise is rejected.

`.rollback() -> Promise`
> Rollbacks the transaction manually and return the promise that gets resolved if the rollback is successful, otherwise the promise is rejected.

`.after -> Promise`
> A global promise of the transaction. If the transaction is committed, this promise will be resolved with the data passed in the `transaction.commit(...)` or returned in the transaction promise chain. If it has been rollbacked, this promise is rejected.

`.forModel(SailsModel) -> SailsModel`
> This connects the opened transaction to the sails model to prepare the query for the transaction



We also need to wrap our models using the method `this.cascadeOperationForModel` when accessing them in any cascade operations in case we are in a transaction to ensure using the same connection:

- `beforeValidate`

- `beforeCreate`
- `afterCreate`

- `beforeUpdate`
- `afterUpdate`

- `beforeDestroy`
- `afterDestroy`

```
// Dog.js
module.exports = {

  attributes: {

    name: { type: 'string', unique: true },

    bones: {
      collection: 'bone',
      via: 'dogs',
      dominant: true
    },

    mainBones: {
      collection: 'bone',
      via: 'owner'
    }

  },

  beforeDestroy: beforeDestroy
};

function beforeDestroy(criteria, cb) {
  // we may be in a transaction, wrap all models using this method
  // to bind the right connection if we are in a transaction
  const forModel = this.cascadeOperationForModel;
  forModel(Dog).find(criteria, { select: ['id'] })
    .then(dogIds => {
      if (dogIds.length) {
        // if we are in a transaction, we want to be able to rollback 
        // if something goes wrong later
        return forModel(Bone)
          .update({ owner: _.map(dogIds, 'id') }, { owner: null });
      }
    })
    .then(() => cb())
    .catch(cb);
}
```

The hook also supports mixing the query methods together using the transaction object:

- `.limit()`
- `.populate()`
- `.sort()`
- `.skip()`
- `.where()`

```
SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create([
                        { name: 'fido' },
                        { name: 'skippy', bones: [{size:'small'}, {size:'large'}] },
                        { name: 'peanut' }
                    ])
                    .then(() => transaction.forModel(Dog)
                        .find({})
                        .populate('bones')
                        .sort('name ASC')
                        .where({name:'skippy'}))
                    .then(results => {
                        results.length.should.be.equal(1);
                        results[0].name.should.be.equal('skippy');
                        results[0].bones.length.should.be.equal(2);
                    })
                    .then(() => done())
                    .catch(done);
            });
```

# Example (taken from my tests):
```
 //note here we are not wraping the function with 
 // brackets so it returns the promise rightaway
SqlHelper.beginTransaction(transaction =>
        transaction.forModel(Dog).create(...)
);


// otherwise we must return the promise like this:
SqlHelper.beginTransaction(transaction => {
        return transaction.forModel(Dog).create(...);
});

// handling transaction result:

SqlHelper.beginTransaction(transaction => {
        transaction.after.then(dataPassedOnCommit => {
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
            .then(() => transaction.commit(/*{some:'data'}*/)
                        .then(/*[optional] commit success*/)
                        .catch(/*[optional] commit failed*/));
            // manual rollback
            .catch(() => transaction.rollback()
                        .then(/*[optional] rollback success*/)
                        .catch(/*[optional] rollback failed*/));
    })
    // this promise is the same as the one passed via transaction.after
    .then(dataPassedOnCommit => {
        // handle transaction success after commit
    })
    .catch(() => {
        // handle transaction error after rollback
    });

```

# How to use it in your project

The hook will be accessible via the sails hooks:

```
// invoke from hooks
sails.hooks['sails-mysql-atomic'].beginTransaction(...);

// you can store it into a variable as well as a shortcut
let SqlHelper = sails.hooks['sails-mysql-atomic'];
SqlHelper.beginTransaction(...);
```

# Limitations

This hook works and is tested tested with the promise and exec syntax, but prmomises are what this hook was ment to be used with.


Those methods are supported and tested with transaction:
```
    transaction.forModel(Dog).create(/* ... */);
    // create multiple works as well
    transaction.forModel(Dog).create([/* ... */]);
    transaction.forModel(Dog).update(/* ... */);
    transaction.forModel(Dog).find(/* ... */);
    transaction.forModel(Dog).findOrCreate(/* ... */);
    transaction.forModel(Dog).findOne(/* ... */);
    transaction.forModel(Dog).destroy(/* ... */);
    transaction.forModel(Dog).count(/* ... */);
```
# Run tests:

`npm test`
> Run all tests

`npm run test-cover`
> Run test with coverage output in the coverage folder