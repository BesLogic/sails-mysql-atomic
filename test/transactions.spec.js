const Sails = require('sails').Sails;
global.should = require('chai').should();

describe('SqlTransaction ::', () => {

    // Var to hold a running sails app instance
    let sails;

    // Before running any tests, attempt to lift Sails
    before(function (done) {

        // Hook will timeout in 10 seconds
        this.timeout(11000);

        // Attempt to lift sails
        Sails().lift({
            globals: {
                sails: true,
            },
            hooks: {
                // Load the hook
                "mysql-transactions-helper": require('../'),
                // Skip grunt (unless your hook uses it)
                "grunt": false
            },
            log: { level: "error" }
        }, (err, _sails) => {
            if (err) { return done(err); }
            sails = _sails;
            return done();
        });
    });

    // After tests are complete, lower Sails
    after((done) => {

        // Lower Sails (if it successfully lifted)
        if (sails) {
            return sails.lower(done);
        }
        // Otherwise just return
        return done();
    });

    describe('beginTransaction ::', () => {
        beforeEach(done => {
            Dog.destroy({}).then(() => done());
        });

        const Q = require('bluebird');

        it('should commit when unhandled and no error', done => {
            const deferer = Q.defer();
            let committed = false;
            SqlHelper.beginTransaction(transactionPromise =>
                transactionPromise.then(transaction => {
                    transaction.after.then(() => {
                        committed = true;
                        deferer.resolve();
                    });
                    return transaction.forModel(Dog)
                        .create({ name: 'fido' });
                })
            );


            deferer.promise
                .then(() => {
                    Dog.count({})
                        .then(count => {
                            count.should.be.equal(1);
                            committed.should.be.equal(true);
                            done();
                        });
                });
        });

        it('should rollback when unhandled and has error (Note: This test will log the error in the console, which is normal)', done => {
            const countDogs = () => {
                Dog.count({})
                    .then(count => {
                        count.should.be.equal(0);
                        done();
                    });
            };

            SqlHelper.beginTransaction(transactionPromise => {
                return transactionPromise
                    .then(transaction => {
                        transaction.after.catch(countDogs);
                        return Q.all([
                            transaction.forModel(Dog)
                                .create({ name: 'fido' }),
                            transaction.forModel(Dog)
                                .create({ name: 'fido' })
                        ]);
                    });
            });
        });

        it('should commit when handled manually', done => {
            const deferer = Q.defer();
            let committed = false;
            SqlHelper.beginTransaction(transactionPromise =>
                transactionPromise.then(transaction => {
                    transaction.after.then(() => {
                        committed = true;
                        deferer.resolve();
                    });
                    return transaction.forModel(Dog)
                        .create({ name: 'fido' })
                        .then(() => transaction.commit());
                })
            );


            deferer.promise
                .then(() => {
                    Dog.count({})
                        .then(count => {
                            count.should.be.equal(1);
                            committed.should.be.equal(true);
                            done();
                        });
                });
        });

        it('should rollback when handled manually', done => {
            const countDogs = () => {
                Dog.count({})
                    .then(count => {
                        count.should.be.equal(0);
                        done();
                    });
            };

            SqlHelper.beginTransaction(transactionPromise =>
                transactionPromise
                    .then(transaction => {
                        transaction.after.catch(countDogs);
                        const defer = Q.defer();
                        transaction
                            .forModel(Dog)
                            .create({ name: 'fido' }, () => {
                                return transaction.rollback()
                                    .catch(done);
                            });
                        return defer.promise;
                    })
            );
        });

        it('should rollback updates', done => {

            SqlHelper.beginTransaction(transactionPromise =>
                transactionPromise
                    .then(transaction => {
                        return transaction
                            .forModel(Dog)
                            .create({ name: 'fido' })
                            .then((dog) => {
                                transaction.after.then(() => { handleUpdate(dog); });
                                return transaction.commit()
                                    .catch(done);
                            });
                    })
            );

            function handleUpdate(dog) {
                Dog.findOneById(dog.id)
                    .then(dog => {
                        SqlHelper.beginTransaction(tPromise =>
                            tPromise.then(transactionInner => {
                                dog.name = 'skippy';
                                return transactionInner.forModel(Dog)
                                    .update({ id: dog.id }, dog)
                                    .then(() => {
                                        return transactionInner.rollback();
                                    })
                                    .then(() => {
                                        Dog.count({ name: 'fido' })
                                            .then(count => {
                                                count.should.be.equal(1);
                                                done();
                                            });
                                    });
                            }));
                    });
            }
        });

        it('should rollback using the sails-mysql-transactions framework only', done => {

            const Transaction = require('sails-mysql-transactions').Transaction;

            Transaction.start((err, transaction) => {
                if (err) {
                    done();
                    return;
                }

                Dog.transact(transaction)
                    .create({ name: 'fido' }, () => {
                        return transaction.rollback((err) => {
                            if (err) {
                                sails.log(err);
                            }
                            setTimeout(() => {
                                Dog.count({})
                                    .then(count => {
                                        count.should.be.equal(0);
                                        done();
                                    })
                                    .catch(done);
                            }, 1000);
                        });
                    });
            });
        });
    });

});