const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const recordsRoutes = require('./routes/records.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const dictionaryRoutes = require('./routes/dictionary.routes');
const importsRoutes = require('./routes/imports.routes');
const auditRoutes = require('./routes/audit.routes');
const settingsRoutes = require('./routes/settings.routes');
const classificationRulesRoutes = require('./routes/classificationRules.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ data: { status: 'ok' } }));
app.use('/api/records', recordsRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/dictionary', dictionaryRoutes);
app.use('/api/imports', importsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/classification-rules', classificationRulesRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

app.use(errorHandler);

module.exports = app;
