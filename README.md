# 🎫 TicketBooking - Hệ thống quản lý đặt vé tàu

Giao diện demo đơn giản cho hệ thống quản lý đặt vé tàu với 3 vai trò: Hành khách, Nhân viên cơ sở, Nhân viên trụ sở.

## 📋 Cấu trúc Project

```
TicketBooking/
├── server.js                      # File chính
├── package.json                   # Dependencies
├── config/
│   └── database.js                # Kết nối SQL Server
├── views/                         # EJS Templates
│   ├── role-selection.ejs         # Trang chọn vai trò
│   ├── login.ejs                  # Trang đăng nhập
│   ├── register.ejs               # Trang đăng ký
│   ├── dashboard-passenger.ejs    # Dashboard hành khách
│   ├── dashboard-staff-base.ejs   # Dashboard nhân viên cơ sở
│   └── dashboard-staff-hq.ejs     # Dashboard nhân viên trụ sở
├── public/
│   ├── css/
│   │   └── style.css              # Styling
│   └── js/
│       └── dashboard.js           # JavaScript
└── README.md
```

## 🚀 Hướng dẫn cài đặt

### 1. Cài đặt Node.js
Tải từ: https://nodejs.org/

### 2. Cài đặt Dependencies
```bash
cd d:\TicketBooking
npm install
```

### 3. Cấu hình Database
File `config/database.js` đã được cấu hình sẵn với:
- **Server**: 26.64.196.112
- **Port**: 1433
- **Username**: sa
- **Password**: 12345
- **Database**: QLBV

### 4. Chạy ứng dụng
```bash
npm start
```
Hoặc sử dụng nodemon để auto-reload:
```bash
npm run dev
```

### 5. Truy cập ứng dụng
Mở browser và truy cập: http://localhost:3000

## 👥 Các vai trò & Tính năng

### 🧑 Hành khách (Passenger)
- **Đăng nhập/Đăng ký** bằng username & password
- Xem **thông tin cá nhân**
- Xem **danh sách vé** của mình
- Xem **thông tin chuyến tàu** có sẵn

### 💼 Nhân viên cơ sở (Staff Base)
- **Đăng nhập** bằng số điện thoại & tài khoản
- Xem **thông tin cá nhân** & cơ sở
- Xem **chuyến tàu** & **thông tin tàu**
- **Quản lý khách hàng** (thêm, sửa, xóa)
- **Quản lý vé** (bán, hủy vé)
- Xem **thống kê doanh số** tại cơ sở

### 🏢 Nhân viên trụ sở (Staff HQ)
- **Đăng nhập** bằng số điện thoại & tài khoản
- Xem **thông tin cá nhân**
- **Quản lý toàn bộ người dùng** & nhân viên
- **Quản lý chuyến tàu** (thêm, sửa, xóa)
- **Quản lý vé** toàn hệ thống
- Xem **báo cáo thống kê** từ tất cả cơ sở

## 🔐 Tài khoản Demo

### Hành khách
- Username: `demo_user`
- Password: `123456`

### Nhân viên cơ sở
- Số điện thoại: `0123456789`
- Tài khoản: `NV001`
- Password: `123456`

### Nhân viên trụ sở
- Số điện thoại: `0987654321`
- Tài khoản: `QL001`
- Password: `123456`

*(Lưu ý: Các tài khoản này cần được tạo trong database trước khi sử dụng)*

## 🎨 Giao diện

### Màu sắc chính
- Primary: `#667eea` (Purple Blue)
- Secondary: `#764ba2` (Purple)
- Success: `#28a745` (Green)
- Info: `#17a2b8` (Cyan)
- Danger: `#dc3545` (Red)

### Font
- Font family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif

## 📱 Responsive Design
Giao diện được tối ưu hóa cho:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🔧 Các API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/` | Trang chọn vai trò |
| GET | `/login` | Trang đăng nhập |
| POST | `/login` | Xử lý đăng nhập |
| GET | `/register` | Trang đăng ký |
| POST | `/register` | Xử lý đăng ký |
| GET | `/dashboard` | Dashboard chính |
| GET | `/logout` | Đăng xuất |

## ⚠️ Lưu ý quan trọng

1. **Database**: Bạn cần tạo bảng và dữ liệu trong SQL Server trước khi sử dụng
2. **Environment**: Hiện tại mã chưa sử dụng .env file, cài đặt DB được hardcode
3. **Security**: Mã này là demo, không nên sử dụng trực tiếp trong production
4. **Authentication**: Session được lưu trữ trong memory, không thích hợp cho multi-server

## 📝 TODO

- [ ] Kết nối đầy đủ với database (CRUD operations)
- [ ] Validation form tốt hơn
- [ ] Error handling coreage hơn
- [ ] Thêm file .env
- [ ] Thêm hash password
- [ ] Thêm JWT authentication
- [ ] Unit testing
- [ ] API documentation

## 👨‍💻 Tác giả
Xây dựng cho dự án TicketBooking

## 📄 License
MIT
