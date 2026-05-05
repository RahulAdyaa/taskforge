const errorHandler = (err, req, res, next) => {
  console.log("Error Name:", err.name, err.message);
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation Error', details: err.errors || err.issues });
  }

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Conflict: Unique constraint failed' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Not Found' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

module.exports = errorHandler;
