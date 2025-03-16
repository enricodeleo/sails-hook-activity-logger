/**
 * Activity Logger Middleware
 * 
 * A middleware to track model activities (create, update, delete) without interfering
 * with the normal request-response flow.
 */

const _ = require('@sailshq/lodash');

module.exports = async function activityLoggerMiddleware(req, res, next) {
  // Get access to app instance
  const sails = req._sails;

  // Extract model information
  const modelIdentity = req.params.model || req.options.model || req.options.alias;
  
  // Skip middleware if model isn't found or shouldn't be tracked
  if (!modelIdentity || !sails.models[modelIdentity]) {
    return next();
  }

  // Check if model should be tracked
  try {
    const shouldTrack = await sails.helpers.shouldTrackModel.with({
      model: modelIdentity
    });
    
    if (!shouldTrack) {
      return next();
    }
  } catch (err) {
    sails.log.error('Error checking if model should be tracked:', err);
    return next();
  }

  const Model = sails.models[modelIdentity];
  const recordId = req.params.id;
  const method = req.method;

  // Determine action based on HTTP method and path
  let action;
  if (method === 'POST') {
    action = 'create';
  } else if (method === 'PUT' || method === 'PATCH') {
    action = 'update';
  } else if (method === 'DELETE') {
    action = 'delete';
  } else {
    // Not a trackable action
    return next();
  }

  // For update and delete, we need the original record for change tracking
  let originalRecord;
  if ((action === 'update' || action === 'delete') && recordId) {
    try {
      originalRecord = await Model.findOne(recordId);
      // Store for later use
      req.originalRecord = originalRecord;
    } catch (err) {
      sails.log.warn(`Couldn't fetch original record for ${modelIdentity}:`, err);
      // Continue anyway - logging will still work without the changes
    }
  }

  // Now bind a one-time listener that will fire when the request is finished
  res.once('finish', async function onceFinish() {
    try {
      // Skip logging for unsuccessful requests
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }

      // Get user ID
      let userId = null;
      try {
        userId = await sails.helpers.getUserId.with({ req });
      } catch (err) {
        sails.log.verbose('No user ID found for activity log');
      }

      // For creation - we need to find the newly created record's ID
      // This is more complex and may require additional app-specific logic
      if (action === 'create') {
        // We'll use the response body if it was a JSON response
        // This is a simplification and might need customization
        await logCreateActivity(req, res, userId);
      } 
      // For updates - calculate changes between original and updated record
      else if (action === 'update' && originalRecord) {
        await logUpdateActivity(req, res, originalRecord, userId);
      }
      // For deletes - log the deleted record
      else if (action === 'delete' && originalRecord) {
        await logDeleteActivity(req, originalRecord, userId);
      }
    } catch (err) {
      // Don't let activity logging errors affect the request
      sails.log.error('Error in activity logger middleware:', err);
    }
  });

  // Continue with request processing - don't block!
  return next();
};

/**
 * Helper function to log create activities
 */
async function logCreateActivity(req, res, userId) {
  const sails = req._sails;
  const modelIdentity = req.params.model || req.options.model || req.options.alias;
  
  // We need the ID of the created record
  // For REST APIs, we might be able to get it from the response
  // This might need customization for your specific API
  
  // For now, use a simple approach to try to extract the ID
  let recordId;
  
  // Look at the Location header for RESTful APIs
  const locationHeader = res.get('Location');
  if (locationHeader) {
    // Extract ID from the Location header
    const parts = locationHeader.split('/');
    recordId = parts[parts.length - 1];
  }
  
  // If we couldn't get it from headers, we might need app-specific approach
  // This is just a placeholder - you'll likely need to customize this
  if (!recordId) {
    sails.log.warn('Could not determine record ID for create activity');
    return;
  }

  // Log the activity
  await sails.helpers.logActivity.with({
    action: 'create',
    model: modelIdentity,
    recordId: recordId,
    changes: {},  // No changes for create
    userId
  }).tolerate('modelNotTracked');
}

/**
 * Helper function to log update activities
 */
async function logUpdateActivity(req, res, originalRecord, userId) {
  const sails = req._sails;
  const modelIdentity = req.params.model || req.options.model || req.options.alias;
  const recordId = req.params.id;
  
  if (!recordId || !originalRecord) {
    return;
  }
  
  // Fetch the updated record to calculate changes
  try {
    const Model = sails.models[modelIdentity];
    const updatedRecord = await Model.findOne(recordId);
    
    if (!updatedRecord) {
      sails.log.warn(`Could not find updated record ${modelIdentity}:${recordId}`);
      return;
    }
    
    // Calculate changes
    let changes = {};
    if (sails.config.activityLogger.trackData !== false) {
      changes = await sails.helpers.calculateChanges.with({
        original: originalRecord,
        updated: updatedRecord
      });
    }
    
    // Only log if there are actual changes
    if (Object.keys(changes.before).length > 0 || Object.keys(changes.after).length > 0) {
      await sails.helpers.logActivity.with({
        action: 'update',
        model: modelIdentity,
        recordId: recordId,
        changes,
        userId
      }).tolerate('modelNotTracked');
    }
  } catch (err) {
    sails.log.error('Error logging update activity:', err);
  }
}

/**
 * Helper function to log delete activities
 */
async function logDeleteActivity(req, originalRecord, userId) {
  const sails = req._sails;
  const modelIdentity = req.params.model || req.options.model || req.options.alias;
  const recordId = req.params.id;
  
  if (!recordId || !originalRecord) {
    return;
  }
  
  // Prepare changes if tracking data
  let changes = {};
  if (sails.config.activityLogger.trackData !== false) {
    changes = { deleted: originalRecord };
  }
  
  // Log activity
  await sails.helpers.logActivity.with({
    action: 'delete',
    model: modelIdentity,
    recordId: recordId,
    changes,
    userId
  }).tolerate('modelNotTracked');
}