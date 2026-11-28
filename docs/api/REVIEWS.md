# Product reviews (CUS-12, REV-01/02/03)

## Source and behavior

React: `client/src/components/reviews/ProductReviews.jsx`, `client/src/pages/admin/ReviewModerationPage.jsx`, `client/src/services/review-service.js` → API router: `server/routes/review-routes.php` → controller/service/model under `server/controllers/`, `server/services/`, `server/models/` → MySQL migration `024_product_review_lifecycle.sql`.

- A customer can create one review for an order line only when the line belongs to them and its order is `COMPLETED`. Rating is 1–5; text is required (1–3000 characters). The first review is immutable.
- Review images are uploaded one file at a time using `POST /api/uploads/images` with `type=reviews`. The server validates actual MIME, image decoding, size (5 MB), dimensions (maximum 6000×6000), and generated filename. `REVIEW_MAX_IMAGES` controls attachments per review (default 5, allowed 0–10).
- Optional context is limited to room area (0.1–1000 m²), household size (1–30), frequency, noise, consumption perception, and cleaning ease. Public API omits customer ID/name/email/phone.
- REV-03 is a context-only follow-up: one at day 30 through day 89, and one from day 90 onward. Each requires all six context fields and cannot change the original rating/text. The 30-day and 90-day milestones are independently unique.
- ADMIN can only hide or restore a review. A reason is required and the visibility change is recorded in `audit_logs`; no endpoint edits customer content.
- Product rating/count queries include only visible, non-deleted reviews. Context and rating filters apply to public reviews.

## Endpoints

| Method / path | Access | Input | Result |
| --- | --- | --- | --- |
| `GET /api/products/{productId}/reviews` | Public | Optional `rating`, `usageFrequency`, `noisePerception`, `consumptionPerception`, `cleaningEase`, `minRoomAreaM2`, `maxRoomAreaM2`, `householdSize`, `page`, `pageSize` | `{ items, pagination }`; excludes hidden/deleted reviews and identifying data. |
| `GET /api/reviews/eligible?productId={id}` | CUSTOMER | Query product ID | Completed order lines owned by the customer; includes review ID and due follow-up milestones. |
| `POST /api/reviews` | CUSTOMER | `{ orderItemId, rating, content, photos: string[], context: object }` | Creates immutable review (201). Photos must be server upload URLs under `/uploads/reviews/`. |
| `POST /api/reviews/{id}/followups` | CUSTOMER owner | `{ milestoneDays: 30\|90, context: object }` | Adds one complete context reflection for an available milestone (201). |
| `GET /api/admin/reviews` | ADMIN | Optional `visibility=visible\|hidden`, `rating`, `page`, `pageSize` | Moderation list; no personal account data. |
| `PATCH /api/admin/reviews/{id}/visibility` | ADMIN | `{ isVisible: boolean, reason: string }` | Hides/restores only; writes an audit record. |

`401` means no session, `403` means wrong role/ownership, `409` means duplicate review or a follow-up window/milestone conflict, `422` means invalid fields, and `404` means review not found. Write requests use the standard session cookie and CSRF token.

## Validation notes

- Review photos allow JPEG, PNG, WebP; default 5 MB and 6000×6000 per file. Maximum attached count is configurable by `REVIEW_MAX_IMAGES`.
- Follow-up context enums: usage `RARELY`, `FEW_TIMES_WEEK`, `DAILY`, `MULTIPLE_DAILY`; noise `QUIET`, `ACCEPTABLE`, `NOISY`, `VERY_NOISY`; consumption `LOWER_THAN_EXPECTED`, `AS_EXPECTED`, `HIGHER_THAN_EXPECTED`, `UNKNOWN`; cleaning `EASY`, `ACCEPTABLE`, `DIFFICULT`, `NOT_APPLICABLE`.
- The allowed follow-up windows are an implementation rule for the two milestones: 30-day context from day 30 until before day 90, and 90-day context starting at day 90. A later milestone never overwrites an earlier one.
