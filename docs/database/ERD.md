# ERD — HomeCare (MVP)

Cập nhật 12/11/2026 theo schema sau `server/db/setup.php migrate` (baseline + migration 008–020) trên MySQL 8.4. Sơ đồ chỉ vẽ khóa chính, khóa ngoại và cột nghiệp vụ chính; kiểu dữ liệu đầy đủ xem file migration. Tiền dùng `DECIMAL(14,2)` (VND nguyên), thời gian lưu UTC.

Quy ước chung: hầu hết bảng nghiệp vụ có `created_at`, `updated_at`, `is_deleted` (xóa mềm). Bảng `schema_migrations` do `setup.php` tạo để ghi các file đã áp.

## 1. Tài khoản và hồ sơ (CUS-01..05, USR-01)

```mermaid
erDiagram
    users ||--o{ addresses : "có"
    users ||--o{ auth_login_attempts : "ghi lần đăng nhập"
    users ||--o{ audit_logs : "thực hiện"
    users |o--o{ users : "admin_locked_by"
    users {
        bigint id PK
        varchar email UK
        varchar phone UK
        varchar role "CUSTOMER | ADMIN | SALES | WAREHOUSE"
        varchar status
        tinyint failed_login_count
        datetime locked_until
        datetime admin_locked_at
    }
    addresses {
        bigint id PK
        bigint user_id FK
        varchar recipient_name
        varchar phone
        varchar address_line
        tinyint is_default
    }
```

## 2. Catalog và kho (PRD, WH-03/04)

```mermaid
erDiagram
    categories |o--o{ categories : "parent_id"
    categories ||--o{ products : "chứa"
    brands ||--o{ products : "sản xuất"
    categories ||--o{ product_attributes : "định nghĩa"
    products ||--o{ product_attribute_values : "có giá trị"
    product_attributes ||--o{ product_attribute_values : "kiểu"
    products ||--o{ product_images : "ảnh"
    products ||--o{ product_variants : "SKU"
    product_variants ||--o{ inventory_movements : "biến động"
    order_items |o--o{ inventory_movements : "giữ/hoàn theo đơn"
    products {
        bigint id PK
        bigint category_id FK
        bigint brand_id FK
        varchar product_code UK
        varchar slug UK
        smallint warranty_months
        tinyint is_active
    }
    product_variants {
        bigint id PK
        bigint product_id FK
        varchar sku UK
        decimal price
        decimal sale_price
        datetime sale_starts_at
        datetime sale_ends_at
        int stock_quantity
        int low_stock_threshold
        tinyint is_active
    }
    product_attributes {
        bigint id PK
        bigint category_id FK
        varchar attribute_key "UK cùng category_id"
        enum data_type "text | number | boolean"
        varchar unit
    }
    inventory_movements {
        bigint id PK
        bigint variant_id FK
        bigint order_item_id FK
        varchar movement_type
        int quantity_change
        int quantity_before
        int quantity_after
        varchar reference_code UK
        bigint performed_by FK
    }
```

`banners` đứng riêng (không khóa ngoại). Chi tiết quy tắc catalog/kho: [CATALOG-INVENTORY.md](CATALOG-INVENTORY.md).

## 3. Giỏ hàng, voucher, wishlist (CUS-10/11, PROMO)

```mermaid
erDiagram
    users ||--o| carts : "một giỏ"
    carts ||--o{ cart_items : "dòng"
    product_variants ||--o{ cart_items : "SKU"
    vouchers ||--o{ voucher_usages : "lượt dùng"
    users ||--o{ voucher_usages : "khách"
    orders |o--o{ voucher_usages : "áp vào đơn"
    users ||--o{ wishlists : "lưu"
    products ||--o{ wishlists : "được lưu"
    carts {
        bigint id PK
        bigint user_id FK
        bigint version "chống ghi đè"
    }
    vouchers {
        bigint id PK
        varchar code UK
        varchar discount_type
        decimal discount_value
        int usage_limit
        int per_customer_limit
        datetime starts_at
        datetime ends_at
    }
    wishlists {
        bigint id PK
        bigint user_id FK
        bigint product_id FK "UK cùng user_id"
        tinyint is_deleted
    }
```

## 4. Đơn hàng, thanh toán, trả hàng (ORD, CHK, PAY, RET)

```mermaid
erDiagram
    users ||--o{ orders : "đặt"
    orders ||--o{ order_items : "snapshot dòng hàng"
    product_variants ||--o{ order_items : "SKU"
    orders ||--o{ order_status_history : "lịch sử"
    orders ||--o{ payments : "thanh toán"
    payments ||--o{ payment_events : "sổ cái"
    orders ||--o{ order_documents : "chứng từ"
    orders ||--o{ shipments : "giao hàng"
    orders ||--o{ order_return_requests : "yêu cầu trả"
    order_return_requests ||--o{ order_return_status_history : "lịch sử"
    order_return_requests ||--o| order_simulated_refunds : "hoàn tiền mô phỏng"
    payments ||--o| order_simulated_refunds : "khoản thu gốc"
    users ||--o{ order_idempotency : "khóa chống gửi lặp"
    orders {
        bigint id PK
        varchar order_code UK
        bigint customer_id FK
        varchar recipient_name "snapshot"
        varchar shipping_address "snapshot"
        decimal total_amount
        varchar payment_method "COD | VNPAY | BANK_TRANSFER"
        varchar payment_status
        varchar order_status
        varchar inventory_state "RESERVED | CONSUMED | RELEASED | UNTRACKED"
        bigint version
        datetime placed_at
    }
    order_items {
        bigint id PK
        bigint order_id FK
        bigint variant_id FK
        varchar product_name "snapshot"
        varchar sku "snapshot"
        decimal unit_price "snapshot"
        int quantity
        decimal line_total
    }
    payments {
        bigint id PK
        bigint order_id FK
        varchar payment_code
        decimal amount
        varchar status
        datetime expires_at
    }
```

Trạng thái đơn và trạng thái thanh toán tách riêng. Doanh thu ghi nhận ở lần đầu đơn chuyển `COMPLETED` (`order_status_history`), hoàn tiền ghi ở `order_simulated_refunds` — xem [DASHBOARD-METRICS.md](../api/DASHBOARD-METRICS.md).

## 5. Hỗ trợ chọn mua và sau mua (HOME, FIT, TCO, LIFE, CARE, BOT, REV)

```mermaid
erDiagram
    users ||--o{ room_profiles : "hồ sơ phòng"
    categories |o--o{ fit_rules : "quy tắc theo danh mục"
    products |o--o{ fit_rules : "hoặc theo sản phẩm"
    fit_rules ||--o{ fit_rule_versions : "phiên bản"
    users |o--o{ decision_events : "lượt FitCheck/TCO"
    order_items ||--o| owned_devices : "tạo thiết bị"
    users ||--o{ owned_devices : "sở hữu"
    owned_devices ||--o{ care_tasks : "lịch bảo trì"
    care_rules ||--o{ care_tasks : "sinh lịch"
    care_rules ||--o{ care_rule_supplies : "vật tư"
    product_variants ||--o{ care_rule_supplies : "SKU vật tư"
    users ||--o{ chatbot_faqs : "updated_by"
    order_items ||--o{ product_reviews : "đánh giá"
    decision_events {
        bigint id PK
        char request_key UK
        enum event_type "FIT_CHECK | TCO"
        enum fit_result "FIT | NEEDS_CHECK | NOT_FIT"
    }
    chatbot_faqs {
        bigint id PK
        varchar question
        varchar keywords
        enum status "DRAFT | ACTIVE | INACTIVE"
        int version
    }
```

## 6. Bảng phạm vi cũ (giữ, không dùng trong MVP)

`repair_requests`, `repair_appointments`, `repair_quotes`, `repair_quote_items`, `repair_media`, `repair_expenses`, `repair_status_history`, `repair_work_logs`, `repair_service_reviews`, `technician_unavailability`, `warranties`, `support_tickets`, `payment_reconciliations` và cột `payments.repair_request_id` đến từ baseline của phạm vi trước. Không triển khai, không xóa (theo AGENTS.md).

## 7. Index phục vụ truy vấn thường dùng

| Truy vấn | Index |
| --- | --- |
| Lọc sản phẩm theo danh mục/thương hiệu/trạng thái | `products.idx_product_filter (category_id, brand_id, is_active)` |
| Thông số cho FitCheck/so sánh | `products.idx_product_specs`, `product_attribute_values.uq_product_attribute` |
| Đơn của khách theo thời gian | `orders.idx_orders_customer_date (customer_id, placed_at)` |
| Dashboard/CSV theo kỳ | `orders.idx_orders_placed_at`, `orders.idx_orders_status_date`, `order_status_history.idx_status_history_status_order` (migration 020) |
| Hoàn tiền theo kỳ | `order_simulated_refunds.idx_simulated_refund_created` |
| Lượt FitCheck/TCO theo kỳ | `decision_events.idx_decision_type_date`, `idx_decision_created` (020) |
| Wishlist của khách | `wishlists.idx_wishlist_user_created` |

Đã kiểm bằng `EXPLAIN` trên dữ liệu seed: trước migration 020, lọc `orders.placed_at` quét toàn bảng và gom lịch sử `COMPLETED` quét toàn index; sau 020 lần lượt dùng `range` và `ref`. Bảng catalog (~60 sản phẩm, ~70 SKU) quét toàn bảng vẫn nhanh nên chưa thêm index cho cảnh báo tồn.
