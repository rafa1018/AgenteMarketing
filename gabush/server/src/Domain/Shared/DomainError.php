<?php
declare(strict_types=1);

namespace Gabush\Domain\Shared;

/** A business rule was broken (shown to the user as is). $rule is a stable key for the frontend. */
class DomainError extends \DomainException
{
    public function __construct(public readonly string $rule, string $message)
    {
        parent::__construct($message);
    }
}
