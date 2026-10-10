const router = require('express').Router();
const { dataConnect } = require('../config/firebase');

router.get('/', (req, res) => res.json({ status: 'ok' }));

router.get('/db', async (req, res) => {
  try {
    const result = await dataConnect.executeQuery('ListFeedbacks');
    res.json({ db: 'connected', rows: result.data.feedbacks.length });
  } catch (e) {
    res.status(500).json({ db: 'error', message: e.message });
  }
});

module.exports = router;