module.exports = {
  friendlyName: 'Get latest activities',
  description: 'Retrieve the most recent activity logs with filtering options',

  inputs: {
    model: {
      type: 'string',
      description: 'Filter by model identity'
    },
    recordId: {
      type: 'string',
      description: 'Filter by record ID'
    },
    userId: {
      type: 'string',
      description: 'Filter by user ID'
    },
    action: {
      type: 'string',
      description: 'Filter by action type (create, update, delete)',
      isIn: ['create', 'update', 'delete']
    },
    limit: {
      type: 'number',
      description: 'Maximum number of records to return',
      defaultsTo: 30
    },
    skip: {
      type: 'number',
      description: 'Number of records to skip',
      defaultsTo: 0
    },
    sort: {
      type: 'string',
      description: 'Sort direction (desc or asc)',
      isIn: ['desc', 'asc'],
      defaultsTo: 'desc'
    },
    populate: {
      type: 'boolean',
      description: 'Whether to populate the user association',
      defaultsTo: true
    }
  },

  exits: {
    success: {
      description: 'Successfully retrieved activities',
      outputType: 'ref'
    }
  },

  fn: async function(inputs, exits) {
    // Build query criteria
    const criteria = {};

    if (inputs.model) {
      criteria.model = inputs.model;
    }

    if (inputs.recordId) {
      criteria.recordId = inputs.recordId;
    }

    if (inputs.userId) {
      criteria.userId = inputs.userId;
    }

    if (inputs.action) {
      criteria.action = inputs.action;
    }

    // Build query
    let query = sails.models.activitylog.find({
      where: criteria,
      limit: inputs.limit,
      skip: inputs.skip,
      sort: `createdAt ${inputs.sort}`
    });

    // Populate user if requested
    if (inputs.populate) {
      query = query.populate('user');
    }

    // Execute query
    const activities = await query;

    return exits.success(activities);
  }
};
