const winston = require('winston');

module.exports = {

    connections: {
        mySQLT: {
            adapter: 'sails-mysql-transactions',
            host: 'localhost',
            user: 'root',
            password: '123456',
            database: 'mysqltransactionshelper',

            transactionConnectionLimit: 20,
            rollbackTransactionOnError: false,
            queryCaseSensitive: false,

            replication: {
                enabled: false
            }

        }
    },

    models: {
        connection: 'mySQLT',
        migrate: 'drop',
        schema: true,
        autoTK: false,
        autosubscribe: false,

        attributes: {

            transactionId: {
                type: 'string'
            }

        }
    },

    log: {
        'level': 'debug',
        'custom': new (winston.Logger)({
            'transports': [
                new (winston.transports.Console)({
                    'level': 'verbose',
                    'colorize': true,
                    'timestamp': true,
                    'json': false
                })
            ]
        })
    }
};
