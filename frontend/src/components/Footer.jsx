import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-dark text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">F</span>
              </div>
              <span className="font-bold text-lg">Fashion Hub</span>
            </div>
            <p className="text-gray-300 text-sm">
              Thời trang chất lượng cao với giá tốt nhất cho bạn.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Khám phá</h4>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li><Link to="/products" className="hover:text-primary transition-all">Tất cả sản phẩm</Link></li>
              <li><Link to="/products?category=men" className="hover:text-primary transition-all">Nam</Link></li>
              <li><Link to="/products?category=women" className="hover:text-primary transition-all">Nữ</Link></li>
              <li><Link to="/products?category=sale" className="hover:text-primary transition-all">Khuyến mãi</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">Hỗ trợ</h4>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li><a href="#" className="hover:text-primary transition-all">Liên hệ</a></li>
              <li><a href="#" className="hover:text-primary transition-all">Chính sách bảo mật</a></li>
              <li><a href="#" className="hover:text-primary transition-all">Điều khoản sử dụng</a></li>
              <li><a href="#" className="hover:text-primary transition-all">FAQ</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Liên hệ</h4>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>📧 info@fashionhub.com</li>
              <li>📞 0123 456 789</li>
              <li>📍 123 Đường chính, TP. HCM</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-300 text-sm">
              © 2026 Fashion Hub. Tất cả quyền được bảo lưu.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a href="#" className="text-gray-300 hover:text-primary transition-all">Facebook</a>
              <a href="#" className="text-gray-300 hover:text-primary transition-all">Instagram</a>
              <a href="#" className="text-gray-300 hover:text-primary transition-all">Twitter</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
