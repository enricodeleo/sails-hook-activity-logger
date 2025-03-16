module.exports = {
  friendlyName: 'Should track model',
  description: 'Determine if a model should be tracked based on configuration',

  inputs: {
    model: {
      type: 'string',
      required: true,
      description: 'The model identity to check'
    }
  },

  exits: {
    success: {
      description: 'Successfully determined if model should be tracked',
      outputType: 'boolean'
    }
  },

  fn: async function(inputs, exits) {
    const modelIdentity = inputs.model;

    // If no model provided, don't track
    if (!modelIdentity) {
      return exits.success(false);
    }

    // Get tracked models from config
    const config = sails.config.activityLogger || {};
    const trackedModels = config.models || [];

    // Check if model should be tracked
    const shouldTrack = trackedModels.includes(modelIdentity);

    return exits.success(shouldTrack);
  }
};
