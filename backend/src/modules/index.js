const auth = require('./auth');
const product = require('./product');
const cart = require('./cart');
const order = require('./order');
const address = require('./address');
const admin = require('./admin');
const upload = require('./upload');
const user = require('./user');
const inventory = require('./inventory');
const chat = require('./chat');
const aiChat = require('./ai-chat');
const payment = require('./payment');
const voucher = require('./voucher');
const shipping = require('./shipping');
const banner = require('./banner');
const promotion = require('./promotion');
const notification = require('./notification');

const routeRegistry = [
  ['auth', '/api/auth', auth.route],
  ['product', '/api/products', product.route],
  ['cart', '/api/cart', cart.route],
  ['order', '/api/orders', order.route],
  ['address', '/api/addresses', address.route],
  ['admin', '/api/admin', admin.route],
  ['upload', '/api/upload', upload.route],
  ['banner', '/api/banners', banner.route],
  ['promotion', '/api/promotions', promotion.route],
  ['user', '/api/user', user.route],
  ['inventory', '/api/admin/inventory', inventory.route],
  ['chat', '/api/chat', chat.route],
  ['aiChat', '/api/ai-chat', aiChat.route],
  ['payment', '/api/payment', payment.route],
  ['voucher', '/api/vouchers', voucher.route],
  ['shipping', '/api/shipping', shipping.route],
  ['notification', '/api/notifications', notification.route],
];

module.exports = {
  auth,
  product,
  cart,
  order,
  address,
  admin,
  upload,
  user,
  inventory,
  chat,
  aiChat,
  payment,
  voucher,
  shipping,
  banner,
  promotion,
  notification,
  routeRegistry,
};
