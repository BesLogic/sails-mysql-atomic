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
            Promise.all([
                Dog.destroy({}),
                Bone.destroy({}),
                Food.destroy({})
            ]).then(() => done());
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
                            return transaction.forModel(Dog)
                                .update({ id: dog.id }, { name: 'skippy' })
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

            SqlHelper.beginTransaction(() => { return 1; })
                .catch(() => done());

        });

        it('should throw when not returning a promise chain (branch 2)', done => {

            SqlHelper.beginTransaction(() => { return 1; })
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

        it('should commit findOrCreate', done => {
            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .findOrCreate({ name: 'fido' });
            })
                .then(() => {
                    Dog.count({})
                        .then(count => {
                            count.should.be.equal(1);
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

        it('should run with multiple transactions in parallel', done => {
            const createDogInTransaction = (dogName) => SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create({ name: dogName, age: 1, bones: [{ size: 'small' }, { size: 'large' }] });
            });

            const destroyAllDogsAndRollback = () => SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .destroy({})
                    .then(() => transaction.rollback());
            }).catch(() => { });

            let failedDueToUniqueConstraint = 0;
            Promise.all([
                // one of the two following should be rolled back due to unique name (can't predict which one)
                createDogInTransaction('fido').catch(() => { failedDueToUniqueConstraint++; }),
                createDogInTransaction('fido').catch(() => { failedDueToUniqueConstraint++; }),
                createDogInTransaction('fido2'),
                createDogInTransaction('fido3'),
                createDogInTransaction('fido4'),
                createDogInTransaction('fido5')
            ])
                // only one should have failed
                .then(() => failedDueToUniqueConstraint.should.be.equal(1))
                .then(() => Dog.count({}))
                .then(count => count.should.be.equal(5))
                .then(() => Bone.count({}))
                .then(count => count.should.be.equal(10))
                .then(() => destroyAllDogsAndRollback())
                .then(() => Dog.count({}))
                .then(count => count.should.be.equal(5))
                .then(() => Bone.count({}))
                .then(count => count.should.be.equal(10))
                .then(() => {
                    done();
                })
                .catch(err => {
                    done('Caught exception: ' + err);
                });
        });

        it('should rollback transaction when updating the same row with association table in parallel', done => {

            const updateDogName = (transaction, id) => transaction.forModel(Dog).update({ id: id }, { name: 'skippy' });
            const updateDogBones = (transaction, id) => transaction.forModel(Dog).update({ id: id }, { bones: [] });

            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create({ name: 'fido', age: 1, bones: [{ size: 'small' }, { size: 'large' }] })
                    .then(dog => transaction.commit().then(() => dog))
                    .then(dog => {
                        SqlHelper.beginTransaction(transaction =>
                            Promise.all([
                                updateDogName(transaction, dog.id),
                                updateDogBones(transaction, dog.id)
                            ])
                                .then(() => {
                                    const model = transaction.forModel(Dog);
                                    const res = model.findOne({ id: dog.id });
                                    return res.populate('bones');
                                })
                                .then(dog => {
                                    dog.name.should.be.equal('skippy');
                                    dog.bones.length.should.be.equal(0);
                                })
                                .then(() => transaction.rollback())
                                .then(() => Dog.findOne({ name: 'fido' }).populate('bones'))
                                .then(dog => {
                                    dog.name.should.be.equal('fido');
                                    dog.bones.length.should.be.equal(2);
                                })
                                .then(() => done())
                                .catch(done));
                    });
            });

        });

        it('should not crash when creating object with empty association defined', done => {

            SqlHelper.beginTransaction(transaction =>
                transaction.forModel(Dog).create({ name: 'fido', bones: [] })
            )
                .then(() => done())
                .catch(err => done('failed: ' + err));

        });


        it('should handle one-to-many associations', done => {

            SqlHelper.beginTransaction(transaction =>
                transaction.forModel(Dog).create({ name: 'fido', mainBones: [{ size: 'small' }] })
            )
                .then(() => Dog.count({}))
                .then(count => count.should.be.equal(1))
                .then(() => Bone.count({}))
                .then(count => count.should.be.equal(1))
                .then(() => Bone.findOne({ size: 'small' }))
                .then(bone => (!bone.owner).should.be.equal(false))
                .then(() => SqlHelper.beginTransaction(transaction => {
                    return transaction.forModel(Dog).destroy({ name: 'fido' });
                }
                ))
                .then(() => Dog.count({}))
                .then(count => count.should.be.equal(0))
                .then(() => Bone.count({}))
                .then(count => count.should.be.equal(1))
                .then(() => Bone.findOne({ size: 'small' }))
                .then(bone => {
                    (!bone.owner).should.be.equal(true);
                })
                .then(() => done())
                .catch(err => done('failed: ' + err));

        });

        it('should handle one-to-many associations', done => {

            SqlHelper.beginTransaction(transaction =>
                transaction.forModel(Dog).create({ name: 'fido', mainBones: [{ size: 'small' }] })
            )
                .then(() => Dog.count({}))
                .then(count => count.should.be.equal(1))
                .then(() => Bone.count({}))
                .then(count => count.should.be.equal(1))
                .then(() => Bone.findOne({ size: 'small' }))
                .then(bone => (!bone.owner).should.be.equal(false))
                .then(() => SqlHelper.beginTransaction(transaction => {
                    return transaction.forModel(Dog).destroy({ name: 'fido' })
                        .then(() => transaction.rollback());
                }
                ))
                .catch(() => { })
                .then(() => Dog.count({}))
                .then(count => count.should.be.equal(1))
                .then(() => Bone.count({}))
                .then(count => count.should.be.equal(1))
                .then(() => Bone.findOne({ size: 'small' }))
                .then(bone => {
                    (!bone.owner).should.be.equal(false);
                })
                .then(() => done())
                .catch(err => done('failed: ' + err));

        });

        it('should rollback multiple many-to-many association creation', done => {
            SqlHelper.beginTransaction(transaction =>
                transaction.forModel(Dog)
                    .create({
                        name: 'fido',
                        bones: [{ size: 'small' }, { size: 'big' }],
                        favoriteFoodTypes: [{ name: 'bone' }, { name: 'poutine' }]
                    })
                    .then(() => transaction.rollback())
                    .then(() => Dog.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => Bone.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => Food.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => done())
                    .catch(done)
            );
        });

        it('should commit different many-to-many association creation', done => {
            SqlHelper.beginTransaction(transaction =>
                transaction.forModel(Dog)
                    .create({
                        name: 'fido',
                        bones: [{ size: 'small' }, { size: 'big' }],
                        favoriteFoodTypes: [{ name: 'bone' }, { name: 'poutine' }]
                    })
                    .then(() => transaction.commit())
                    .then(() => Dog.count({}))
                    .then(count => count.should.be.equal(1))
                    .then(() => Bone.count({}))
                    .then(count => count.should.be.equal(2))
                    .then(() => Food.count({}))
                    .then(count => count.should.be.equal(2))
                    .then(() => done())
                    .catch(done)
            );
        });

        it('should commit multiple many-to-many association creation', done => {
            SqlHelper.beginTransaction(transaction =>
                transaction.forModel(Dog)
                    .create([
                        {
                            name: 'fido',
                            bones: [{ size: 'small' }, { size: 'big' }],
                            favoriteFoodTypes: [{ name: 'bone' }, { name: 'poutine' }]
                        },
                        {
                            name: 'skippy',
                            bones: [{ size: 'small' }, { size: 'big' }],
                            favoriteFoodTypes: [{ name: 'bone' }, { name: 'poutine' }]
                        }
                    ])
                    .then(() => transaction.commit())
                    .then(() => Dog.count({}))
                    .then(count => count.should.be.equal(2))
                    .then(() => Bone.count({}))
                    .then(count => count.should.be.equal(4))
                    .then(() => Food.count({}))
                    .then(count => count.should.be.equal(4))
                    .then(() => done())
                    .catch(done)
            );
        });

        it('should commit nested many-to-many association creation', done => {
            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create({
                        name: 'fido',
                        favoriteFoodTypes: [{ name: 'bone', dogs: [] }]
                    })
                    .then(() => transaction.commit())
                    .then(() => Dog.count({}))
                    .then(count => count.should.be.equal(1))
                    .then(() => Bone.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => Food.count({}))
                    .then(count => count.should.be.equal(1))
                    .then(() => done())
                    .catch(done);
            }
            );
        });

        it('should rollback nested many-to-many association creation', done => {
            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create({
                        name: 'fido',
                        favoriteFoodTypes: [{ name: 'bone', dogs: [] }]
                    })
                    .then(() => transaction.rollback())
                    .then(() => Dog.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => Bone.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => Food.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => done())
                    .catch(done);
            }
            );
        });

        it('should commit deeply nested many-to-many association creation', done => {
            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create({
                        name: 'fido',
                        favoriteFoodTypes: [{
                            name: 'bone',
                            dogs: [
                                { name: 'skippy', bones: [{ size: 'small' }, { size: 'large' }], favoriteFoodTypes: [{ name: 'poutine', dogs: [{ name: 'peanut' }] }] }]
                        }
                        ]
                    })
                    .then(() => transaction.commit())
                    .then(() => Dog.count({}))
                    .then(count => count.should.be.equal(3))
                    .then(() => Bone.count({}))
                    .then(count => count.should.be.equal(2))
                    .then(() => Food.count({}))
                    .then(count => count.should.be.equal(2))
                    .then(() => done())
                    .catch(done);
            }
            );
        });

        it('should rollback deeply nested many-to-many association creation', done => {
            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create({
                        name: 'fido',
                        favoriteFoodTypes: [{
                            name: 'bone',
                            dogs: [
                                {
                                    name: 'skippy', bones: [{ size: 'small' }, { size: 'large' }],
                                    favoriteFoodTypes: [{ name: 'poutine', dogs: [{ name: 'peanut' }] }]
                                }
                            ]
                        }]
                    })
                    .then(() => transaction.rollback())
                    .then(() => Dog.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => Bone.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => Food.count({}))
                    .then(count => count.should.be.equal(0))
                    .then(() => done())
                    .catch(done);
            });
        });

        it('should support skip in transaction', done => {
            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create([
                        { name: 'fido' },
                        { name: 'skippy' },
                        { name: 'peanut' }
                    ])
                    .then(() => transaction.forModel(Dog)
                        .find({})
                        .skip(1))
                    .then(results => results.length.should.be.equal(2))
                    .then(() => done())
                    .catch(done);
            });
        });

        it('should support limit in transaction', done => {
            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create([
                        { name: 'fido' },
                        { name: 'skippy' },
                        { name: 'peanut' }
                    ])
                    .then(() => transaction.forModel(Dog)
                        .find({})
                        .limit(1))
                    .then(results => results.length.should.be.equal(1))
                    .then(() => done())
                    .catch(done);
            });
        });

        it('should support sort in transaction', done => {
            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create([
                        { name: 'fido' },
                        { name: 'skippy' },
                        { name: 'peanut' }
                    ])
                    .then(() => transaction.forModel(Dog)
                        .find({})
                        .sort('name ASC')
                        .limit(1))
                    .then(results => {
                        results.length.should.be.equal(1);
                        results[0].name.should.be.equal('fido');
                    })
                    .then(() => done())
                    .catch(done);
            });
        });

        it('should support where in transaction', done => {
            SqlHelper.beginTransaction(transaction => {
                return transaction.forModel(Dog)
                    .create([
                        { name: 'fido' },
                        { name: 'skippy' },
                        { name: 'peanut' }
                    ])
                    .then(() => transaction.forModel(Dog)
                        .find({})
                        .sort('name ASC')
                        .where({name:'peanut'}))
                    .then(results => {
                        results.length.should.be.equal(1);
                        results[0].name.should.be.equal('peanut');
                    })
                    .then(() => done())
                    .catch(done);
            });
        });

        it('should support populate in transaction', done => {
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
        });


        describe('with exec syntax ::', () => {
            it('should rollback create', done => {
                SqlHelper.beginTransaction(transaction =>
                    new Promise(resolve => {
                        transaction.forModel(Dog)
                            .create({ name: 'fido', bones: [{ size: 'small' }] })
                            .exec((err) => {
                                if (err) { done(err); }

                                Promise.all([
                                    transaction.forModel(Dog).count({}),
                                    transaction.forModel(Bone).count({})
                                ])
                                    .spread((dogCount, boneCount) => {
                                        dogCount.should.be.equal(1);
                                        boneCount.should.be.equal(1);
                                        return transaction.rollback()
                                            .then(() => {
                                                return Promise.all([
                                                    Dog.count({}),
                                                    Bone.count({})
                                                ])
                                                    .spread((dogCount, boneCount) => {
                                                        dogCount.should.be.equal(0);
                                                        boneCount.should.be.equal(0);
                                                        resolve();
                                                        done();
                                                    });
                                            });
                                    })
                                    .catch(done);
                            });
                    }));
            });

            it('should commit create', done => {
                SqlHelper.beginTransaction(transaction =>
                    new Promise(resolve => {
                        transaction.forModel(Dog)
                            .create({ name: 'fido', bones: [{ size: 'small' }] })
                            .exec((err) => {
                                if (err) { done(err); }

                                Promise.all([
                                    transaction.forModel(Dog).count({}),
                                    transaction.forModel(Bone).count({})
                                ])
                                    .spread((dogCount, boneCount) => {
                                        dogCount.should.be.equal(1);
                                        boneCount.should.be.equal(1);
                                        return transaction.commit()
                                            .then(() => {
                                                return Promise.all([
                                                    Dog.count({}),
                                                    Bone.count({})
                                                ])
                                                    .spread((dogCount, boneCount) => {
                                                        dogCount.should.be.equal(1);
                                                        boneCount.should.be.equal(1);
                                                        resolve();
                                                        done();
                                                    });
                                            });
                                    })
                                    .catch(done);
                            });
                    }));
            });
        });
    });

});