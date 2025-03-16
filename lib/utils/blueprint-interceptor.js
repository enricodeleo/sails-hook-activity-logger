module.exports = function interceptBlueprints(sails) {
  // Only proceed if blueprints hook is enabled
  if (!sails.hooks.blueprints) {
    sails.log.warn('Activity Logger: Blueprints hook not found, blueprint tracking disabled');
    return;
  }

  // Check if blueprint middleware exists
  if (!sails.hooks.blueprints.middleware) {
    sails.log.warn('Activity Logger: Blueprint middleware not found in expected format');
    return;
  }

  // Safely access blueprint actions
  const blueprintAPI = sails.hooks.blueprints.middleware;

  // Store original blueprint actions if they exist
  const originalActions = {
    create: blueprintAPI.create,
    update: blueprintAPI.update,
    destroy: blueprintAPI.destroy
  };

  // Make sure we have the original actions before trying to override
  if (!originalActions.create || !originalActions.update || !originalActions.destroy) {
    sails.log.warn('Activity Logger: Could not find all blueprint actions to intercept');
    return;
  }

  // Override create action
  blueprintAPI.create = function(req, res, next) {
    // Set up response interceptors
    const originalSend = res.send;
    const originalJson = res.json;
    const originalStatus = res.status;

    let statusCode = 200;

    // Track status code
    res.status = function(code) {
      statusCode = code;
      return originalStatus.apply(this, arguments);
    };

    // Intercept send to log activity
    res.send = function(data) {
      if (statusCode >= 200 && statusCode < 300) {
        try {
          // Parse data if it's a string
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          logCreateActivity(req, responseData);
        } catch (e) {
          sails.log.error('Error processing create response:', e);
        }
      }
      return originalSend.apply(this, arguments);
    };

    // Intercept json to log activity
    res.json = function(data) {
      if (statusCode >= 200 && statusCode < 300) {
        try {
          logCreateActivity(req, data);
        } catch (e) {
          sails.log.error('Error processing create response:', e);
        }
      }
      return originalJson.apply(this, arguments);
    };

    // Call the original action
    return originalActions.create(req, res, next);
  };

  // Override update action
  blueprintAPI.update = function(req, res, next) {
    // Get the model and ID
    const modelIdentity = req.options.model || req.options.alias;
    const Model = sails.models[modelIdentity];
    const recordId = req.params.id;

    // Only proceed if we have both model and ID
    if (Model && recordId) {
      // Find original record first
      Model.findOne(recordId)
        .then(originalRecord => {
          // Store for later use
          req.originalRecord = originalRecord;

          // Set up response interceptors
          const originalSend = res.send;
          const originalJson = res.json;
          const originalStatus = res.status;

          let statusCode = 200;

          // Track status code
          res.status = function(code) {
            statusCode = code;
            return originalStatus.apply(this, arguments);
          };

          // Intercept send to log activity
          res.send = function(data) {
            if (statusCode >= 200 && statusCode < 300) {
              try {
                // Parse data if it's a string
                const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                logUpdateActivity(req, responseData);
              } catch (e) {
                sails.log.error('Error processing update response:', e);
              }
            }
            return originalSend.apply(this, arguments);
          };

          // Intercept json to log activity
          res.json = function(data) {
            if (statusCode >= 200 && statusCode < 300) {
              try {
                logUpdateActivity(req, data);
              } catch (e) {
                sails.log.error('Error processing update response:', e);
              }
            }
            return originalJson.apply(this, arguments);
          };

          // Call the original action
          return originalActions.update(req, res, next);
        })
        .catch(err => {
          sails.log.warn(`Couldn't fetch original record for ${modelIdentity}:`, err);
          // Continue with original action even if fetch fails
          return originalActions.update(req, res, next);
        });
    } else {
      // If we don't have model or ID, just call original action
      return originalActions.update(req, res, next);
    }
  };

  // Override destroy action
  blueprintAPI.destroy = function(req, res, next) {
    // Get the model and ID
    const modelIdentity = req.options.model || req.options.alias;
    const Model = sails.models[modelIdentity];
    const recordId = req.params.id;

    // Only proceed if we have both model and ID
    if (Model && recordId) {
      // Find record to delete first
      Model.findOne(recordId)
        .then(recordToDelete => {
          // Store for later use
          req.recordToDelete = recordToDelete;

          // Set up response interceptors
          const originalSend = res.send;
          const originalJson = res.json;
          const originalStatus = res.status;

          let statusCode = 200;

          // Track status code
          res.status = function(code) {
            statusCode = code;
            return originalStatus.apply(this, arguments);
          };

          // Intercept send to log activity
          res.send = function(data) {
            if (statusCode >= 200 && statusCode < 300) {
              try {
                logDeleteActivity(req);
              } catch (e) {
                sails.log.error('Error processing delete response:', e);
              }
            }
            return originalSend.apply(this, arguments);
          };

          // Intercept json to log activity
          res.json = function(data) {
            if (statusCode >= 200 && statusCode < 300) {
              try {
                logDeleteActivity(req);
              } catch (e) {
                sails.log.error('Error processing delete response:', e);
              }
            }
            return originalJson.apply(this, arguments);
          };

          // Call the original action
          return originalActions.destroy(req, res, next);
        })
        .catch(err => {
          sails.log.warn(`Couldn't fetch record for ${modelIdentity} before deletion:`, err);
          // Continue with original action even if fetch fails
          return originalActions.destroy(req, res, next);
        });
    } else {
      // If we don't have model or ID, just call original action
      return originalActions.destroy(req, res, next);
    }
  };

  // Helper functions - remain largely the same
  async function logCreateActivity(req, data) {
    try {
      const modelIdentity = req.options.model || req.options.alias;

      // Skip if no data or no ID
      if (!data || !data.id) {
        return;
      }

      // Get user ID
      let userId = null;
      try {
        userId = await sails.helpers.getUserId.with({ req });
      } catch (err) {
        sails.log.verbose('No user ID found for activity log');
      }

      // Log activity
      await sails.helpers.logActivity.with({
        action: 'create',
        model: modelIdentity,
        recordId: data.id,
        changes: {},
        userId
      }).tolerate('modelNotTracked');
    } catch (err) {
      sails.log.error('Error logging create activity:', err);
    }
  }

  async function logUpdateActivity(req, data) {
    try {
      const modelIdentity = req.options.model || req.options.alias;
      const original = req.originalRecord || {};

      // Skip if no data or no ID
      if (!data || !data.id) {
        return;
      }

      // Get user ID
      let userId = null;
      try {
        userId = await sails.helpers.getUserId.with({ req });
      } catch (err) {
        sails.log.verbose('No user ID found for activity log');
      }

      // Calculate changes
      let changes = {};
      if (sails.config.activityLogger.trackData !== false) {
        changes = await sails.helpers.calculateChanges.with({
          original,
          updated: data
        });
      }

      // Only log if there are actual changes
      if (Object.keys(changes.before).length > 0 || Object.keys(changes.after).length > 0) {
        await sails.helpers.logActivity.with({
          action: 'update',
          model: modelIdentity,
          recordId: data.id,
          changes,
          userId
        }).tolerate('modelNotTracked');
      }
    } catch (err) {
      sails.log.error('Error logging update activity:', err);
    }
  }

  async function logDeleteActivity(req) {
    try {
      if (!req.recordToDelete || !req.recordToDelete.id) {
        return;
      }

      const modelIdentity = req.options.model || req.options.alias;

      // Get user ID
      let userId = null;
      try {
        userId = await sails.helpers.getUserId.with({ req });
      } catch (err) {
        sails.log.verbose('No user ID found for activity log');
      }

      // Prepare changes if tracking data
      let changes = {};
      if (sails.config.activityLogger.trackData !== false) {
        changes = { deleted: req.recordToDelete };
      }

      // Log activity
      await sails.helpers.logActivity.with({
        action: 'delete',
        model: modelIdentity,
        recordId: req.recordToDelete.id,
        changes,
        userId
      }).tolerate('modelNotTracked');
    } catch (err) {
      sails.log.error('Error logging delete activity:', err);
    }
  }
};