/**
 * ActivityLog Model
 * Stores activity records for model operations
 */
module.exports = {
  identity: 'activitylog',
  datastore: 'default',
  primaryKey: 'id',

  attributes: {
    id: {
      type: 'number',
      autoIncrement: true
    },

    // The action performed (create, update, delete)
    action: {
      type: 'string',
      required: true,
      isIn: ['create', 'update', 'delete']
    },

    // The model that was affected
    model: {
      type: 'string',
      required: true
    },

    // ID of the record that was affected
    recordId: {
      type: 'string',
      required: true
    },

    // ID of the user who performed the action
    userId: {
      type: 'string'
    },

    // For updates, stores before/after values
    changes: {
      type: 'json',
      defaultsTo: {}
    },

    // Timestamps
    createdAt: {
      type: 'number',
      autoCreatedAt: true
    },

    updatedAt: {
      type: 'number',
      autoUpdatedAt: true
    },

    // User association
    user: {
      model: 'user'
    }
  }
};