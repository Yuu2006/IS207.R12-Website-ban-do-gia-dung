# Git workflow

1. Pull `develop` trước khi bắt đầu.
2. Tạo branch `feature/<module>-<task>`.
3. Mỗi commit chỉ nên chứa một thay đổi logic rõ ràng.
4. Không commit `.env`, password, VNPay secret hoặc DB dump có dữ liệu nhạy cảm.
5. Tạo Pull Request vào `develop`; sau khi test ổn định mới merge `develop` → `main`.
