<?php
declare(strict_types=1);

use Gabush\Domain\Academics\ReportCard;

$rc = new ReportCard([
    ['id' => 2, 'name' => 'Insuficiente', 'min' => 0.1, 'max' => 5.9],
    ['id' => 3, 'name' => 'Aceptable', 'min' => 6.0, 'max' => 7.9],
    ['id' => 4, 'name' => 'Bueno', 'min' => 8.0, 'max' => 8.9],
    ['id' => 5, 'name' => 'Excelente', 'min' => 9.0, 'max' => 10.0],
]);
same(5, $rc->levelOfAchievements([5, 5, 4]), 'nivel del periodo = el más frecuente de los logros marcados');
same(5, $rc->levelOfAchievements([4, 5]), 'empate → el nivel más alto');
same(null, $rc->levelOfAchievements([]), 'sin logros no hay nivel');
same(4, $rc->levelOfScore(8.5), 'nota numérica 8.5 = Bueno');
same(null, $rc->levelOfScore(null), 'sin nota');
same(5, $rc->finalLevel([['level' => 5, 'weight' => 25], ['level' => 5, 'weight' => 25], ['level' => 4, 'weight' => 25], ['level' => 5, 'weight' => 25]]), 'final: mayoría Excelente');
same(4, $rc->finalLevel([['level' => 4, 'weight' => 25], ['level' => 4, 'weight' => 25], ['level' => 5, 'weight' => 25], ['level' => null, 'weight' => 25]]), 'final ponderado ignora periodos sin nota');
same('Bueno', $rc->name(4), 'nombre del nivel');
