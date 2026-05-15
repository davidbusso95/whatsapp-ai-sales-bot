const express = require('express');
const testController = require('../controllers/test.controller');

const router = express.Router();

router.get('/', testController.testRoute);
router.post('/send-message', testController.sendTestMessage);
router.get('/products', testController.getProducts);
router.post('/ai', testController.testAI);

module.exports = router;
