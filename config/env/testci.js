const winston = require('winston');

module.exports = {

    connections: {
        mySQLT: {
            adapter: 'sails-mysql-transactions',
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'mysqltransactionshelper'

        }
    },

    models: {
        connection: 'mySQLT',
        migrate: 'drop'
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
