module.exports = new TransactionConnectionPool();

function TransactionConnectionPool(){
    const connectionPool = {};

    this.registerConnection = registerConnection;
    this.unregisterConnection = unregisterConnection;
    this.getConnectionById = getConnectionById;
    
    
    function registerConnection(id, connection) {
        if(connectionPool[id]){
            throw new Error(`The connection ${id} has already been registered to the connection pool`);
        }
        connectionPool[id] = connection;
    }
    
    function unregisterConnection(id) {
        delete connectionPool[id];
    }

    function getConnectionById(id){
        return connectionPool[id];
    }

}