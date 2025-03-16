/**
 * sails-hook-activity-logger
 *
 * A Sails.js hook for tracking model activities (create, update, delete)
 * with user attribution and change tracking.
 */

const logActivityHelper = require('./lib/helpers/log-activity');
const getUserIdHelper = require('./lib/helpers/get-user-id');
const calculateChangesHelper = require('./lib/helpers/calculate-changes');
const shouldTrackModelHelper = require('./lib/helpers/should-track-model');
const getLatestActivitiesHelper = require('./lib/helpers/get-latest-activities');
const activityLogModel = require('./lib/models/activity-log');
const activityLoggerMiddleware = require('./lib/middleware/activity-logger.middleware');

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
        includeBlueprints: true, // Hook into blueprint actions
        
        // Route patterns to intercept for activity logging
        // These are only used if includeBlueprints is true
        routesToLog: [
          'POST /api/:model',        // create
          'PUT /api/:model/:id',     // update
          'PATCH /api/:model/:id',   // partial update
          'DELETE /api/:model/:id',  // destroy
        ]
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

        // Register helpers
        sails.helpers = sails.helpers || {};
        sails.helpers.logActivity = logActivityHelper;
        sails.helpers.getUserId = getUserIdHelper;
        sails.helpers.calculateChanges = calculateChangesHelper;
        sails.helpers.shouldTrackModel = shouldTrackModelHelper;
        sails.helpers.getLatestActivities = getLatestActivitiesHelper;

        // Hook into router if blueprint tracking is enabled
        if (sails.config.activityLogger.includeBlueprints) {
          // Listen for when the router in Sails says it's time to bind routes
          sails.on('router:before', function routerBefore() {
            // Bind the activity logger middleware to the configured routes
            sails.config.activityLogger.routesToLog.forEach(routeAddress => {
              sails.log.verbose('Activity Logger: Binding to route', routeAddress);
              sails.router.bind(routeAddress, activityLoggerMiddleware);
            });
          });
        }

        sails.log.info('Activity Logger initialized for models:', 
          sails.config.activityLogger.models || []);

        return cb();
      });
    }
  };
};