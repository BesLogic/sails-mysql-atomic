const _ = require('lodash');
module.exports = mysqlTransactionsHelperHook;

function mysqlTransactionsHelperHook() {
    const SqlHelper = require('./api/services/SqlHelper');

    return _.merge({
        configure: () => {
            sails.log.verbose('configuring sails-mysql-atomic');
            _.merge(sails.config.models, {
                // force to use the defined model structure from attributes
                schema: true
            });
            // now we need to load the sails-mysql-transactions adapter into the main app
            const adapter = require('./api/adapters/adapter');
            sails.adapters[adapter.identity] = adapter;
        }
    }, SqlHelper);
}