# sails-hook-activity-logger

A Sails.js hook for tracking model activities (create, update, delete) with user attribution and change tracking.

## Installation

```bash
npm install sails-hook-activity-logger --save
```

## Configuration

Configuration options can be set in `config/activityLogger.js`:

```javascript
module.exports.activityLogger = {
  // Models to track (required)
  models: ['user', 'project', 'document'],

  // Track data changes (optional, default: true)
  trackData: true,

  // Hook into blueprint actions (optional, default: true)
  includeBlueprints: true,
  
  // Custom routes to log activities for (optional)
  // Only used if includeBlueprints is true
  routesToLog: [
    'POST /api/:model',        // create
    'PUT /api/:model/:id',     // update
    'PATCH /api/:model/:id',   // partial update
    'DELETE /api/:model/:id',  // destroy
    
    // You can add custom routes as needed:
    'POST /api/v1/:model',
    'PUT /api/v1/:model/:id',
    // etc.
  ]
};
```

## Usage

### Automatic Tracking with Blueprints

If you use Sails.js blueprints, activities will be tracked automatically for configured models when:

- Records are created via blueprint actions
- Records are updated via blueprint actions
- Records are deleted via blueprint actions

The hook uses a middleware approach that listens to routes matching the patterns in `routesToLog`. This ensures no interference with the normal request-response flow.

### Manual Tracking

You can also manually log activities using the provided helper:

```javascript
// In your controller
await sails.helpers.logActivity.with({
  action: 'update',           // 'create', 'update', or 'delete'
  model: 'project',           // the model identity
  recordId: '123',            // ID of the affected record
  changes: {                  // before/after values
    before: { name: 'Old Project Name' },
    after: { name: 'New Project Name' }
  },
  userId: req.user.id         // the user who performed the action
});
```

### Helper Methods

The hook provides several helpers:

```javascript
// Log an activity
await sails.helpers.logActivity.with({
  action, model, recordId, changes, userId
});

// Extract user ID from request
const userId = await sails.helpers.getUserId.with({
  req
});

// Calculate changes between records
const changes = await sails.helpers.calculateChanges.with({
  original, updated
});

// Fetch recent activities
const activities = await sails.helpers.getLatestActivities.with({
  model: 'project',
  limit: 20,
  populate: true
});
```

## Working with Activities

The hook creates an `activitylog` model which you can query like any other model:

```javascript
// Get recent activities
const activities = await ActivityLog.find()
  .sort('createdAt DESC')
  .limit(10)
  .populate('user');

// Get activities for a specific record
const recordActivities = await ActivityLog.find({
  model: 'project',
  recordId: '123'
}).sort('createdAt DESC');

// Get activities by a specific user
const userActivities = await ActivityLog.find({
  userId: req.user.id
}).sort('createdAt DESC');
```

## How It Works

This hook uses a non-intrusive middleware approach to track activities:

1. It binds to routes matching the patterns in `routesToLog`
2. When a request to one of these routes is processed, it:
   - Captures the original record state (for update/delete)
   - Lets the request proceed normally
   - After response completes successfully, logs the activity
3. This approach ensures minimal interference with the normal request/response flow

## License

MIT