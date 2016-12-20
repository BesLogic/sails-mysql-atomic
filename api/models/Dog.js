module.exports = {
  
  attributes: {

    name: { type: 'string', unique: true },
    
    bones: {
        collection: 'bone',
        via:'dogs',
        dominant: true
    }

  }
};

