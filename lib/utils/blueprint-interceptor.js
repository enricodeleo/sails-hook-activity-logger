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

  // Override update action - properly handle async
  blueprintHooks.middleware.update = function(req, res) {
    // First fetch the original record
    const fetchOriginal = async () => {
      const modelIdentity = req.options.model || req.options.alias;
      const Model = sails.models[modelIdentity];

      if (Model && req.params.id) {
        try {
          req.originalRecord = await Model.findOne(req.params.id);
          sails.log.verbose(`Found original record for ${modelIdentity}:${req.params.id}`);
        } catch (err) {
          sails.log.warn(`Couldn't fetch original record for ${modelIdentity}:`, err);
        }
      }
    };

    // Override res.ok
    const originalOk = res.ok;
    res.ok = function(data) {
      logUpdateActivity(req, data);
      return originalOk.call(this, data);
    };

    // First fetch the original, then proceed with original action
    return fetchOriginal()
      .then(() => originalActions.update(req, res))
      .catch(err => {
        sails.log.error('Error in update blueprint interceptor:', err);
        return originalActions.update(req, res);
      });
  };

  // Override destroy action - properly handle async
  blueprintHooks.middleware.destroy = function(req, res) {
    // First fetch the record to be deleted
    const fetchToDelete = async () => {
      const modelIdentity = req.options.model || req.options.alias;
      const Model = sails.models[modelIdentity];

      if (Model && req.params.id) {
        try {
          req.recordToDelete = await Model.findOne(req.params.id);
          sails.log.verbose(`Found record to delete for ${modelIdentity}:${req.params.id}`);
        } catch (err) {
          sails.log.warn(`Couldn't fetch record for ${modelIdentity} before deletion:`, err);
        }
      }
    };

    // Override res.ok
    const originalOk = res.ok;
    res.ok = function(data) {
      logDeleteActivity(req);
      return originalOk.call(this, data);
    };

    // First fetch the record, then proceed with original action
    return fetchToDelete()
      .then(() => originalActions.destroy(req, res))
      .catch(err => {
        sails.log.error('Error in destroy blueprint interceptor:', err);
        return originalActions.destroy(req, res);
      });
  };

  // Helper functions stay the same
  async function logCreateActivity(req, data) {
    try {
      const modelIdentity = req.options.model || req.options.alias;

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

      // Log activity
      await sails.helpers.logActivity.with({
        action: 'update',
        model: modelIdentity,
        recordId: data.id,
        changes,
        userId
      }).tolerate('modelNotTracked');
    } catch (err) {
      sails.log.error('Error logging update activity:', err);
    }
  }

  async function logDeleteActivity(req) {
    try {
      if (!req.recordToDelete) {
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