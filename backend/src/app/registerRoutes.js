const { routeRegistry } = require('../modules');

function registerRoutes(app) {
  app.get('/', (req, res) =>
    res.status(200).json({ status: 'success', message: 'Server running...' }),
  );

  routeRegistry.forEach(([, path, route]) => {
    app.use(path, route);
  });
}

module.exports = { registerRoutes };
