# NGHIÊN CỨU CÔNG NGHỆ SERN STACK VÀ PHÁT TRIỂN HỆ THỐNG WEBSITE THƯƠNG MẠI ĐIỆN TỬ BÁN SÁCH TRỰC TUYẾN

## Giới thiệu

Đây là repository của đồ án/tiểu luận chuyên ngành tại HCMUTE với đề tài nghiên cứu công nghệ SERN Stack và phát triển hệ thống website thương mại điện tử bán sách trực tuyến.

Trong phạm vi đề tài, SERN Stack được sử dụng với:

* SQL Server
* Express.js
* React.js
* Node.js

Repository được tổ chức theo mô hình tách biệt Frontend và Backend nhằm hỗ trợ quá trình phát triển và quản lý mã nguồn.

## Mục tiêu

Mục tiêu của dự án là nghiên cứu và ứng dụng SERN Stack trong việc phát triển một hệ thống website thương mại điện tử bán sách trực tuyến.

Ở thời điểm hiện tại, project đang trong giai đoạn khởi tạo và thiết lập môi trường phát triển.

## Công nghệ sử dụng

### Frontend

* React.js
* Vite

### Backend

* Node.js
* Express.js

### Database

* Microsoft SQL Server

### Công cụ

* Visual Studio Code
* Git
* npm

## Kiến trúc dự kiến

Hệ thống được định hướng theo kiến trúc Client - Server:

```text
React.js (Frontend)
        │
        │ HTTP/API
        ▼
Node.js + Express.js (Backend)
        │
        │ Database Access
        ▼
Microsoft SQL Server
```

Frontend chịu trách nhiệm xây dựng giao diện người dùng.

Backend chịu trách nhiệm xử lý các request từ frontend và cung cấp API cho hệ thống.

Microsoft SQL Server dự kiến được sử dụng làm hệ quản trị cơ sở dữ liệu của hệ thống.

> Các thành phần và chức năng chi tiết sẽ được triển khai trong các giai đoạn phát triển tiếp theo.

## Cấu trúc thư mục

```text
website/
├── client/                 # Frontend - React.js + Vite
├── server/                 # Backend - Node.js + Express.js
├── .gitignore
└── README.md
```

## Yêu cầu môi trường

Project hiện được phát triển với các công cụ chính:

* Node.js
* npm
* Git
* Microsoft SQL Server

## Cài đặt và chạy dự án

### 1. Clone repository

```bash
git clone <repository-url>
cd website
```

### 2. Chạy Frontend

```bash
cd client
npm install
npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:5173/
```

### 3. Chạy Backend

Mở một terminal khác:

```bash
cd server
npm install
npm start
```

Backend chạy tại:

```text
http://localhost:3000/
```

Endpoint kiểm tra hiện tại:

```text
GET /
```

Response:

```text
SERN Bookstore Backend is running.
```

## Trạng thái dự án

**Project initialization completed.**

Hiện tại project đã hoàn thành các công việc khởi tạo:

* Khởi tạo Git repository.
* Khởi tạo Frontend với React.js và Vite.
* Khởi tạo Backend với Node.js và Express.js.
* Thiết lập `.gitignore`.
* Kiểm tra Frontend có thể chạy.
* Kiểm tra Backend có thể chạy.

Các chức năng nghiệp vụ của hệ thống chưa được triển khai ở giai đoạn này.

## Tác giả

Sinh viên ngành Công nghệ Thông tin
HCMUTE
