export default async (req, res) => {
  const { method, body, query, params, logger } = req;
  
  logger.info(`Test deploy handler called: ${method}`, {
    hasBody: !!body,
    query,
    params
  });

  res.status(200).json({
    message: 'Test deploy function working',
    method,
    timestamp: new Date().toISOString()
  });
}; 