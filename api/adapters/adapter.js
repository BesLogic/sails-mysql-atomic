const mysqlAdapter = require('sails-mysql/lib/adapter.js'),
    _ = require('lodash'),
    adapterWrapper = _.clone(mysqlAdapter),
    TransactionConnectionPool = require('../services/TransactionConnectionPool'),
    functionsToWrap = require('../services/WaterlineWrappedFunctions'),
    Deferred = require('waterline/lib/waterline/query/deferred'),
    Promise = require('bluebird'),
    // waterline interception
    dql = require('waterline/lib/waterline/query/dql/index'),
    defaultMethods = require('waterline/lib/waterline/model/lib/defaultMethods'),
    basicFinders = require('waterline/lib/waterline/query/finders/basic'),
    aggregates = require('waterline/lib/waterline/query/aggregate');

_.extend(adapterWrapper, {
    identity: 'sails-mysql-atomic'
});

// Deferred extensions
Deferred.prototype.toPromiseWithTransactionId = function (functionName, transactionId) {
    if (!this._deferred) {
        // here we are starting by cloning the context so we can overwrite safely
        // our query methods to allow injecting the current transaction id in the adapter
        // so we can lookup the right connection to be able to rollback without
        // modifying the actual waterline collections. This will only work with the Promise syntax.
        // Promises are awesome :D
        this._context = _.cloneDeep(this._context);
        console.log(this._context.waterline.schema);
        _.each(this._context.adapter.connections, c => c._adapter.transactionId = transactionId);
        
        // overwrite the _model method to place the transaction id in the created model
        // when we need to handle associations
        const originalModel = this._context._model;
        const context = this._context;
        context._model = function(values){
            const newModel = new originalModel(values);
            // overwrite the model save method to pass the current context
            newModel.save = function(options, cb) {
                return new defaultMethods.save(context, this, options, cb);
            };
            return newModel;
        };
        // overwrite the dql methods to remove lodash bind wrapper to allow the context 
        // clone transporting the transaction id in the adapters
        _.each(_.keys(dql), key => {
            this._context[key] = dql[key];
            // we need to overwrite it in the waterline collections as well since it is used when creating
            // associations
            _.each(this._context.waterline.collections, collection => collection[key] = dql[key]);
        });

        // same thing for aggregates (createEach, findOrCreateEach)
        _.each(_.keys(aggregates), key => {
            this._context[key] = aggregates[key];
        });

        // overwrite the basic finders methods to remove lodash bind wrapper to allow the context 
        // clone transporting the transaction id in the adapters
        _.each(_.keys(basicFinders), key => {
            _.each(this._context.waterline.collections, collection => collection[key] = basicFinders[key]);
        } );
        this._method = dql[functionName] || basicFinders[functionName];
        this._deferred = Promise.promisify(this.exec).bind(this)();
    }
    return this._deferred;
};

// replace the original function to pass the connection if available
_.each(functionsToWrap, functionName => {
    if (_.has(adapterWrapper, functionName)) {
        const originalFunction = adapterWrapper[functionName];
        adapterWrapper[functionName] = function () {
            const transactionId = this.transactionId;
            sails.log.silly(functionName + ':: transactionId: ' + transactionId);
            if (!transactionId) {
                return originalFunction.apply(adapterWrapper, arguments);
            }
            const args = [];
            for (let i = 0; i < arguments.length; i++) {
                args.push(arguments[i]);
            }
            const connection = TransactionConnectionPool.getConnectionById(transactionId);
            // push the explicit connection
            args.push(connection);
            return originalFunction.apply(adapterWrapper, args);
        };
    }
});

module.exports = adapterWrapper;