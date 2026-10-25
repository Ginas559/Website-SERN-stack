# SERN Bookstore

## Công nghệ

- SQL Server
- Express.js và Node.js
- React.js và Vite
- JWT, bcryptjs, express-validator

## Cấu trúc chính

```text
website/
├── client/
└── server/
    ├── server.js
    └── src/
        ├── app.js
        ├── config/
        ├── controllers/
        ├── middleware/
        ├── migration/
        ├── models/
        ├── routes/
        ├── services/
        └── utils/
```

## Cài đặt

```bash
cd server
npm install
cd ../client
npm install
```

Tạo database `BookStore` trong SQL Server. Sau đó tạo `server/.env` từ
[`server/.env.example`](server/.env.example), điền thông tin SQL Server,
`ACCESS_TOKEN_SECRET` và `REFRESH_TOKEN_SECRET`.

Không chạy trực tiếp từng file SQL. Migration được quản lý bằng:

```text
server/src/migration/
├── 001_create_users_table.sql
├── 002_create_refresh_tokens_table.sql
├── 003_rebuild_users_table.sql
├── 004_add_reset_password_expiry.sql
├── 005_add_reset_password_used_at.sql
└── migrationRunner.js
```

Kiểm tra trạng thái migration:

```bash
cd server
npm run migration:status
```

Ví dụ:

```text
[x] 001_create_users_table.sql
[ ] 002_create_refresh_tokens_table.sql
```

Chạy các migration chưa chạy:

```bash
npm run migration:run
```

Runner sẽ tạo bảng `dbo.DatabaseMigrations`, đọc các file `.sql` theo thứ tự số,
chạy file chưa có trong bảng lịch sử, và ghi nhận file sau khi chạy thành công.
Mỗi migration được chạy trong transaction; nếu lỗi thì transaction rollback và
file đó vẫn ở trạng thái `[ ]`. Các thành viên có số lượng migration khác nhau
chỉ cần kéo code mới và chạy lại lệnh trên.

Không sửa nội dung migration đã chạy. Khi cần thay đổi database, tạo file mới,
ví dụ `003_add_phone_to_users.sql`.

## Chạy ứng dụng

Terminal 1:

```bash
cd server
npm start
```

Terminal 2:

```bash
cd client
npm run dev
```

Frontend: `http://localhost:5173/`  
Health check: `GET http://localhost:3000/api/health`

## Authentication API

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| POST | `/api/auth/register` | Đăng ký Customer và hash password |
| POST | `/api/auth/login` | Nhận access token và HttpOnly refresh cookie |
| POST | `/api/auth/refresh` | Rotation refresh token |
| POST | `/api/auth/logout` | Thu hồi refresh token và xóa cookie |
| POST | `/api/auth/forgot-password` | Tạo reset token có thời hạn |
| POST | `/api/auth/reset-password` | Đổi password bằng reset token |
| POST | `/api/auth/change-password` | Đổi password khi đã đăng nhập |

Payload cho các luồng mật khẩu:

- `POST /api/auth/forgot-password`: `{ "email": "..." }`
- `POST /api/auth/reset-password`: `{ "token": "...", "password": "...", "confirmPassword": "..." }`
- `POST /api/auth/change-password`: `{ "currentPassword": "...", "newPassword": "...", "confirmPassword": "..." }`

Endpoint `change-password` yêu cầu `Authorization: Bearer <accessToken>`.
| GET | `/api/users/me` | Lấy user hiện tại bằng Bearer access token |
| GET | `/api/users/admin-check` | Route chỉ dành cho Admin |

Tài khoản đăng ký mới có role `Customer`. Có thể cấp quyền Admin bằng SQL:

```sql
UPDATE dbo.Users SET isAdmin = 1 WHERE email = 'admin@example.com';
```

Để bật email reset password, tự điền `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` và `CLIENT_URL` trong `server/.env`.
Không chạy migration tự động khi khởi động ứng dụng; sau khi kiểm tra trạng thái,
chạy `npm run migration:run` thủ công.
