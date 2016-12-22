module.exports = {

    attributes: {

        name: { type: 'string' },

    },

    beforeValidate: beforeValidate,
    beforeCreate: beforeCreate,
    afterCreate: afterCreate,
    beforeUpdate: beforeUpdate,
    afterUpdate: afterUpdate,
    beforeDestroy: beforeDestroy,
    afterDestroy: afterDestroy,
};

function beforeValidate() {
    CheckConnection.apply(this, arguments);
}

function beforeCreate() {
    CheckConnection.apply(this, arguments);
}

function afterCreate() {
    CheckConnection.apply(this, arguments);
}

function beforeUpdate() {
    CheckConnection.apply(this, arguments);
}

function afterUpdate() {
    CheckConnection.apply(this, arguments);
}

function beforeDestroy() {
    CheckConnection.apply(this, arguments);
}

function afterDestroy() {
    CheckConnection.apply(this, arguments);
}

function CheckConnection(value, cb) {
    if (!this.adapter.connections[sails.config.models.connection]._adapter.transactionConnection) {
        // this should never happen
        throw new Error('Transaction connection was not found');
    }
    cb();
}

