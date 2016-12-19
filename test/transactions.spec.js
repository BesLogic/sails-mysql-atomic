const Sails = require('sails').Sails;
global.chai = require('chai');
global.should = require('chai').should();
global.sinon = require('sinon');

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
                "sails-mysql-atomic": require('../'),
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

        const Promise = require('bluebird');

        it('should commit when unhandled and no error', done => {
            SqlHelper.beginTransaction(transaction => {
                    transaction.after.then(() => {
                        Dog.count({})
                            .then(count => {
                                count.should.be.equal(1);
                                done();
                            });
                    });
                    return transaction.forModel(Dog)
                        .create({ name: 'fido' });
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

            SqlHelper.beginTransaction(transaction => {
                    transaction.after.catch(countDogs);
                    return Promise.all([
                        transaction.forModel(Dog)
                            .create({ name: 'fido' }),
                        transaction.forModel(Dog)
                            .create({ name: 'fido' })
                    ]);
                });
        });

        it('should commit when handled manually', done => {
            
            new Promise(resolve => {
                SqlHelper.beginTransaction(transaction => {
                        transaction.after.then(() => {
                            resolve();
                        });
                        return transaction.forModel(Dog)
                            .create({ name: 'fido' })
                            .then(() => transaction.commit());
                    });
            })
            .then(() => {
                Dog.count({})
                    .then(count => {
                        count.should.be.equal(1);
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

            SqlHelper.beginTransaction(transaction => {
                        transaction.after.catch(countDogs);
                        
                        return transaction
                            .forModel(Dog)
                            .create({ name: 'fido' })
                            .then(() => {
                                return transaction.rollback();
                            });
                    });
        });

        it('should rollback updates', done => {

            SqlHelper.beginTransaction(transaction => {
                        return transaction
                            .forModel(Dog)
                            .create({ name: 'fido' })
                            .then((dog) => {
                                transaction.after.then(() => { handleUpdate(dog); });
                                return transaction.commit()
                                    .catch(done);
                            });
                    });

            function handleUpdate(dog) {
                Dog.findOneById(dog.id)
                    .then(dog => {
                        SqlHelper.beginTransaction(transaction => {
                                dog.name = 'skippy';
                                return transaction.forModel(Dog)
                                    .update({ id: dog.id }, dog)
                                    .then(() => {
                                        return transaction.rollback();
                                    })
                                    .then(() => {
                                        Dog.count({ name: 'fido' })
                                            .then(count => {
                                                count.should.be.equal(1);
                                                done();
                                            });
                                    });
                            });
                    });
            }
        });

        it('should rollback deletes', done => {

            SqlHelper.beginTransaction(transaction => {
                        return transaction
                            .forModel(Dog)
                            .create({ name: 'fido' })
                            .then((dog) => {
                                transaction.after.then(() => { handleDelete(dog); });
                                return transaction.commit()
                                    .catch(done);
                            });
                    });

            function handleDelete(dog) {
                Dog.findOneById(dog.id)
                    .then(dog => {
                        SqlHelper.beginTransaction(transaction => {
                                return transaction.forModel(Dog)
                                    .destroy({ id: dog.id })
                                    .then(() => {
                                        return transaction.rollback();
                                    })
                                    .then(() => {
                                        Dog.count({ name: 'fido' })
                                            .then(count => {
                                                count.should.be.equal(1);
                                                done();
                                            });
                                    });
                            });
                    });
            }
        });

        it('should throw on commit twice', done => {
            SqlHelper.beginTransaction(tran => {
                    tran.commit();
                    tran.commit().catch(() => done());
                });
        });

        it('should throw on rollback twice', done => {
            SqlHelper.beginTransaction(tran => {
                    tran.rollback();
                    tran.rollback().catch(() => done());
                });
        });

        it('should throw when not returning a promise chain', done => {
            
            SqlHelper.beginTransaction(() => {return 1;})
            .catch(() => done());
            
        });

        it('should throw when not returning a promise chain (branch 2)', done => {
            
            SqlHelper.beginTransaction(() => {return 1;})
            .catch(() => done());

        });

        it('should throw on commit after rollback', done => {
            SqlHelper.beginTransaction(tran => {
                    tran.rollback();
                    return tran.commit().catch(() => done());
                });
        });

        it('should throw on rollback after commit', done => {
            SqlHelper.beginTransaction(tran => {
                    tran.commit();
                    return tran.rollback().catch(() => done());
                });
        });

        it('should commit multiple create', done => {
            SqlHelper.beginTransaction(transaction => {
                    transaction.after.then(() => {
                        Dog.count({})
                            .then(count => {
                                count.should.be.equal(3);
                                done();
                            });
                    });
                    return transaction.forModel(Dog)
                        .create([
                            { name: 'fido' },
                            { name: 'skippy' },
                            { name: 'peanut' }
                        ]);
                });
        });

        it('should rollback multiple create', done => {
            SqlHelper.beginTransaction(transaction => {
                    return transaction.forModel(Dog)
                        .create([
                            { name: 'fido' },
                            { name: 'skippy' },
                            { name: 'peanut' }
                        ])
                        .then(() => {
                            throw 'some error to trigger rollback';
                        });
                })
                .catch(() => {
                        Dog.count({})
                            .then(count => {
                                count.should.be.equal(0);
                                done();
                            });
                    });
        });

        it('should rollback findOrCreate', done => {
            SqlHelper.beginTransaction(transaction => {
                    return transaction.forModel(Dog)
                        .findOrCreate({ name: 'fido' })
                        .then(() => {
                            throw 'some error to trigger rollback';
                        });
                })
                .catch(() => {
                        Dog.count({})
                            .then(count => {
                                count.should.be.equal(0);
                                done();
                            });
                    });
        });


    });

    describe('TransactionConnectionPool :: ', () =>{
        it('should throw when registering the same id twice', () =>{
            const id = '1';

            TransactionConnectionPool.registerConnection(id, {});
            (() => TransactionConnectionPool.registerConnection(id, {}))
            .should.throw();
        });
    });

});