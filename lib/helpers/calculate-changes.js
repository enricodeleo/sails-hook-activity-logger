module.exports = {
  friendlyName: 'Calculate changes',
  description: 'Calculate the changes between original and updated record',

  inputs: {
    original: {
      type: 'ref',
      description: 'The original record before changes',
      required: true
    },
    updated: {
      type: 'ref',
      description: 'The updated record after changes',
      required: true
    },
    excludeFields: {
      type: 'ref',
      description: 'Array of fields to exclude from change tracking',
      defaultsTo: []
    }
  },

  exits: {
    success: {
      description: 'Successfully calculated changes',
      outputType: 'ref'
    }
  },

  fn: async function(inputs, exits) {
    const original = inputs.original;
    const updated = inputs.updated;
    const excludeFields = inputs.excludeFields || [];

    if (!original || !updated) {
      return exits.success({});
    }

    const changes = {
      before: {},
      after: {}
    };

    Object.keys(updated).forEach(key => {
      // Skip excluded fields
      if (excludeFields.includes(key)) {
        return;
      }

      // Skip functions and non-serializable values
      if (typeof updated[key] === 'function') {
        return;
      }

      // Skip internal Sails.js fields
      if (key.startsWith('_')) {
        return;
      }

      // Compare values (using JSON.stringify handles objects and arrays)
      try {
        if (JSON.stringify(original[key]) !== JSON.stringify(updated[key])) {
          changes.before[key] = original[key];
          changes.after[key] = updated[key];
        }
      } catch (err) {
        // If JSON.stringify fails, try direct comparison
        if (original[key] !== updated[key]) {
          changes.before[key] = original[key];
          changes.after[key] = updated[key];
        }
      }
    });

    return exits.success(changes);
  }
};
