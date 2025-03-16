module.exports = {
  friendlyName: 'Log activity',
  description: 'Log a model activity with user attribution',

  inputs: {
    action: {
      type: 'string',
      required: true,
      isIn: ['create', 'update', 'delete'],
      description: 'The action performed on the record'
    },
    model: {
      type: 'string',
      required: true,
      description: 'The model identity affected'
    },
    recordId: {
      type: 'string',
      required: true,
      description: 'ID of the affected record'
    },
    changes: {
      type: 'ref',
      defaultsTo: {},
      description: 'Changes made to the record (for updates)'
    },
    userId: {
      type: 'string',
      description: 'ID of the user who performed the action'
    }
  },

  exits: {
    success: {
      description: 'Activity was logged successfully',
      outputType: 'ref'
    },
    modelNotTracked: {
      description: 'The model is not configured to be tracked'
    }
  },

  fn: async function(inputs, exits) {
    sails.log.debug('Attempting to log activity:', {
      action: inputs.action,
      model: inputs.model,
      recordId: inputs.recordId,
      userId: inputs.userId
    });

    if (!inputs.userId) {
      sails.log.warn('Activity logged without userId');
    }

    try {
      // Check if model should be tracked
      const shouldTrack = await sails.helpers.shouldTrackModel.with({
        model: inputs.model
      });

      if (!shouldTrack) {
        sails.log.verbose(`Skipping activity log for non-tracked model: ${inputs.model}`);
        return exits.modelNotTracked();
      }

      // Create activity log entry
      const created = await sails.models.activitylog.create({
        action: inputs.action,
        model: inputs.model,
        recordId: inputs.recordId,
        changes: inputs.changes,
        userId: inputs.userId
      }).fetch();

      sails.log.debug('Activity log created:', created);
      return exits.success(created);
    } catch (err) {
      sails.log.error('Failed to log activity:', err);
      return exits.error(err);
    }
  }
};
