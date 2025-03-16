/**
 * ActivityService
 * Service for logging model activities
 */
class ActivityService {
  constructor(sails) {
    this.sails = sails;
  }

  /**
   * Log an activity
   *
   * @param {string} action - 'create', 'update', or 'delete'
   * @param {string} model - Model identity
   * @param {string|number} recordId - ID of affected record
   * @param {object} changes - For updates, contains before/after values
   * @param {string|number} userId - ID of user who performed action
   * @return {Promise<object>} Created activity log
   */
  async log(action, model, recordId, changes = {}, userId) {
    this.sails.log.debug('Attempting to log activity:', { action, model, recordId, userId });

    if (!userId) {
      this.sails.log.warn('Activity logged without userId');
    }

    try {
      // Ensure the model should be tracked
      const config = this.sails.config.activityLogger || {};
      if (config.models && !config.models.includes(model)) {
        this.sails.log.verbose(`Skipping activity log for non-tracked model: ${model}`);
        return null;
      }

      // Create activity log entry
      const created = await this.sails.models.activitylog.create({
        action,
        model,
        recordId,
        changes,
        userId
      }).fetch();

      this.sails.log.debug('Activity log created:', created);
      return created;
    } catch (err) {
      this.sails.log.error('Failed to log activity:', err);
      return null;
    }
  }

  /**
   * Extract user ID from request
   *
   * @param {object} req - Sails request object
   * @return {string|number|null} User ID if found
   */
  getUserId(req) {
    if (!req) return null;

    // Common user ID locations
    if (req.session && req.session.userId) return req.session.userId;
    if (req.user && req.user.id) return req.user.id;
    if (req.session && req.session.user && req.session.user.id) return req.session.user.id;

    return null;
  }

  /**
   * Calculate changes between original and updated record
   *
   * @param {object} original - Original record
   * @param {object} updated - Updated record
   * @return {object} Changes with before/after values
   */
  calculateChanges(original, updated) {
    if (!original || !updated) return {};

    const changes = {
      before: {},
      after: {}
    };

    Object.keys(updated).forEach(key => {
      // Skip functions and other non-serializable values
      if (typeof updated[key] === 'function') return;

      // Compare values (using JSON.stringify handles objects and arrays)
      if (JSON.stringify(original[key]) !== JSON.stringify(updated[key])) {
        changes.before[key] = original[key];
        changes.after[key] = updated[key];
      }
    });

    return changes;
  }
}

module.exports = ActivityService;