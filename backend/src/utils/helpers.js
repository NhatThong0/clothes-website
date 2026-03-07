// Format price
const formatPrice = (price) => {
    return price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
};

// Format date
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('vi-VN');
};

// Calculate discount price
const calculateDiscountPrice = (price, discount) => {
    return price - (price * discount) / 100;
};

// Calculate total from items
const calculateTotal = (items, shippingFee = 0, taxPercent = 10) => {
    const subtotal = items.reduce((acc, item) => {
        const discountedPrice = calculateDiscountPrice(item.price, item.discount || 0);
        return acc + discountedPrice * item.quantity;
    }, 0);

    const tax = (subtotal * taxPercent) / 100;
    const total = subtotal + shippingFee + tax;

    return {
        subtotal: Math.round(subtotal),
        tax: Math.round(tax),
        shippingFee,
        total: Math.round(total),
    };
};

// Generate order tracking number
const generateTrackingNumber = () => {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

// Check if product is in stock
const checkStock = (stock, quantity) => {
    return stock >= quantity;
};

// Paginate data
const paginate = (data, page = 1, limit = 10) => {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const result = {
        total: data.length,
        page,
        limit,
        totalPages: Math.ceil(data.length / limit),
        data: data.slice(startIndex, endIndex),
    };

    return result;
};

module.exports = {
    formatPrice,
    formatDate,
    calculateDiscountPrice,
    calculateTotal,
    generateTrackingNumber,
    checkStock,
    paginate,
};
