<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated' || getenv('DB_HOST') !== '127.0.0.1' || getenv('DB_PORT') === '3306' || !preg_match('/^homecare_order_test_[0-9]+$/D', getenv('DB_NAME') ?: '')) exit(1);
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../utils/order-api.php';
require_once __DIR__ . '/../services/installation-checklist-service.php';
require_once __DIR__ . '/../models/room-fit-model.php';
require_once __DIR__ . '/../services/tco-service.php';
require_once __DIR__ . '/../models/chatbot-model.php';
require_once __DIR__ . '/../services/chatbot-service.php';
require_once __DIR__ . '/../services/care-service.php';
require_once __DIR__ . '/../models/care-model.php';

$pdo = new PDO('mysql:host=127.0.0.1;port=' . getenv('DB_PORT') . ';dbname=' . getenv('DB_NAME') . ';charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec("SET time_zone = '+00:00'");
$checklists = new InstallationChecklistService(new InstallationChecklistModel($pdo));
$rooms = new RoomFitModel($pdo);
$reports = new HomeCare\OrderApi\ReportService($pdo, new HomeCare\OrderApi\ReportModel($pdo));
$owner = ['id'=>'1','role'=>'CUSTOMER','status'=>'ACTIVE','expiresAt'=>time()+3600]; $admin = ['id'=>'4','role'=>'ADMIN'];
function week4Assert(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function week4Reject(int $status, callable $operation): void {
    try { $operation(); } catch (ApiException $error) { week4Assert($error->status === $status, 'Expected HTTP '.$status.', got '.$error->status); return; }
    throw new RuntimeException('Expected HTTP '.$status);
}
function week4Uuid(): string { $s=bin2hex(random_bytes(16)); return substr($s,0,8).'-'.substr($s,8,4).'-4'.substr($s,13,3).'-8'.substr($s,17,3).'-'.substr($s,20,12); }
function week4Value(string $sql, array $args=[]): mixed { global $pdo; $q=$pdo->prepare($sql); $q->execute($args); return $q->fetchColumn(); }
$range = ['from'=>'2021-01-01','to'=>'2021-01-31'];
$mode = $argv[1] ?? 'test';
if ($mode === 'init') {
    $missing = $reports->dashboard($admin, $range);
    week4Assert($missing['decisionTools']['installationChecklistsCompleted']===null && $missing['metricSources']['installationChecklistsCompleted']['status']==='UNAVAILABLE','Absent migration must not become a fake zero');
    $pdo->exec(file_get_contents(__DIR__.'/../db/migrations/021_installation_checklists.sql'));
    $pdo->exec(file_get_contents(__DIR__.'/../db/migrations/026_installation_checklist_reference_photo.sql'));
    echo "PASS: checklist metric is unavailable before 021; migrations 021 and 026 applied only to isolated DB.\n"; exit;
}
if ($mode === 'prepare-race') {
    $roomId = $rooms->createRoom(1, ['name'=>'Isolated checklist race']);
    echo json_encode(['productId'=>20,'roomProfileId'=>$roomId,'checks'=>array_fill_keys(array_keys(InstallationChecklistService::ITEMS),true),'expectedVersion'=>0,'requestKey'=>week4Uuid()]); exit;
}
if ($mode === 'race-worker') {
    $input=json_decode($argv[2],true,16,JSON_THROW_ON_ERROR);
    try { echo json_encode(['ok'=>true,'result'=>$checklists->save($owner,$input)]); }
    catch (ApiException $error) { echo json_encode(['ok'=>false,'status'=>$error->status]); }
    exit;
}
if ($mode === 'verify-race') {
    $input=json_decode($argv[2],true,16,JSON_THROW_ON_ERROR);
    $result=$checklists->get($owner,['productId'=>20,'roomProfileId'=>$input['roomProfileId']]);
    week4Assert($result['version']===1 && $result['completed'] && count($result['history'])===1,'Race must create one revision and one completion only');
    echo "PASS: concurrent checklist requests created one revision/completion.\n"; exit;
}

$roomId=$rooms->createRoom(1,['name'=>'Week 4 test room']);
$query=['productId'=>20,'roomProfileId'=>$roomId];
$empty=$checklists->get($owner,$query);
week4Assert($empty['version']===0 && !$empty['completed'] && $empty['firstCompletedAt']===null,'New checklist must be empty');
week4Reject(403,fn()=>$checklists->get($admin,$query));
week4Reject(401,fn()=>$checklists->get([],$query));
week4Reject(404,fn()=>$checklists->get(['id'=>'2','role'=>'CUSTOMER'],$query));
$all=array_fill_keys(array_keys(InstallationChecklistService::ITEMS),true);
$referencePhoto='/uploads/checklists/'.str_repeat('c',32).'.webp';
$body=$query+['checks'=>array_replace($all,['spaceMeasured'=>false]),'expectedVersion'=>0,'requestKey'=>week4Uuid(),'referencePhotoUrl'=>$referencePhoto];
week4Reject(422,fn()=>$checklists->save($owner,array_replace($body,['checks'=>array_replace($all,['spaceMeasured'=>'true'])])));
week4Reject(422,fn()=>$checklists->save($owner,$body+['customerId'=>2]));
$saved=$checklists->save($owner,$body);
week4Assert($saved===$checklists->save($owner,$body) && $saved['version']===1 && !$saved['completed'],'Partial save/replay changed result');
week4Assert(count($saved['history'])===1 && $saved['history'][0]['version']===1 && $saved['history'][0]['referencePhotoUrl']===$referencePhoto,'POST save must immediately include its latest history entry and attached reference photo.');
week4Reject(409,fn()=>$checklists->save($owner,array_replace($body,['checks'=>$all])));
week4Reject(409,fn()=>$checklists->save($owner,array_replace($body,['requestKey'=>week4Uuid()])));
$complete=$checklists->save($owner,array_replace($body,['checks'=>$all,'expectedVersion'=>1,'requestKey'=>week4Uuid()]));
week4Assert($complete['completed'] && $complete['firstCompletedAt']!==null,'All checks must record completion');
$unchecked=$checklists->save($owner,array_replace($body,['expectedVersion'=>2,'requestKey'=>week4Uuid()]));
$recompleted=$checklists->save($owner,array_replace($body,['checks'=>$all,'expectedVersion'=>3,'requestKey'=>week4Uuid()]));
week4Assert($unchecked['firstCompletedAt']===$complete['firstCompletedAt'] && $recompleted['firstCompletedAt']===$complete['firstCompletedAt'],'Re-completion must retain first completion time');
$history=$checklists->get($owner,$query)['history'];
week4Assert(count($history)===4 && $history[3]['checks']['spaceMeasured']===false,'History must preserve old revisions');
$foreign=$checklists->get(['id'=>'2','role'=>'CUSTOMER'],['productId'=>20]);
week4Assert($foreign['version']===0 && $foreign['history']===[],'Another owner must not see checklist progress/history');

$fitKey=week4Uuid(); $rooms->recordFitCheck($fitKey,1,'FIT'); $rooms->recordFitCheck($fitKey,1,'FIT');
week4Reject(409,fn()=>$rooms->recordFitCheck($fitKey,2,'FIT'));
week4Reject(409,fn()=>$rooms->recordFitCheck($fitKey,1,'NOT_FIT'));
$notFitKey=week4Uuid(); $rooms->recordFitCheck($notFitKey,1,'NOT_FIT');
$nextMonthKey=week4Uuid(); $rooms->recordFitCheck($nextMonthKey,1,'NEEDS_CHECK');
$tcoKey=week4Uuid(); $tco=new TcoModel($pdo); $tco->recordCalculation($tcoKey,1); $tco->recordCalculation($tcoKey,1);
week4Reject(409,fn()=>$rooms->recordFitCheck($tcoKey,1,'FIT'));
$move=$pdo->prepare('UPDATE decision_events SET created_at=? WHERE request_key=?');
foreach ([$fitKey,$notFitKey,$tcoKey] as $key) $move->execute(['2021-01-31 16:59:59',$key]);
$move->execute(['2021-01-31 17:00:00',$nextMonthKey]);
$pdo->prepare("UPDATE installation_checklists SET first_completed_at='2021-01-31 16:59:59' WHERE id=?")->execute([$complete['id']]);
$doneTask=week4Value("SELECT id FROM care_tasks WHERE status='COMPLETED' LIMIT 1");
$pdo->prepare("UPDATE care_tasks SET completed_at='2021-01-31 17:00:00' WHERE id=?")->execute([$doneTask]);
$pendingTask=week4Value("SELECT ct.id FROM care_tasks ct JOIN owned_devices od ON od.id=ct.owned_device_id WHERE ct.status='DUE' AND od.customer_id=1 AND od.status='ACTIVE' LIMIT 1");
$care=new CareService(new CareModel($pdo));
week4Reject(422,fn()=>$care->postponeCareTask($owner,(string)$pendingTask,['newDueDate'=>(new DateTimeImmutable('today',new DateTimeZone('Asia/Ho_Chi_Minh')))->modify('+1 day')->format('Y-m-d'),'reason'=>'Cannot postpone to an earlier due date']));
$pdo->prepare("UPDATE care_tasks SET status='POSTPONED', updated_at='2021-01-31 16:59:59' WHERE id=?")->execute([$pendingTask]);
$dashboard=$reports->dashboard($admin,$range);
week4Assert($dashboard['decisionTools']['fitChecks']===2 && $dashboard['decisionTools']['notFitRate']===0.5 && $dashboard['decisionTools']['tcoCalculations']===1,'Fit/TCO source counts or Vietnam-time cutoff wrong');
week4Assert($dashboard['decisionTools']['installationChecklistsCompleted']===1 && $dashboard['decisionTools']['carePostponed']===1 && $dashboard['decisionTools']['careCompleted']===0,'Checklist/care counts must have real sources');
week4Assert($dashboard['decisionTools']['careCompletionRate']===null && $dashboard['metricSources']['careCompletionRate']['status']==='UNAVAILABLE','Unapproved care rate must stay unavailable');
$february=$reports->dashboard($admin,['from'=>'2021-02-01','to'=>'2021-02-28']);
week4Assert($february['decisionTools']['fitChecks']===1 && $february['decisionTools']['careCompleted']===1,'Midnight Vietnam boundary must move the event to February');
$salesRange=['from'=>'2020-01-01','to'=>'2020-01-31'];
$csv=$reports->revenueCsv($admin,$salesRange); $net=null;
foreach (explode("\n",$csv) as $line) { $cells=str_getcsv($line,',','"',''); if (($cells[0]??'')==='NET_TOTAL') $net=(int)$cells[6]; }
week4Assert($net===$reports->dashboard($admin,$salesRange)['sales']['netRevenueVnd'],'CSV NET_TOTAL must match dashboard');

$botModel=new ChatbotModel($pdo);
$pdo->exec("UPDATE product_attributes SET unit=NULL WHERE category_id=1 AND attribute_key='power_watts'");
$missingUnit=(new TcoModel($pdo))->findActiveProductVariant(20,30);
week4Assert(($missingUnit['attribute_units']['power_watts']??null)==='__UNKNOWN__','Catalog missing unit must remain unknown to TCO');
$pdo->exec("UPDATE product_attributes SET unit='W' WHERE category_id=1 AND attribute_key='power_watts'");
$pdo->exec('UPDATE brands SET is_active=0 WHERE id=1');
week4Assert((new TcoModel($pdo))->findActiveProductVariant(20,30)===null && $rooms->activeProductCategory(20)===null,'Inactive brand must be excluded consistently');
$pdo->exec('UPDATE brands SET is_active=1 WHERE id=1');
$pdo->exec("UPDATE product_attributes SET unit='hp' WHERE category_id=50 AND attribute_key='power_watts'");
$candidates=$botModel->recommendCandidates('50',['power_watts']);
week4Assert(!isset($candidates[0]['specs']['power_watts']),'Unsupported unit must not turn into W');
$pdo->exec("UPDATE product_attributes SET unit='kW' WHERE category_id=50 AND attribute_key='power_watts'");
$candidates=$botModel->recommendCandidates('50',['power_watts']);
week4Assert((float)$candidates[0]['specs']['power_watts']>=1000,'kW must normalize to W');
$pdo->exec("UPDATE product_attributes SET unit='W' WHERE category_id=50 AND attribute_key='power_watts'");
$reply=(new ChatbotService($botModel))->reply(['message'=>'máy giặt dưới 10 triệu tiết kiệm điện']);
week4Assert(str_contains($reply['reply'],'chưa đủ để kết luận') && $reply['followUpQuestion']!=='','Rated power must not be advertised as proven energy efficiency');
echo "PASS: week4 checklist ownership/history/replay, sourced metrics, time boundaries, CSV parity and catalog units.\n";
