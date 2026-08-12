const errorHandler = (err, req, res, next) => {
  console.error('[API Error Handler]:', err.name, err.message);

  if (err.name === 'ZodError') {
    const messages = (err.errors || err.issues || []).map(i => typeof i === 'string' ? i : i.message).filter(Boolean);
    return res.status(400).json({ error: messages[0] || 'Validation Error', details: messages });
  }

  // Mongoose duplicate key error
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(', ');
    return res.status(409).json({ error: `Conflict: Duplicate value for ${field}` });
  }

  // Mongoose validation error (has .errors object)
  if (err.name === 'ValidationError' && err.errors) {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: messages[0] || 'Validation Error', details: messages });
  }

  // Express v5 header validation error (e.g. malformed 'Forwarded' header)
  if (err.name === 'ValidationError') {
    console.warn('Express ValidationError (likely proxy header):', err.message);
    return res.status(400).json({ error: 'Bad Request' });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(404).json({ error: 'Not Found: Invalid ID format' });
  }

  // MongoDB network error (connection drop)
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
    console.error('Database connection error:', err.message);
    return res.status(503).json({ error: 'Database unavailable: Unable to connect to MongoDB.' });
  }

  console.error('[Unhandled Server Error]:', err);
  return res.status(500).json({ error: err.message || 'Internal Server Error' });
};

module.exports = errorHandler;
