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
$pct = new ReportCard([
    ['id' => 2, 'name' => 'Insuficiente', 'min' => 1.0, 'max' => 59.0],
    ['id' => 3, 'name' => 'Aceptable', 'min' => 60.0, 'max' => 79.0],
    ['id' => 4, 'name' => 'Bueno', 'min' => 80.0, 'max' => 89.0],
    ['id' => 5, 'name' => 'Excelente', 'min' => 90.0, 'max' => 100.0],
]);
same(3, $pct->levelOfScore(70), 'escala 0-100: 70 = Aceptable');
same(2, $pct->levelOfScore(59.5), 'escala 0-100: 59,5 (entre rangos) sigue siendo Insuficiente');
same(4, $pct->levelOfScore(89.5), 'escala 0-100: 89,5 = Bueno');
same(5, $pct->levelOfScore(100), 'escala 0-100: 100 = Excelente');
same(null, $pct->levelOfScore(101), 'escala 0-100: más de 100 no es válido');
same(5, $rc->finalLevel([['level' => 5, 'weight' => 25], ['level' => 5, 'weight' => 25], ['level' => 4, 'weight' => 25], ['level' => 5, 'weight' => 25]]), 'final: mayoría Excelente');
same(4, $rc->finalLevel([['level' => 4, 'weight' => 25], ['level' => 4, 'weight' => 25], ['level' => 5, 'weight' => 25], ['level' => null, 'weight' => 25]]), 'final ponderado ignora periodos sin nota');
same('Bueno', $rc->name(4), 'nombre del nivel');
