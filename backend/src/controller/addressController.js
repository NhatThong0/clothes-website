const Address = require('../model/Address');
const User = require('../model/User');
const { validateObjectId, validatePhone } = require('../utils/validators');

// Get user's addresses
exports.getUserAddresses = async (req, res, next) => {
    try {
        const userId = req.userId;

        const addresses = await Address.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: addresses,
        });
    } catch (error) {
        next(error);
    }
};

// Get address by ID
exports.getAddressById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        if (!validateObjectId(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid address ID' });
        }

        const address = await Address.findById(id);

        if (!address) {
            return res.status(404).json({ status: 'error', message: 'Address not found' });
        }

        // Check if address belongs to user
        if (address.userId.toString() !== userId) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }

        res.status(200).json({
            status: 'success',
            data: address,
        });
    } catch (error) {
        next(error);
    }
};

// Create address
exports.createAddress = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { fullName, phone, province, district, ward, street, zipCode, type, isDefault } = req.body;

        // Validation
        if (!fullName || !phone || !province || !district || !ward || !street) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide all required fields',
            });
        }

        if (!validatePhone(phone)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid phone number',
            });
        }

        // If this is the default address, set others to non-default
        if (isDefault) {
            await Address.updateMany({ userId }, { isDefault: false });
        }

        const address = new Address({
            userId,
            fullName,
            phone,
            province,
            district,
            ward,
            street,
            zipCode: zipCode || '',
            type: type || 'home',
            isDefault: isDefault || false,
        });

        await address.save();

        // Add address to user's addresses list
        await User.findByIdAndUpdate(userId, {
            $push: { addresses: address._id },
        });

        res.status(201).json({
            status: 'success',
            message: 'Address created successfully',
            data: address,
        });
    } catch (error) {
        next(error);
    }
};

// Update address
exports.updateAddress = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const { fullName, phone, province, district, ward, street, zipCode, type, isDefault } = req.body;

        if (!validateObjectId(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid address ID' });
        }

        const address = await Address.findById(id);

        if (!address) {
            return res.status(404).json({ status: 'error', message: 'Address not found' });
        }

        // Check if address belongs to user
        if (address.userId.toString() !== userId) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }

        // Validate phone if provided
        if (phone && !validatePhone(phone)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid phone number',
            });
        }

        // If this is being set as default, set others to non-default
        if (isDefault && !address.isDefault) {
            await Address.updateMany({ userId }, { isDefault: false });
        }

        const updatedAddress = await Address.findByIdAndUpdate(
            id,
            {
                fullName: fullName || address.fullName,
                phone: phone || address.phone,
                province: province || address.province,
                district: district || address.district,
                ward: ward || address.ward,
                street: street || address.street,
                zipCode: zipCode !== undefined ? zipCode : address.zipCode,
                type: type || address.type,
                isDefault: isDefault !== undefined ? isDefault : address.isDefault,
            },
            { new: true }
        );

        res.status(200).json({
            status: 'success',
            message: 'Address updated successfully',
            data: updatedAddress,
        });
    } catch (error) {
        next(error);
    }
};

// Delete address
exports.deleteAddress = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        if (!validateObjectId(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid address ID' });
        }

        const address = await Address.findById(id);

        if (!address) {
            return res.status(404).json({ status: 'error', message: 'Address not found' });
        }

        // Check if address belongs to user
        if (address.userId.toString() !== userId) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }

        await Address.findByIdAndDelete(id);

        // Remove address from user's addresses list
        await User.findByIdAndUpdate(userId, {
            $pull: { addresses: id },
        });

        res.status(200).json({
            status: 'success',
            message: 'Address deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// Set default address
exports.setDefaultAddress = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        if (!validateObjectId(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid address ID' });
        }

        const address = await Address.findById(id);

        if (!address) {
            return res.status(404).json({ status: 'error', message: 'Address not found' });
        }

        // Check if address belongs to user
        if (address.userId.toString() !== userId) {
            return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }

        // Set all addresses to non-default
        await Address.updateMany({ userId }, { isDefault: false });

        // Set this address as default
        address.isDefault = true;
        await address.save();

        res.status(200).json({
            status: 'success',
            message: 'Default address updated',
            data: address,
        });
    } catch (error) {
        next(error);
    }
};
