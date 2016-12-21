module.exports = {

  attributes: {

    name: { type: 'string' },

    dogs: {
      collection: 'dog',
      via: 'favoriteFoodTypes'
    }   

  }
};