<?php
declare(strict_types=1);

namespace Gabush\Http;

use Gabush\App;
use Gabush\Domain\Shared\DomainError;

/** Builds the route table from the module controllers and turns every outcome into a JSON response. */
final class Kernel
{
    /** Controllers that register routes (one per module). */
    private const MODULES = [
        Controllers\SetupController::class,
        Controllers\AcademicYearController::class,
        Controllers\CourseController::class,
        Controllers\StudentController::class,
        Controllers\EnrollmentController::class,
        Controllers\AcademicController::class,
        Controllers\GradesController::class,
        Controllers\AttendanceController::class,
        Controllers\ObservationController::class,
        Controllers\BillingController::class,
        Controllers\CashController::class,
        Controllers\MessageController::class,
        Controllers\EmailController::class,
        Controllers\PaymentGatewayController::class,
        Controllers\PortalController::class,
        Controllers\WebhookController::class,
        Controllers\ReportsController::class,
        Controllers\BackupController::class,
        Controllers\StaffController::class,
        Controllers\AuditController::class,
    ];

    public function __construct(private readonly App $app)
    {
    }

    public function handle(Request $req): Response
    {
        try {
            $router = new Router();
            foreach (self::MODULES as $module) {
                if (class_exists($module)) $module::routes($router, $this->app);
            }
            [$handler, , $params] = $router->match($req->method, $req->path);
            $req->params = $params;
            $result = $handler($req);
            if ($result instanceof Response) return $result;
            return Response::json(['ok' => true] + (array) $result);
        } catch (HttpError $e) {
            return Response::json(array_filter(['ok' => false, 'error' => $e->error, 'message' => $e->getMessage() !== $e->error ? $e->getMessage() : null, 'fields' => $e->fields ?: null], static fn($v) => $v !== null), $e->status);
        } catch (DomainError $e) {
            return Response::json(['ok' => false, 'error' => $e->rule, 'message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            error_log('[gabush v2] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            $debug = PHP_SAPI === 'cli-server';
            return Response::json(['ok' => false, 'error' => 'server'] + ($debug ? ['message' => $e->getMessage(), 'at' => basename($e->getFile()) . ':' . $e->getLine()] : []), 500);
        } finally {
            // last connection of whoever made the request (family portal or panel)
            if (\Gabush\Application\Shared\AccessAudit::$who) {
                try {
                    (new \Gabush\Application\Shared\AccessAudit($this->app->db()))->touch();
                } catch (\Throwable) {
                }
            }
        }
    }
}
