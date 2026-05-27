const errorHandler = (err, req, res, next) => {
  console.log("Error Name:", err.name, err.message);

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation Error', details: err.errors || err.issues });
  }

  // Mongoose duplicate key error
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(', ');
    return res.status(409).json({ error: `Conflict: Duplicate value for ${field}` });
  }

  // Mongoose validation error (has .errors object)
  if (err.name === 'ValidationError' && err.errors) {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Validation Error', details: messages });
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
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

module.exports = errorHandler;
