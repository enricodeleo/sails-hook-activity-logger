module.exports = {
  friendlyName: 'Get user ID',
  description: 'Extract the user ID from a request object',

  inputs: {
    req: {
      type: 'ref',
      description: 'The request object',
      required: true
    }
  },

  exits: {
    success: {
      description: 'Successfully returned the user ID',
      outputType: 'string'
    },
    notFound: {
      description: 'No user ID could be found in the request'
    }
  },

  fn: async function(inputs, exits) {
    const req = inputs.req;

    // Try to find user ID in common locations
    if (req.session && req.session.userId) {
      return exits.success(req.session.userId);
    }

    if (req.user && req.user.id) {
      return exits.success(req.user.id);
    }

    if (req.session && req.session.user && req.session.user.id) {
      return exits.success(req.session.user.id);
    }

    // Check for JWT token if available
    if (req.headers && req.headers.authorization) {
      try {
        // This assumes you're using sails-hook-organics/jwt
        if (sails.hooks.jwt) {
          const token = req.headers.authorization.replace('Bearer ', '');
          const payload = sails.hooks.jwt.verify(token);
          if (payload && payload.sub) {
            return exits.success(payload.sub);
          }
        }
      } catch (err) {
        sails.log.verbose('Failed to extract user ID from JWT token:', err);
      }
    }

    return exits.notFound();
  }
};
