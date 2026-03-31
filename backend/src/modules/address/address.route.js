const express = require('express');
const router = express.Router();
const {
    getUserAddresses,
    getAddressById,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} = require('./address.controller');
const authenticateToken = require('../../middleware/authenticateToken');

// All address routes require authentication
router.use(authenticateToken);

router.get('/', getUserAddresses);
router.get('/:id', getAddressById);
router.post('/', createAddress);
router.put('/:id', updateAddress);
router.delete('/:id', deleteAddress);
router.post('/:id/set-default', setDefaultAddress);

module.exports = router;
