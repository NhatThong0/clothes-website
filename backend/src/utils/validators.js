// Email validation
const validateEmail = (email) => {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
};

// Password validation
const validatePassword = (password) => {
    return password && password.length >= 6;
};

// Phone number validation (Vietnamese)
const validatePhone = (phone) => {
    const phoneRegex = /^(\+84|0)[0-9]{9,10}$/;
    return phoneRegex.test(phone);
};

// Name validation
const validateName = (name) => {
    return name && name.trim().length >= 2;
};

// Validate product ID format (MongoDB ObjectId)
const validateObjectId = (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};

module.exports = {
    validateEmail,
    validatePassword,
    validatePhone,
    validateName,
    validateObjectId,
};
