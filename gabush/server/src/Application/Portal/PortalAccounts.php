<?php
declare(strict_types=1);

namespace Gabush\Application\Portal;

use Gabush\App;
use Gabush\Application\Email\EmailService;
use Gabush\Domain\Shared\DomainError;
use Gabush\Infrastructure\Database\Database;

/**
 * One portal account per student. Families sign in with the student code or the student's document number;
 * the first password is the document (or an easy-to-dictate temporary one) and must be changed on first login.
 */
final class PortalAccounts
{
    private const WORDS = ['leon', 'sol', 'luna', 'nube', 'flor', 'arte', 'color', 'pincel', 'tigre', 'oso', 'buho', 'conejo', 'arcoiris', 'estrella', 'mar', 'rio'];
    private const MAX_FAILS = 5;
    private const LOCK_MINUTES = 15;

    public function __construct(private readonly Database $db, private readonly EmailService $email, private readonly string $baseUrl)
    {
    }

    public static function from(App $app): self
    {
        return $app->service(self::class, static fn(App $a) => new self($a->db(), EmailService::from($a), $a->baseUrl()));
    }

    public static function temporaryPassword(): string
    {
        return self::WORDS[random_int(0, count(self::WORDS) - 1)] . '-' . random_int(1000, 9999);
    }

    /** Document number as typed by a family: digits/letters only ("1.065.234-5" → "10652345"). */
    public static function normalizeDoc(?string $doc): string
    {
        return strtoupper((string) preg_replace('/[^0-9A-Za-z]/', '', (string) $doc));
    }

    /**
     * Creates (or resets) the account of a student; returns the temporary password. With $useDocument the
     * family signs in with the student's document number as user AND first password (they must change it on
     * the first login); without a document on file it falls back to a random temporary password.
     */
    public function issue(int $studentId, bool $sendEmail, bool $useDocument = false): array
    {
        $s = $this->db->one('SELECT code, first_name, last_name, doc_number FROM students WHERE id = ?', [$studentId]) ?? throw new DomainError('not_found', 'Estudiante no encontrado.');
        $doc = self::normalizeDoc($s['doc_number']);
        $byDoc = $useDocument && strlen($doc) >= 5;
        $password = $byDoc ? $doc : self::temporaryPassword();
        $login = $byDoc ? $doc : $s['code'];
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $this->db->run(
            'INSERT INTO portal_accounts (student_id, username, password_hash, must_change_password, active, failed_logins, locked_until)
             VALUES (?, ?, ?, 1, 1, 0, NULL)
             ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), must_change_password = 1, active = 1, failed_logins = 0, locked_until = NULL',
            [$studentId, $s['code'], $hash],
        );
        $emailed = false;
        if ($sendEmail) {
            foreach ($this->db->all('SELECT full_name, email FROM guardians WHERE family_id = (SELECT family_id FROM students WHERE id = ?) AND email IS NOT NULL ORDER BY is_billing DESC, is_primary DESC', [$studentId]) as $g) {
                $emailed = $this->email->queue('portal_welcome', $g['email'], $g['full_name'], ['acudiente' => $g['full_name'], 'estudiante' => trim($s['first_name'] . ' ' . $s['last_name']), 'usuario' => $login, 'clave' => $password, 'enlace' => $this->baseUrl . '/familia/', 'boton_texto' => 'Entrar al portal']) || $emailed;
            }
        }
        return ['studentId' => $studentId, 'username' => $login, 'password' => $password, 'student' => trim($s['first_name'] . ' ' . $s['last_name']), 'emailed' => $emailed, 'byDocument' => $byDoc];
    }

    /**
     * Accounts a family may mean with what they typed: the student code (GAB-0170) or the student's document
     * number (with or without dots). @return list<array<string,mixed>>
     */
    private function accountsFor(string $username): array
    {
        $code = strtoupper(trim($username));
        $doc = self::normalizeDoc($username);
        if (strlen($doc) < 5) {
            return $this->db->all('SELECT pa.* FROM portal_accounts pa WHERE pa.username = ? LIMIT 5', [$code]);
        }
        return $this->db->all(
            "SELECT pa.* FROM portal_accounts pa JOIN students s ON s.id = pa.student_id
             WHERE pa.username = ? OR UPPER(REGEXP_REPLACE(COALESCE(s.doc_number, ''), '[^0-9A-Za-z]', '')) = ?
             LIMIT 5",
            [$code, $doc],
        );
    }

    /** @return array{id:int,student_id:int,username:string,must_change:bool} */
    public function authenticate(string $username, string $password): array
    {
        // two siblings never share a document, but if the data had a duplicate the password decides
        $candidates = $this->accountsFor($username);
        $a = $candidates[0] ?? null;
        foreach ($candidates as $c) if (password_verify($password, $c['password_hash'])) { $a = $c; break; }
        $hash = $a['password_hash'] ?? password_hash('gabush-dummy', PASSWORD_DEFAULT); // same time for unknown users
        $ok = password_verify($password, $hash);
        if (!$a || !$a['active']) throw new DomainError('credentials', 'Usuario o contraseña incorrectos.');
        if ($a['locked_until'] && $a['locked_until'] > date('Y-m-d H:i:s')) {
            throw new DomainError('locked', 'Demasiados intentos. Espera ' . self::LOCK_MINUTES . ' minutos o pide al jardín que restablezca tu contraseña.');
        }
        if (!$ok) {
            $fails = (int) $a['failed_logins'] + 1;
            $this->db->update('portal_accounts', ['failed_logins' => $fails, 'locked_until' => $fails >= self::MAX_FAILS ? date('Y-m-d H:i:s', time() + self::LOCK_MINUTES * 60) : null], ['id' => $a['id']]);
            throw new DomainError('credentials', 'Usuario o contraseña incorrectos.');
        }
        if (password_needs_rehash($a['password_hash'], PASSWORD_DEFAULT)) $this->db->update('portal_accounts', ['password_hash' => password_hash($password, PASSWORD_DEFAULT)], ['id' => $a['id']]);
        $this->db->update('portal_accounts', ['failed_logins' => 0, 'locked_until' => null, 'last_login_at' => date('Y-m-d H:i:s')], ['id' => $a['id']]);
        return ['id' => (int) $a['id'], 'student_id' => (int) $a['student_id'], 'username' => $a['username'], 'must_change' => (bool) $a['must_change_password']];
    }

    public static function assertStrong(string $password): void
    {
        if (mb_strlen($password) < 8 || !preg_match('/\d/', $password) || !preg_match('/\p{L}/u', $password)) {
            throw new DomainError('weak', 'La contraseña debe tener al menos 8 caracteres, con letras y números.');
        }
    }

    public function changePassword(int $studentId, string $current, string $new): void
    {
        $a = $this->db->one('SELECT id, password_hash FROM portal_accounts WHERE student_id = ?', [$studentId]) ?? throw new DomainError('not_found', 'Cuenta no encontrada.');
        if (!password_verify($current, $a['password_hash'])) throw new DomainError('current', 'La contraseña actual no es correcta.');
        self::assertStrong($new);
        $this->db->update('portal_accounts', ['password_hash' => password_hash($new, PASSWORD_DEFAULT), 'must_change_password' => 0], ['id' => $a['id']]);
    }

    /** Sends a reset link to the family's e-mails. Always answers the same (does not reveal accounts). */
    public function requestReset(string $username): void
    {
        $found = array_values(array_filter($this->accountsFor($username), static fn($x) => (bool) $x['active']));
        if (count($found) !== 1) return;
        $a = $this->db->one('SELECT pa.id, pa.student_id, s.first_name, s.last_name FROM portal_accounts pa JOIN students s ON s.id = pa.student_id WHERE pa.id = ?', [$found[0]['id']]);
        if (!$a) return;
        $token = bin2hex(random_bytes(24));
        $this->db->insert('portal_password_resets', ['account_id' => $a['id'], 'token_hash' => hash('sha256', $token), 'expires_at' => date('Y-m-d H:i:s', time() + 3600)]);
        foreach ($this->db->all('SELECT full_name, email FROM guardians WHERE family_id = (SELECT family_id FROM students WHERE id = ?) AND email IS NOT NULL', [$a['student_id']]) as $g) {
            $this->email->queue('password_reset', $g['email'], $g['full_name'], ['estudiante' => trim($a['first_name'] . ' ' . $a['last_name']), 'enlace' => $this->baseUrl . '/familia/#/restablecer/' . $token, 'boton_texto' => 'Cambiar contraseña']);
        }
    }

    public function reset(string $token, string $password): void
    {
        self::assertStrong($password);
        $r = $this->db->one('SELECT id, account_id FROM portal_password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()', [hash('sha256', $token)]) ?? throw new DomainError('token', 'El enlace ya no es válido. Pide uno nuevo.');
        $this->db->transaction(function ($db) use ($r, $password): void {
            $db->update('portal_accounts', ['password_hash' => password_hash($password, PASSWORD_DEFAULT), 'must_change_password' => 0, 'failed_logins' => 0, 'locked_until' => null], ['id' => $r['account_id']]);
            $db->update('portal_password_resets', ['used_at' => date('Y-m-d H:i:s')], ['id' => $r['id']]);
        });
    }
}
