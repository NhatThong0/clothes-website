# DaClothes - Nền Tảng Thương Mại Điện Tử

**DaClothes** là một ứng dụng web thương mại điện (B2C) hiện đại, toàn diện dành cho việc mua bán thời trang trực tuyến. Nó cho phép khách hàng duyệt sản phẩm, quản lý giỏ hàng, đặt hàng, và cung cấp bảng điều khiển quản trị toàn quyền cho người quản lý để kiểm soát toàn bộ hoạt động kinh doanh.

# Mô Tả Dự Án
## Dành cho Khách hàng
- DaClothes là một nền tảng Wesite thương mại điện tử (B2C) đầy đủ tính năng với:
- Trải nghiệm mua sắm: Duyệt sản phẩm với bộ lọc thông minh, tìm kiếm và phân loại theo danh mục.
- Giỏ hàng & Thanh toán: Quản lý giỏ hàng (Local Persistence), hệ thống voucher giảm giá và quy trình đặt hàng tối ưu.
- Tài khoản cá nhân: Xác thực JWT an toàn, quản lý nhiều địa chỉ giao hàng và theo dõi lịch sử đơn hàng.
- Giao diện: Thiết kế Responsive (Sky Blue theme) tương thích hoàn hảo với Mobile, Tablet và Desktop.
## Bảng Điều Khiển Quản Trị (Admin Dashboard)
- Thống kê: Biểu đồ doanh thu theo tháng, tổng hợp số lượng đơn hàng, người dùng và sản phẩm.
- Quản lý kho: Thêm/Sửa/Xóa sản phẩm, quản lý tồn kho và danh mục.
- Xử lý đơn hàng: Quy trình đổi trạng thái đơn hàng chuyên nghiệp (Chờ duyệt -> Đang giao -> Hoàn thành).
- Khuyến mãi: Hệ thống tạo mã Voucher linh hoạt (theo % hoặc số tiền cố định).
- Tương tác: Quản lý phản hồi/đánh giá từ khách hàng.
# Công Nghệ Sử Dụng
Frontend             : "React.js, Vite, TailwindCSS, Redux Toolkit"
Backend              : "Node.js, Express.js"
Database             :MongoDB (Mongoose)
Authentication       :"JSON Web Token (JWT), Bcryptjs"
# Hướng Dẫn Cài Đặt
## Yêu Cầu Hệ Thống
- **Node.js** v14 trở lên
- **npm** hoặc **yarn**
- **MongoDB** (local hoặc Atlas)

## Bước 1: Cài Đặt Backend
```bash
cd backend
npm install
# Tạo file .env dựa trên mẫu sau:
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
CLIENT_URL=http://localhost:5173
```
## Bước 2: Cài Đặt Frontend
```bash
cd frontend
npm install
```

## Bước 3: Khởi chạy dự án
```bash
# Terminal 1 - Backend
cd backend
npm run dev
```
```bash
# Terminal 2 - Frontend
cd frontend
npm run dev
```
# Design System
## Colors
- **Primary**: #0EA5E9 (Sky Blue)
- **Secondary**: #06B6D4 (Cyan)
- **Dark**: #0C2340 (Dark Blue)
- **Light**: #F0F9FF (Light Sky)
- **White**: #FFFFFF

## Responsive Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

# Bảo Mật & Hiệu Năng
✅ Mã hóa mật khẩu bằng Bcryptjs.
✅ Bảo vệ API bằng CORS và Middleware xác thực.
✅ Tối ưu hiệu năng với Lazy loading và Pagination (phân trang).
✅ Quản lý biến môi trường chặt chẽ qua file

# Lộ Trình Phát Triển (Next Steps)
- Tích hợp cổng thanh toán trực tuyến (Stripe/Momo/VNPay).
- Lưu trữ hình ảnh tập trung trên Cloudinary/AWS S3.
- Hệ thống thông báo tự động qua Email (Nodemailer).
- Ứng dụng di động (React Native).