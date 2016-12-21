const mysqlAdapter = require('sails-mysql/lib/adapter.js'),
    _ = require('lodash'),
    adapterWrapper = _.clone(mysqlAdapter),
    functionsToWrap = require('../services/WaterlineWrappedFunctions'),
    Deferred = require('waterline/lib/waterline/query/deferred'),
    Promise = require('bluebird'),
    // waterline interception
    dql = require('waterline/lib/waterline/query/dql/index'),
    defaultMethods = require('waterline/lib/waterline/model/lib/defaultMethods'),
    basicFinders = require('waterline/lib/waterline/query/finders/basic'),
    aggregates = require('waterline/lib/waterline/query/aggregate'),
    composites = require('waterline/lib/waterline/query/composite'),
    Collection = require('waterline').Collection;

_.extend(adapterWrapper, {
    identity: 'sails-mysql-atomic'
});

// Extend waterline Collection prototype
_.extend(Collection.prototype, {
    // setup default return method
    cascadeOperationForModel: function (model) { return model; }
});

// Deferred extensions
Deferred.prototype.toPromiseWithConnection = function (functionName, connection, sqlTransaction) {
    if (!this._deferred) {
        // here we are starting by cloning the context so we can overwrite safely
        // our query methods to allow injecting the current transaction id in the adapter
        // so we can lookup the right connection to be able to rollback without
        // modifying the actual waterline collections. This will only work with the Promise syntax.
        // Promises are awesome :D
        
        // cache of { identity:clone } to avoid cloning twice a context
        const contextCloneCache = {};
        this._context = cloneContext(true, this._context, connection, sqlTransaction, contextCloneCache);

        this._method = dql[functionName] || basicFinders[functionName] || aggregates[functionName] || composites[functionName];
        this._deferred = Promise.promisify(this.exec).bind(this)();
    }
    return this._deferred;
};

function cloneContext(isRoot, context, connection, sqlTransaction, contextCloneCache) {
    const cachedClone = contextCloneCache[context.identity];
    if(cachedClone){
        return cachedClone;
    }
    if (context.isClone) {
        return context;
    }
    // we only need to deep clone the root level, after that we already 
    // have a copy of the context, we just need to set it up
    const contextClone = isRoot ? _.cloneDeep(context) : context;
    contextClone.isClone = true;
    contextCloneCache[contextClone.identity] = contextClone;
    _.each(contextClone.adapter.connections, c => c._adapter.transactionConnection = connection);

    // overwrite the _model method to place the transaction id in the created model
    // when we need to handle associations
    const originalModel = contextClone._model;
    contextClone._model = wrapModelCreation(originalModel, contextClone);
    contextClone.cascadeOperationForModel = sqlTransaction.forModel;
    // overwrite the dql methods to remove lodash bind wrapper to allow the context 
    // clone transporting the transaction id in the adapters
    const methodDefinitions = [
        dql,
        basicFinders,
        aggregates,
        composites
    ];

    _.each(methodDefinitions, definition => {
        _.each(_.keys(definition), key => {
            contextClone[key] = definition[key];
        });
    });

    // we need to overwrite it in the waterline collections as well since it is used when creating
    // associations
    _.each(_.keys(contextClone.waterline.collections), collectionKey => {
        const collectionContext = contextClone.waterline.collections[collectionKey];
        contextClone.waterline.collections[collectionKey] = cloneContext(false, collectionContext, connection, sqlTransaction, contextCloneCache);
    });

    return contextClone;
}

function wrapModelCreation(originalModel, context) {
    return function (values) {
        const newModel = new originalModel(values);
        // overwrite the model save and destroy method to pass the current context
        newModel.save = function (options, cb) {
            return new defaultMethods.save(context, this, options, cb);
        };
        newModel.destroy = function (cb) {
            return new defaultMethods.destroy(context, this, cb);
        };
        return newModel;
    };
}

// replace the original function to pass the connection if available
_.each(functionsToWrap, functionName => {
    if (_.has(adapterWrapper, functionName)) {
        const originalFunction = adapterWrapper[functionName];
        adapterWrapper[functionName] = function () {
            const connection = this.transactionConnection;
            sails.log.silly(functionName + ':: has transaction connection: ' + !!connection);

            const args = [];
            for (let i = 0; i < arguments.length; i++) {
                args.push(arguments[i]);
            }

            if (connection) {
                // push the explicit connection
                args.push(connection);
            }

            return originalFunction.apply(adapterWrapper, args);
        };
    }
});

module.exports = adapterWrapper;