import express from 'express';

const router = express.Router();

// Use router.use with '/' to match all paths safely without regex errors
router.use('/', (req, res) => {
  res.json({ success: true, message: 'Cron sync disabled' });
});

export default router;
