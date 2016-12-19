const mysqlAdapter = require('sails-mysql/lib/adapter.js'),
    _ = require('lodash'),
    adapterWrapper = _.clone(mysqlAdapter),
    TransactionConnectionPool = require('../services/TransactionConnectionPool');

// Functions to wrap to pass the explicit connection when available
const functionsToWrap = [
    'create',
    'update',
    'find',
    'findOrCreate',
    'destroy',
    'count'
];

_.extend(adapterWrapper, {
    identity: 'sails-mysql-transactional'
});

// replace the original function to pass the connection if available
_.each(functionsToWrap, functionName => {
    const originalFunction = adapterWrapper[functionName];
    adapterWrapper[functionName] = function() {
        // query parameters are always set to the arguments[2]
        if(!arguments[2].mySqlTransactionId){
            return originalFunction.apply(adapterWrapper, arguments);
        }
        const args = [];
        for(let i = 0; i < arguments.length; i++)
        {
            args.push(arguments[i]);
        }
        const connection = TransactionConnectionPool.getConnectionById(arguments[2].mySqlTransactionId);
        // push the explicit connection
        args.push(connection);
        delete arguments[2].mySqlTransactionId;
        return originalFunction.apply(adapterWrapper, args);
    };
});

module.exports = adapterWrapper;