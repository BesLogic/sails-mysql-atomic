module.exports = {

  attributes: {

    name: { type: 'string', unique: true },

    bones: {
      collection: 'bone',
      via: 'dogs',
      dominant: true
    },

    favoriteFoodTypes: {
      collection: 'food',
      via: 'dogs',
      dominant: true
    },

    mainBones: {
      collection: 'bone',
      via: 'owner'
    },



  },

  beforeDestroy: beforeDestroy
};

function beforeDestroy(criteria, cb) {
  // we may be in a transaction, wrap all models using this method
  // to bind the right connection if we are in a transaction
  const forModel = this.cascadeOperationForModel;
  forModel(Dog).find(criteria, { select: ['id'] })
    .then(dogIds => {
      if (dogIds.length) {
        return forModel(Bone)
          .update({ owner: _.map(dogIds, 'id') }, { owner: null });
      }
    })
    .then(() => cb())
    .catch(cb);
}

