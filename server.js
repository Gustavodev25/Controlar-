import express from 'express';
import routes from './api/routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use('/api', routes);
app.use('/', routes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
