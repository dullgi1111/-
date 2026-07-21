module.exports = function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: { message: '입력값이 올바르지 않습니다', details: err.issues } });
  }
  const status = err.status || 500;
  res.status(status).json({ error: { message: err.message || 'Internal Server Error' } });
};
