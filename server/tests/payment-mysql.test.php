<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated' || getenv('DB_HOST') !== '127.0.0.1' || getenv('DB_PORT') === '3306' || !preg_match('/^homecare_order_test_[0-9]+$/D', getenv('DB_NAME') ?: '')) exit(1);
require_once __DIR__ . '/../utils/order-api.php';
use HomeCare\OrderApi\{ApiException, OrderModel, CheckoutService, CatalogCheckoutDependencies, OrderService, PaymentService};
use function HomeCare\OrderApi\{vnpaySignature, orderCanonicalHash};

$pdo = new PDO('mysql:host=127.0.0.1;port=' . getenv('DB_PORT') . ';dbname=' . getenv('DB_NAME') . ';charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec("SET time_zone = '+00:00'");
putenv('CHECKOUT_SHIPPING_VND=30000'); putenv('CHECKOUT_FREE_SHIPPING_MIN_VND=500000');
putenv('BANK_TRANSFER_BIN=970422'); putenv('BANK_TRANSFER_ACCOUNT_NO=123456789'); putenv('BANK_TRANSFER_ACCOUNT_NAME=TEST BENEFICIARY');
putenv('VNPAY_TMN_CODE=TESTCODE'); putenv('VNPAY_HASH_SECRET=isolated-test-secret-not-a-real-credential'); putenv('VNPAY_RETURN_URL=http://localhost:5173/payment/result');
putenv('STORE_NAME=Original test merchant');
$actor = ['id' => '1', 'role' => 'CUSTOMER']; $staff = ['id' => '3', 'role' => 'SALES'];
$model = new OrderModel($pdo); $deps = new CatalogCheckoutDependencies(); $checkout = new CheckoutService($model, $deps); $orders = new OrderService($model, $deps); $payments = new PaymentService($model);
function verify(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function reject(callable $run, string $code): void { try { $run(); } catch (ApiException $e) { verify($e->errorCode === $code, "Expected $code, got {$e->errorCode}"); return; } throw new RuntimeException("Expected $code"); }
function value(string $sql, array $args = []): mixed { global $pdo; $q=$pdo->prepare($sql); $q->execute($args); return $q->fetchColumn(); }
// Independent Node crypto fixture for the sorted RFC1738 payload, not a sign/verify self-test.
verify(vnpaySignature(['vnp_TxnRef'=>'TEST-1','vnp_OrderInfo'=>'Thanh toan don hang','vnp_Amount'=>'10000'], 'fixture-only') === '080e5fb9af5836ee29bb044b6d8d8b3e3e686c4cda6f088204c813602da69b6e6529ad6962c2d3338be7b76b174448f15f1024988cfcedd8fc7bdc6bbaae936e', 'VNPAY signature fixture mismatch');
function newOrder(string $method = 'BANK_TRANSFER'): array {
    global $deps, $pdo, $actor, $checkout;
    $cart = $deps->cart($pdo, $actor);
    $deps->replaceCart($pdo, $actor, ['expectedCartVersion' => $cart['cartVersion'], 'items' => [['skuId' => '1', 'quantity' => 1]]], 'payment-cart-' . bin2hex(random_bytes(12)));
    $cart = $deps->cart($pdo, $actor);
    $input = ['cartVersion' => $cart['cartVersion'], 'addressId' => (string) value('SELECT id FROM addresses WHERE user_id = 1 LIMIT 1'), 'paymentMethod' => $method, 'voucherCode' => null];
    $quote = $checkout->quoteCheckout($actor, $input);
    $key = 'payment-checkout-' . bin2hex(random_bytes(12));
    $body = $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'Payment integration test'];
    $result = $checkout->createOrder($actor, $body, $key);
    verify(orderCanonicalHash($result) === orderCanonicalHash($checkout->createOrder($actor, $body, $key)), 'Checkout replay differs');
    return $result;
}
function signedIpn(array $payment, string $reference, array $overrides = []): array {
    $date = (new DateTimeImmutable('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('YmdHis');
    $query = array_replace(['vnp_TmnCode' => 'TESTCODE', 'vnp_TxnRef' => $payment['reference'], 'vnp_Amount' => (string) ($payment['amount'] * 100), 'vnp_ResponseCode' => '00', 'vnp_TransactionStatus' => '00', 'vnp_TransactionNo' => $reference, 'vnp_PayDate' => $date], $overrides);
    $query['vnp_SecureHash'] = vnpaySignature($query, getenv('VNPAY_HASH_SECRET'));
    return $query;
}

$result = newOrder(); $id = $result['order']['id']; $bank = $payments->status($actor, $id, false);
verify($bank['status'] === 'pending' && $bank['bank']['accountName'] === 'TEST BENEFICIARY', 'QR transfer must start pending');
reject(fn () => $payments->document($actor, $id, false, 'CUSTOMER'), 'NOT_PAID');
reject(fn () => $payments->status(['id'=>'2','role'=>'CUSTOMER'], $id, false), 'ORDER_NOT_FOUND');
reject(fn () => $payments->confirmTransfer($actor, $id, [], 'customer-may-not-confirm'), 'FORBIDDEN');
$input = ['expectedVersion' => $bank['version'], 'amount' => $bank['amount'] - 1, 'bankTransactionRef' => 'BANK-TEST-001', 'reason' => 'Test bank statement checked'];
reject(fn () => $payments->confirmTransfer($staff, $id, $input, 'bank-mismatch-unique'), 'AMOUNT_MISMATCH');
verify($payments->status($actor,$id,false)['status']==='pending','Mismatch marked paid');
$input['amount'] = $bank['amount'];
$paid = $payments->confirmTransfer($staff, $id, $input, 'bank-confirm-unique');
verify(orderCanonicalHash($paid) === orderCanonicalHash($payments->confirmTransfer($staff, $id, $input, 'bank-confirm-unique')), 'Confirmation replay differs');
verify(count($paid['audit']) === 1 && $paid['status'] === 'paid', 'Audit missing/duplicated');
reject(fn () => $payments->confirmTransfer($staff, $id, $input, 'bank-new-key-stale'), 'ORDER_VERSION_CONFLICT');
$bill = $payments->document($actor, $id, false, 'CUSTOMER');
putenv('STORE_NAME=Changed merchant');
$pdo->exec("UPDATE products SET name = 'Renamed current catalog' WHERE id = 1");
verify($bill === $payments->document($actor,$id,false,'CUSTOMER'),'Reprint changed');
$internal = $payments->document($staff,$id,true,'INTERNAL');
verify($bill['snapshot'] === $internal['snapshot'] && !isset($bill['paymentAudit']) && isset($internal['paymentAudit']),'Document scope/snapshots wrong');
reject(fn () => $payments->document($actor,$id,false,'INTERNAL'),'FORBIDDEN');

$second = newOrder()['order']; $state = $payments->status($actor,$second['id'],false);
reject(fn () => $payments->confirmTransfer($staff,$second['id'],['expectedVersion'=>$state['version'],'amount'=>$state['amount'],'bankTransactionRef'=>'BANK-TEST-001','reason'=>'Same reference must not pay two orders'],'duplicate-transfer-key'),'REFERENCE_ALREADY_USED');
verify($payments->status($actor,$second['id'],false)['status']==='pending','Duplicate reference changed order');
$before=(int)value('SELECT stock_quantity FROM product_variants WHERE id=1');
$cancel = $orders->cancelOrder($actor,$second['id'],['expectedVersion'=>$second['version'],'reason'=>'Cancel before bank confirmation'],'cancel-bank-order-key');
verify((int)value('SELECT stock_quantity FROM product_variants WHERE id=1')===$before+1,'Cancel did not release once');
$late=$payments->confirmTransfer($staff,$second['id'],['expectedVersion'=>$cancel['version'],'amount'=>$state['amount'],'bankTransactionRef'=>'BANK-LATE-002','reason'=>'Late incoming transfer after cancellation'],'late-transfer-unique');
verify($late['refundRequired'] && value('SELECT order_status FROM orders WHERE id=?',[$second['id']])==='CANCELLED','Late bank payment revived order');
reject(fn () => $payments->document($actor,$second['id'],false,'CUSTOMER'),'PAYMENT_REVIEW_REQUIRED');
verify((int)value('SELECT stock_quantity FROM product_variants WHERE id=1')===$before+1,'Late payment touched stock');

$vnp = newOrder('VNPAY'); $id=$vnp['order']['id']; $payment=$payments->status($actor,$id,false);
verify(str_starts_with($vnp['payment']['redirectUrl'],'https://sandbox.vnpayment.vn/'),'VNPay not sandbox');
$query=signedIpn($payment,'900001'); $forged=$query; $forged['vnp_Amount']='1';
verify($payments->ipn($forged)['RspCode']==='97','Forged signature accepted');
verify($payments->ipn(signedIpn($payment,'900001',['vnp_PayDate'=>'']))['RspCode']==='97','Missing signed payment date accepted');
verify($payments->ipn(signedIpn($payment,'900001',['vnp_Amount'=>'1']))['RspCode']==='04','Wrong amount accepted');
verify($payments->ipn($query)['RspCode']==='00' && $payments->ipn($query)['RspCode']==='02','IPN replay wrong');
verify($payments->status($actor,$id,false)['status']==='paid','Valid IPN not settled');
verify($payments->ipn(signedIpn($payment,'900001',['vnp_ResponseCode'=>'24','vnp_TransactionStatus'=>'02']))['RspCode']==='02','Failure overwrote paid');
$vnpLate=newOrder('VNPAY')['order']; $pending=$payments->status($actor,$vnpLate['id'],false);
$orders->cancelOrder($actor,$vnpLate['id'],['expectedVersion'=>$vnpLate['version'],'reason'=>'Cancel before VNPay response'],'cancel-vnpay-late-key');
verify($payments->ipn(signedIpn($pending,'900002'))['RspCode']==='00','Late IPN not recorded');
verify($payments->status($actor,$vnpLate['id'],false)['refundRequired'],'Late IPN not flagged');

$expired = newOrder('VNPAY')['order'];
$before = (int) value('SELECT stock_quantity FROM product_variants WHERE id=1');
$pdo->prepare("UPDATE payments SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE order_id = ?")->execute([$expired['id']]);
verify($payments->expirePendingVnpay($deps) === 1 && $payments->expirePendingVnpay($deps) === 0, 'Expiry worker is not idempotent');
verify((int) value('SELECT stock_quantity FROM product_variants WHERE id=1') === $before + 1, 'Expiry did not release stock once');
verify(value('SELECT order_status FROM orders WHERE id=?',[$expired['id']]) === 'CANCELLED','Expiry did not cancel waiting order');

// Runtime HTTP dispatcher enforces both CSRF and ownership without trusting return query values.
putenv('ORDER_STORAGE_MODE=mysql');
$session=['user'=>$actor,'expiresAt'=>time()+3600,'csrfToken'=>'payment-test-csrf'];
$response=HomeCare\OrderApi\handleOrderApi('GET','/orders/'.$id.'/document',[], '', [], ['user'=>['id'=>'2','role'=>'CUSTOMER'],'expiresAt'=>time()+3600]);
verify($response['status']===404,'HTTP foreign document leaked');
$response=HomeCare\OrderApi\handleOrderApi('POST','/sales/orders/'.$second['id'].'/payment/confirm-transfer',[], '{}', ['Content-Type'=>'application/json'], ['user'=>$staff,'expiresAt'=>time()+3600,'csrfToken'=>'payment-test-csrf']);
verify($response['status']===403,'Missing CSRF accepted');
putenv('ORDER_STORAGE_MODE=disabled');
echo "PASS payment: real cart/checkout, bank evidence/amount/reference/replay, owner/roles, frozen customer/internal documents, signed IPN and late callbacks\n";
