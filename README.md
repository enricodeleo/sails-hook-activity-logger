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
  includeBlueprints: true
};
```

## Usage

### Automatic Tracking with Blueprints

If you use Sails.js blueprints, activities will be tracked automatically for configured models when:

- Records are created via blueprint actions
- Records are updated via blueprint actions
- Records are deleted via blueprint actions

### Manual Tracking

You can also manually log activities:

```javascript
// In your controller
await sails.services.activityservice.log(
  'update',           // action: 'create', 'update', or 'delete'
  'project',          // model: the model identity
  123,                // recordId: ID of the affected record
  {                   // changes: before/after values
    before: { name: 'Old Project Name' },
    after: { name: 'New Project Name' }
  },
  req.user.id         // userId: the user who performed the action
);
```
## Working with Activities

The hook creates an activitylog model which you can query like any other model:

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

