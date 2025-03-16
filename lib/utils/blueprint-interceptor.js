/**
 * Blueprint Interceptor
 *
 * Hooks into Sails.js blueprint actions to log activities
 */
module.exports = function interceptBlueprints(sails) {
  // Only proceed if blueprints hook is enabled
  if (!sails.hooks.blueprints) {
    sails.log.warn('Activity Logger: Blueprints hook not found, blueprint tracking disabled');
    return;
  }

  const blueprintHooks = sails.hooks.blueprints;

  // Store original blueprint actions
  const originalActions = {
    create: blueprintHooks.middleware.create,
    update: blueprintHooks.middleware.update,
    destroy: blueprintHooks.middleware.destroy
  };

  // Override create action
  blueprintHooks.middleware.create = function(req, res) {
    const originalRes = {
      ok: res.ok,
      created: res.created
    };

    res.ok = function(data) {
      logCreateActivity(req, data);
      return originalRes.ok.call(this, data);
    };

    res.created = function(data) {
      logCreateActivity(req, data);
      return originalRes.created.call(this, data);
    };

    return originalActions.create(req, res);
  };

  // Override update action
  blueprintHooks.middleware.update = async function(req, res) {
    // Store original record for comparison
    const modelIdentity = req.options.model || req.options.alias;
    const Model = sails.models[modelIdentity];

    if (Model && req.params.id) {
      try {
        const original = await Model.findOne(req.params.id);
        req.originalRecord = original;
      } catch (err) {
        sails.log.warn(`Couldn't fetch original record for ${modelIdentity}:`, err);
      }
    }

    // Override res.ok
    const originalOk = res.ok;
    res.ok = function(data) {
      logUpdateActivity(req, data);
      return originalOk.call(this, data);
    };

    return originalActions.update(req, res);
  };

  // Override destroy action
  blueprintHooks.middleware.destroy = async function(req, res) {
    // Store record to be deleted
    const modelIdentity = req.options.model || req.options.alias;
    const Model = sails.models[modelIdentity];

    if (Model && req.params.id) {
      try {
        const recordToDelete = await Model.findOne(req.params.id);
        req.recordToDelete = recordToDelete;
      } catch (err) {
        sails.log.warn(`Couldn't fetch record for ${modelIdentity} before deletion:`, err);
      }
    }

    // Override res.ok
    const originalOk = res.ok;
    res.ok = function(data) {
      logDeleteActivity(req);
      return originalOk.call(this, data);
    };

    return originalActions.destroy(req, res);
  };

  // Helper functions
  function logCreateActivity(req, data) {
    try {
      const modelIdentity = req.options.model || req.options.alias;

      // Check if this model should be tracked
      if (!shouldTrackModel(modelIdentity)) {
        return;
      }

      const userId = sails.services.activityservice.getUserId(req);
      const recordId = data.id;

      // Log the activity
      sails.services.activityservice.log(
        'create',
        modelIdentity,
        recordId,
        {},
        userId
      );
    } catch (err) {
      sails.log.error('Error logging create activity:', err);
    }
  }

  function logUpdateActivity(req, data) {
    try {
      const modelIdentity = req.options.model || req.options.alias;

      // Check if this model should be tracked
      if (!shouldTrackModel(modelIdentity)) {
        return;
      }

      const userId = sails.services.activityservice.getUserId(req);
      const recordId = data.id;
      const original = req.originalRecord || {};

      // Calculate changes if tracking data is enabled
      let changes = {};
      if (sails.config.activityLogger.trackData !== false) {
        changes = sails.services.activityservice.calculateChanges(original, data);
      }

      // Log the activity
      sails.services.activityservice.log(
        'update',
        modelIdentity,
        recordId,
        changes,
        userId
      );
    } catch (err) {
      sails.log.error('Error logging update activity:', err);
    }
  }

  function logDeleteActivity(req) {
    try {
      const modelIdentity = req.options.model || req.options.alias;

      // Check if this model should be tracked
      if (!shouldTrackModel(modelIdentity)) {
        return;
      }

      if (!req.recordToDelete) {
        sails.log.warn(`No record to delete found for ${modelIdentity}`);
        return;
      }

      const userId = sails.services.activityservice.getUserId(req);
      const recordId = req.recordToDelete.id;

      // Create changes object with deleted record data if tracking data
      let changes = {};
      if (sails.config.activityLogger.trackData !== false) {
        changes = { deleted: req.recordToDelete };
      }

      // Log the activity
      sails.services.activityservice.log(
        'delete',
        modelIdentity,
        recordId,
        changes,
        userId
      );
    } catch (err) {
      sails.log.error('Error logging delete activity:', err);
    }
  }

  function shouldTrackModel(modelIdentity) {
    if (!modelIdentity) return false;

    // Get tracked models from config
    const trackedModels = sails.config.activityLogger.models || [];

    // Check if this model should be tracked
    return trackedModels.includes(modelIdentity);
  }
};