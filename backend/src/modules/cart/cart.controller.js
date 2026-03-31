const Cart = require('../../model/Cart');
const Product = require('../../model/Product');
const { validateObjectId } = require('../../utils/validators');

// Get user's cart
exports.getCart = async (req, res, next) => {
    try {
        const userId = req.userId;

        let cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            cart = new Cart({ userId, items: [] });
            await cart.save();
        }

        res.status(200).json({
            status: 'success',
            data: cart,
        });
    } catch (error) {
        next(error);
    }
};

// Add to cart
exports.addToCart = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { productId, quantity = 1, color, size } = req.body;

        // Validation
        if (!productId || quantity < 1) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid product or quantity',
            });
        }

        if (!validateObjectId(productId)) {
            return res.status(400).json({ status: 'error', message: 'Invalid product ID' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ status: 'error', message: 'Product not found' });
        }

        // Check if stock is available
        if (product.stock < quantity) {
            return res.status(400).json({ status: 'error', message: 'Insufficient stock' });
        }

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        // Check if product already in cart
        const existingItem = cart.items.find(
            item => item.productId.toString() === productId && item.color === color && item.size === size
        );

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.items.push({
                productId,
                quantity,
                color: color || '',
                size: size || '',
                addedAt: new Date(),
            });
        }

        cart.updatedAt = new Date();
        await cart.save();

        await cart.populate('items.productId');

        res.status(200).json({
            status: 'success',
            message: 'Product added to cart',
            data: cart,
        });
    } catch (error) {
        next(error);
    }
};

// Update cart item quantity
exports.updateCartItem = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { productId, quantity, color = '', size = '' } = req.body;
 
        if (!productId || quantity < 0)
            return res.status(400).json({ status: 'error', message: 'Invalid product or quantity' });
        if (!validateObjectId(productId))
            return res.status(400).json({ status: 'error', message: 'Invalid product ID' });
 
        const cart = await Cart.findOne({ userId });
        if (!cart)
            return res.status(404).json({ status: 'error', message: 'Cart not found' });
 
        // ✅ Tìm đúng item theo productId + color + size
        const cartItem = cart.items.find(item =>
            item.productId.toString() === productId &&
            (item.color || '') === color &&
            (item.size  || '') === size
        );
 
        if (!cartItem)
            return res.status(404).json({ status: 'error', message: 'Item not in cart' });
 
        if (quantity === 0) {
            cart.items = cart.items.filter(item =>
                !(item.productId.toString() === productId &&
                  (item.color || '') === color &&
                  (item.size  || '') === size)
            );
        } else {
            cartItem.quantity = quantity;
        }
 
        cart.updatedAt = new Date();
        await cart.save();
        await cart.populate('items.productId');
 
        res.status(200).json({ status: 'success', message: 'Cart updated', data: cart });
    } catch (error) {
        next(error);
    }
};

// Remove from cart
exports.removeFromCart = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { productId, color = '', size = '' } = req.body;
 
        if (!productId || !validateObjectId(productId))
            return res.status(400).json({ status: 'error', message: 'Invalid product ID' });
 
        const cart = await Cart.findOne({ userId });
        if (!cart)
            return res.status(404).json({ status: 'error', message: 'Cart not found' });
 
        // ✅ Xóa đúng item theo productId + color + size
        const before = cart.items.length;
        cart.items = cart.items.filter(item =>
            !(item.productId.toString() === productId &&
              (item.color || '') === color &&
              (item.size  || '') === size)
        );
 
        if (cart.items.length === before)
            return res.status(404).json({ status: 'error', message: 'Item not in cart' });
 
        cart.updatedAt = new Date();
        await cart.save();
        await cart.populate('items.productId');
 
        res.status(200).json({ status: 'success', message: 'Product removed from cart', data: cart });
    } catch (error) {
        next(error);
    }
};

// Clear cart
exports.clearCart = async (req, res, next) => {
    try {
        const userId = req.userId;

        const cart = await Cart.findOneAndUpdate(
            { userId },
            { items: [], updatedAt: new Date() },
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({ status: 'error', message: 'Cart not found' });
        }

        res.status(200).json({
            status: 'success',
            message: 'Cart cleared',
            data: cart,
        });
    } catch (error) {
        next(error);
    }
};
