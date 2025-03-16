/**
 * sails-hook-activity-logger
 *
 * A Sails.js hook for tracking model activities (create, update, delete)
 * with user attribution and change tracking.
 */

const ActivityService = require('./lib/services/activity-service');
const activityLogModel = require('./lib/models/activity-log');
const interceptBlueprints = require('./lib/utils/blueprint-interceptor');

module.exports = function activityLoggerHook(sails) {
  return {
    /**
     * Default configuration
     */
    defaults: {
      activityLogger: {
        // Models to track
        models: [],
        // Additional configuration options
        trackData: true,       // Track data changes on update
        includeBlueprints: true // Hook into blueprint actions
      }
    },

    /**
     * Models to be registered with Sails ORM
     */
    models: {
      activitylog: activityLogModel
    },

    /**
     * Hook initialization
     */
    initialize: async function(cb) {
      // Register models with the ORM
      if (sails.hooks.orm) {
        sails.log.debug('Activity Logger: Registering models with ORM');
        sails.hooks.orm.models = Object.assign({}, sails.hooks.orm.models, this.models);
      }

      // Wait for hooks to be loaded
      sails.after(['hook:orm:loaded', 'hook:blueprints:loaded'], () => {
        sails.log.debug('Activity Logger: Initializing hook functionality');

        // Register the activity service
        if (!sails.services.activityservice) {
          sails.services.activityservice = new ActivityService(sails);
        }

        // Hook into blueprints if enabled
        if (sails.config.activityLogger.includeBlueprints) {
          interceptBlueprints(sails);
        }

        sails.log.info('Activity Logger initialized for models:',
          sails.config.activityLogger.models || []);

        return cb();
      });
    }
  };
};