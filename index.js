module.exports = mysqlTransactionsHelperHook;

function mysqlTransactionsHelperHook() {
    const SqlHelper = require('./api/services/SqlHelper');
    return SqlHelper;
}