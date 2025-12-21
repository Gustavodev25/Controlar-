import express from 'express';

const router = express.Router();

router.all('*', (req, res) => {
    res.status(404).json({ error: 'Pluggy functions disabled.' });
});

export default router;
