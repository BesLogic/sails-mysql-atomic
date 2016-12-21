module.exports = {
  
  attributes: {

    size: { type: 'string' },

    dogs: {
        collection: 'dog',
        via:'bones'
    },

    owner: {
      model:'dog'
    }
  }
};

