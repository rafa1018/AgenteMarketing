<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Backup\BackupService;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\Request;
use Gabush\Http\Response;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/**
 * Backups from the panel: list, create, download (to keep a copy outside the server) and restore.
 * Creating / downloading needs "ajustes"; restoring and deleting need "usuarios" (rectora / owner) and the
 * word RESTAURAR typed, since it replaces everything.
 */
final class BackupController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/backups', [$c, 'index']);
        $r->add('POST', '/backups', [$c, 'create']);
        $r->add('GET', '/backups/{name}/download', [$c, 'download']);
        $r->add('POST', '/backups/{name}/restore', [$c, 'restore']);
        $r->add('DELETE', '/backups/{name}', [$c, 'delete']);
    }

    private function svc(): BackupService
    {
        return BackupService::from($this->app);
    }

    public function index(Request $req): array
    {
        $this->staff($req, 'ajustes');
        $state = (array) $this->settings()->get('scheduler', []);
        return ['backups' => $this->svc()->list(), 'lastRun' => $state['lastRun'] ?? null, 'retention' => BackupService::KINDS];
    }

    public function create(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes');
        $note = Validate::of($req)->str('note', 120) ?? '';
        $b = $this->svc()->create('manual', $note);
        $this->audit()->log($actor, 'backup.create', 'backup', $b['name']);
        return ['backup' => $b, 'backups' => $this->svc()->list()];
    }

    public function download(Request $req): Response
    {
        $actor = $this->staff($req, 'ajustes');
        $name = $req->param('name');
        $path = $this->svc()->path($name);
        $this->audit()->log($actor, 'backup.download', 'backup', $name);
        return Response::file($path, 'application/zip', $name, 0, true);
    }

    /** {confirm:"RESTAURAR", files:true} */
    public function restore(Request $req): array
    {
        $actor = $this->staffWrite($req, 'usuarios');
        $v = Validate::of($req);
        $confirm = strtoupper(trim((string) $v->str('confirm', 20)));
        $files = $v->bool('files', true);
        $v->check();
        if ($confirm !== 'RESTAURAR') throw new DomainError('confirm', 'Escribe RESTAURAR para confirmar.');
        $name = $req->param('name');
        $r = $this->svc()->restore($name, $files);
        $this->audit()->log($actor, 'backup.restore', 'backup', $name, $r);
        return ['restored' => $name] + $r + ['backups' => $this->svc()->list()];
    }

    public function delete(Request $req): array
    {
        $actor = $this->staffWrite($req, 'usuarios');
        $name = $req->param('name');
        $this->svc()->delete($name);
        $this->audit()->log($actor, 'backup.delete', 'backup', $name);
        return ['backups' => $this->svc()->list()];
    }
}
