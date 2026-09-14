# Task board

Khuyến nghị chia task theo **domain**, tránh chia kiểu "mỗi người vài file".

- Frontend customer/catalog/cart
- Frontend admin/staff
- Backend auth/catalog
- Backend order/payment/inventory
- Backend warranty/repair/chatbot/report
- Database + integration + testing có owner riêng hoặc luân phiên review chéo

Mỗi task nên ghi Requirement ID (ví dụ `CUS-10`, `PAY-02`, `WH-03`) để trace lại đặc tả.
