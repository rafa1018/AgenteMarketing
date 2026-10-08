-- Gabush · fase 2 — esquema base (MySQL 8 / MariaDB 10.4+, utf8mb4, InnoDB).
-- Convenciones: tablas en inglés y plural; ids BIGINT autoincrementales; dinero en pesos enteros (BIGINT);
-- fechas DATE, momentos DATETIME (hora de Colombia); `legacy_ref` guarda el identificador de Cerkademia
-- para que la importación se pueda repetir sin duplicar.

-- ───────────────────────── Configuración y auditoría ─────────────────────────
CREATE TABLE settings (
  `key`        VARCHAR(64)  NOT NULL PRIMARY KEY,
  value        JSON         NOT NULL,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_type   VARCHAR(16)  NOT NULL,             -- staff | family | system | gateway
  actor_id     VARCHAR(64)  NULL,
  action       VARCHAR(64)  NOT NULL,             -- p. ej. payment.approved, charge.waive_late_fee
  entity       VARCHAR(48)  NOT NULL,
  entity_id    VARCHAR(64)  NULL,
  data         JSON         NULL,
  ip           VARCHAR(45)  NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Personal del jardín (docentes, auxiliares, rectora). La autenticación del panel sigue en el módulo de
-- usuarios; `user_id` enlaza con él.
CREATE TABLE staff (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(64)  NULL UNIQUE,
  full_name    VARCHAR(120) NOT NULL,
  phone        VARCHAR(40)  NULL,
  email        VARCHAR(120) NULL,
  position     VARCHAR(60)  NULL,                 -- Rectora, Docente, Auxiliar…
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Año académico ─────────────────────────
CREATE TABLE academic_years (
  id           SMALLINT UNSIGNED NOT NULL PRIMARY KEY,          -- el año: 2026
  name         VARCHAR(40)  NOT NULL,
  starts_on    DATE         NULL,
  ends_on      DATE         NULL,
  status       ENUM('planned','active','closed') NOT NULL DEFAULT 'planned',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE periods (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  year_id      SMALLINT UNSIGNED NOT NULL,
  number       TINYINT UNSIGNED NOT NULL,                       -- 1°, 2°, 3°, 4°
  name         VARCHAR(40)  NOT NULL,
  starts_on    DATE         NULL,
  ends_on      DATE         NULL,
  weight       DECIMAL(5,2) NOT NULL DEFAULT 25.00,             -- % en la nota final
  grading_open TINYINT(1)   NOT NULL DEFAULT 0,                 -- docentes pueden calificar
  published    TINYINT(1)   NOT NULL DEFAULT 0,                 -- las familias ven el boletín
  UNIQUE KEY uq_period (year_id, number),
  CONSTRAINT fk_period_year FOREIGN KEY (year_id) REFERENCES academic_years(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Grados, salones y cursos ─────────────────────────
CREATE TABLE grade_levels (                                     -- Maternal, Párvulos, PreJardín, Jardín, Transición
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(40)  NOT NULL UNIQUE,
  sort         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  min_age_months SMALLINT UNSIGNED NULL,
  max_age_months SMALLINT UNSIGNED NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classrooms (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(60)  NOT NULL UNIQUE,
  capacity     SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  location     VARCHAR(80)  NULL,                               -- casa 1, casa 2…
  active       TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE courses (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  year_id      SMALLINT UNSIGNED NOT NULL,
  grade_level_id SMALLINT UNSIGNED NOT NULL,
  name         VARCHAR(60)  NOT NULL,                           -- Párvulos A
  alias        VARCHAR(40)  NULL,
  classroom_id SMALLINT UNSIGNED NULL,
  capacity     SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  director_staff_id BIGINT UNSIGNED NULL,
  shift        ENUM('manana','tarde','completa') NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_course (year_id, name),
  CONSTRAINT fk_course_year FOREIGN KEY (year_id) REFERENCES academic_years(id),
  CONSTRAINT fk_course_grade FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id),
  CONSTRAINT fk_course_room FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
  CONSTRAINT fk_course_director FOREIGN KEY (director_staff_id) REFERENCES staff(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Familias y estudiantes ─────────────────────────
CREATE TABLE families (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(160) NOT NULL,                           -- etiqueta legible: "Aragón (Madre), Alicia"
  notes        TEXT         NULL,
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guardians (                                        -- acudientes / miembros adultos del grupo familiar
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  family_id    BIGINT UNSIGNED NOT NULL,
  full_name    VARCHAR(160) NOT NULL,
  relationship VARCHAR(40)  NOT NULL DEFAULT 'Acudiente',       -- Madre, Padre, Abuela, Acudiente…
  doc_type     VARCHAR(8)   NULL,                               -- CC, CE, PP, PEP…
  doc_number   VARCHAR(32)  NULL,
  phone        VARCHAR(40)  NULL,
  phone2       VARCHAR(40)  NULL,
  email        VARCHAR(160) NULL,
  address      VARCHAR(200) NULL,
  occupation   VARCHAR(100) NULL,
  is_primary   TINYINT(1)   NOT NULL DEFAULT 0,                 -- contacto principal
  is_billing   TINYINT(1)   NOT NULL DEFAULT 0,                 -- responsable de pagos
  legacy_ref   VARCHAR(64)  NULL,
  KEY idx_guardian_family (family_id),
  KEY idx_guardian_doc (doc_number),
  CONSTRAINT fk_guardian_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(20)  NOT NULL UNIQUE,                    -- GAB-0183
  first_name   VARCHAR(60)  NOT NULL,
  middle_name  VARCHAR(60)  NULL,
  last_name    VARCHAR(60)  NOT NULL,
  second_last_name VARCHAR(60) NULL,
  birth_date   DATE         NULL,
  birth_city   VARCHAR(80)  NULL,
  gender       ENUM('M','F') NULL,
  doc_type     VARCHAR(40)  NULL,                               -- Registro Civil, Tarjeta de Identidad…
  doc_number   VARCHAR(32)  NULL,
  eps          VARCHAR(80)  NULL,
  blood_type   VARCHAR(8)   NULL,
  religion     VARCHAR(40)  NULL,
  email        VARCHAR(160) NULL,
  photo_path   VARCHAR(200) NULL,                               -- archivo privado en la carpeta de datos
  allergies    TEXT         NULL,
  authorized_pickup TEXT    NULL,                               -- quién puede recogerlo
  notes        TEXT         NULL,
  family_id    BIGINT UNSIGNED NULL,
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_student_name (last_name, first_name),
  KEY idx_student_doc (doc_number),
  CONSTRAINT fk_student_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Inscripción y matrícula ─────────────────────────
CREATE TABLE inscriptions (                                     -- formulario web o registrado por la rectora
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  year_id      SMALLINT UNSIGNED NULL,
  grade_level_id SMALLINT UNSIGNED NULL,
  child_name   VARCHAR(160) NOT NULL,
  child_birth_date DATE     NULL,
  guardian_name VARCHAR(160) NULL,
  guardian_phone VARCHAR(40) NULL,
  guardian_email VARCHAR(160) NULL,
  origin       ENUM('web','jardin') NOT NULL DEFAULT 'web',
  status       ENUM('nueva','contactada','visita','prematriculada','descartada') NOT NULL DEFAULT 'nueva',
  data         JSON         NULL,                               -- respuestas completas del formulario
  student_id   BIGINT UNSIGNED NULL,                            -- al convertirse en estudiante
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_insc_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE enrollments (                                      -- un estudiante en un año académico
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id   BIGINT UNSIGNED NOT NULL,
  year_id      SMALLINT UNSIGNED NOT NULL,
  course_id    BIGINT UNSIGNED NULL,
  status       ENUM('prematricula','activo','retirado') NOT NULL DEFAULT 'prematricula',
  order_number SMALLINT UNSIGNED NULL,                          -- No. de orden de matrícula
  contract_signed TINYINT(1) NOT NULL DEFAULT 0,
  enrolled_on  DATE         NULL,
  withdrawn_on DATE         NULL,
  withdraw_reason VARCHAR(200) NULL,
  is_new       TINYINT(1)   NOT NULL DEFAULT 0,                 -- primer año en el jardín
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enrollment (student_id, year_id),
  KEY idx_enrollment_course (course_id),
  CONSTRAINT fk_enr_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_enr_year FOREIGN KEY (year_id) REFERENCES academic_years(id),
  CONSTRAINT fk_enr_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_types (                                   -- lista configurable de documentos a pedir
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL UNIQUE,                    -- Registro civil, Carné de vacunas, EPS…
  description  VARCHAR(300) NULL,
  required     TINYINT(1)   NOT NULL DEFAULT 1,
  applies_to   ENUM('nuevos','todos') NOT NULL DEFAULT 'nuevos',
  family_can_upload TINYINT(1) NOT NULL DEFAULT 1,
  sort         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  active       TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE enrollment_documents (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  document_type_id SMALLINT UNSIGNED NOT NULL,
  status       ENUM('pendiente','recibido','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
  file_path    VARCHAR(200) NULL,
  file_name    VARCHAR(160) NULL,
  mime         VARCHAR(60)  NULL,
  uploaded_by  VARCHAR(16)  NULL,                               -- staff | family
  uploaded_by_id VARCHAR(64) NULL,
  uploaded_at  DATETIME     NULL,
  reviewed_by  BIGINT UNSIGNED NULL,
  reviewed_at  DATETIME     NULL,
  note         VARCHAR(300) NULL,
  UNIQUE KEY uq_enr_doc (enrollment_id, document_type_id),
  CONSTRAINT fk_ed_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  CONSTRAINT fk_ed_type FOREIGN KEY (document_type_id) REFERENCES document_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Académico ─────────────────────────
CREATE TABLE areas (                                            -- dimensiones del desarrollo
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(80)  NOT NULL UNIQUE,
  report_position TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subjects (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(80)  NOT NULL UNIQUE,
  area_id      SMALLINT UNSIGNED NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT fk_subject_area FOREIGN KEY (area_id) REFERENCES areas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE course_subjects (                                  -- asignación académica
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  course_id    BIGINT UNSIGNED NOT NULL,
  subject_id   SMALLINT UNSIGNED NOT NULL,
  teacher_staff_id BIGINT UNSIGNED NULL,
  weekly_hours TINYINT UNSIGNED NULL,
  UNIQUE KEY uq_course_subject (course_id, subject_id),
  CONSTRAINT fk_cs_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT fk_cs_teacher FOREIGN KEY (teacher_staff_id) REFERENCES staff(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE performance_levels (                               -- Insuficiente, Aceptable, Bueno, Excelente
  id           TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(40)  NOT NULL UNIQUE,
  min_score    DECIMAL(4,1) NOT NULL,
  max_score    DECIMAL(4,1) NOT NULL,
  sort         TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE achievements (                                     -- banco de logros
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  grade_level_id SMALLINT UNSIGNED NOT NULL,
  subject_id   SMALLINT UNSIGNED NOT NULL,
  period_number TINYINT UNSIGNED NULL,                          -- NULL = cualquier periodo
  performance_level_id TINYINT UNSIGNED NULL,
  description  TEXT         NOT NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_by   VARCHAR(120) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  KEY idx_ach_lookup (grade_level_id, subject_id, period_number),
  CONSTRAINT fk_ach_grade FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id),
  CONSTRAINT fk_ach_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT fk_ach_level FOREIGN KEY (performance_level_id) REFERENCES performance_levels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grade_entries (                                    -- nota de un estudiante en una materia y periodo
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  subject_id   SMALLINT UNSIGNED NOT NULL,
  period_id    BIGINT UNSIGNED NOT NULL,
  score        DECIMAL(4,1) NULL,
  performance_level_id TINYINT UNSIGNED NULL,
  absences     SMALLINT UNSIGNED NULL,                          -- fallas en el periodo
  comments     TEXT         NULL,
  updated_by   VARCHAR(120) NULL,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grade_entry (enrollment_id, subject_id, period_id),
  CONSTRAINT fk_ge_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  CONSTRAINT fk_ge_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT fk_ge_period FOREIGN KEY (period_id) REFERENCES periods(id),
  CONSTRAINT fk_ge_level FOREIGN KEY (performance_level_id) REFERENCES performance_levels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grade_entry_achievements (                        -- logros marcados al estudiante (con su nivel)
  grade_entry_id BIGINT UNSIGNED NOT NULL,
  achievement_id BIGINT UNSIGNED NOT NULL,
  performance_level_id TINYINT UNSIGNED NULL,
  PRIMARY KEY (grade_entry_id, achievement_id),
  CONSTRAINT fk_gea_entry FOREIGN KEY (grade_entry_id) REFERENCES grade_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_gea_ach FOREIGN KEY (achievement_id) REFERENCES achievements(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE observations (                                     -- observador del estudiante
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id   BIGINT UNSIGNED NOT NULL,
  year_id      SMALLINT UNSIGNED NULL,
  observed_on  DATE         NOT NULL,
  category     VARCHAR(40)  NOT NULL DEFAULT 'general',         -- general, salud, convivencia, logro…
  body         TEXT         NOT NULL,
  visible_to_family TINYINT(1) NOT NULL DEFAULT 0,
  created_by   VARCHAR(120) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  KEY idx_obs_student (student_id, observed_on),
  CONSTRAINT fk_obs_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id   BIGINT UNSIGNED NOT NULL,
  day          DATE         NOT NULL,
  status       ENUM('presente','ausente','justificada','tarde') NOT NULL,
  note         VARCHAR(200) NULL,
  recorded_by  VARCHAR(120) NULL,
  recorded_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance (student_id, day),
  KEY idx_attendance_day (day),
  CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Cartera ─────────────────────────
CREATE TABLE billing_concepts (                                 -- productos y servicios
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(24)  NOT NULL UNIQUE,                    -- PENSION, MATRICULA, CLAUSURA…
  name         VARCHAR(80)  NOT NULL,
  frequency    ENUM('mensual','anual','eventual') NOT NULL,
  apply_on_enrollment TINYINT(1) NOT NULL DEFAULT 0,
  late_fee_applies TINYINT(1) NOT NULL DEFAULT 0,               -- genera mora si se paga tarde
  online_payable TINYINT(1) NOT NULL DEFAULT 1,
  active       TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE prices (                                           -- precio por año y grado (NULL = todos)
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  year_id      SMALLINT UNSIGNED NOT NULL,
  concept_id   SMALLINT UNSIGNED NOT NULL,
  grade_level_id SMALLINT UNSIGNED NULL,
  amount       BIGINT       NOT NULL,
  months       VARCHAR(40)  NULL,                               -- p. ej. "2,3,4,5,6,7,8,9,10,11" para pensión
  UNIQUE KEY uq_price (year_id, concept_id, grade_level_id),
  CONSTRAINT fk_price_year FOREIGN KEY (year_id) REFERENCES academic_years(id),
  CONSTRAINT fk_price_concept FOREIGN KEY (concept_id) REFERENCES billing_concepts(id),
  CONSTRAINT fk_price_grade FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_prices (                                   -- precio especial de un estudiante en un año
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  concept_id   SMALLINT UNSIGNED NOT NULL,
  amount       BIGINT       NOT NULL,
  reason       VARCHAR(200) NULL,
  UNIQUE KEY uq_student_price (enrollment_id, concept_id),
  CONSTRAINT fk_sp_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_concept FOREIGN KEY (concept_id) REFERENCES billing_concepts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE charges (                                          -- lo que se le cobra a un estudiante
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id   BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NULL,
  year_id      SMALLINT UNSIGNED NULL,
  concept_id   SMALLINT UNSIGNED NULL,
  description  VARCHAR(160) NOT NULL,                           -- "Pensión Párvulos Octubre/2026"
  period_month DATE         NULL,                               -- 2026-10-01 para pensiones
  amount       BIGINT       NOT NULL,
  due_on       DATE         NULL,
  status       ENUM('abierto','pagado','anulado') NOT NULL DEFAULT 'abierto',
  source       ENUM('automatico','manual','importado') NOT NULL DEFAULT 'manual',
  created_by   VARCHAR(120) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  UNIQUE KEY uq_monthly (student_id, concept_id, period_month), -- una pensión por mes
  KEY idx_charge_status (status, due_on),
  CONSTRAINT fk_charge_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_charge_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
  CONSTRAINT fk_charge_concept FOREIGN KEY (concept_id) REFERENCES billing_concepts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE charge_adjustments (                               -- descuentos, recargos y mora sobre un cobro
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  charge_id    BIGINT UNSIGNED NOT NULL,
  kind         ENUM('descuento','recargo','mora','traslado') NOT NULL, -- traslado: deuda pasada al año siguiente
  amount       BIGINT       NOT NULL,                           -- siempre positivo; el tipo da el signo
  reason       VARCHAR(200) NULL,
  days_late    SMALLINT UNSIGNED NULL,                          -- mora: días contados
  waived       TINYINT(1)   NOT NULL DEFAULT 0,                 -- mora perdonada por la rectora
  waived_by    VARCHAR(120) NULL,
  created_by   VARCHAR(120) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  KEY idx_adj_charge (charge_id, kind),
  CONSTRAINT fk_adj_charge FOREIGN KEY (charge_id) REFERENCES charges(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id   BIGINT UNSIGNED NOT NULL,
  receipt_number VARCHAR(20) NULL UNIQUE,                       -- consecutivo del comprobante (al aprobarse)
  paid_on      DATE         NOT NULL,
  amount       BIGINT       NOT NULL,
  method       VARCHAR(30)  NOT NULL,                           -- efectivo, nequi, bancolombia, wompi…
  reference    VARCHAR(120) NULL,                               -- "Comprobante Nequi No. 2451"
  notes        VARCHAR(300) NULL,
  status       ENUM('pendiente','aprobado','rechazado','anulado') NOT NULL DEFAULT 'aprobado',
  source       ENUM('manual','en_linea','importado') NOT NULL DEFAULT 'manual',
  checkout_id  BIGINT UNSIGNED NULL,
  created_by   VARCHAR(120) NULL,                               -- "Ingresado por"
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at  DATETIME     NULL,
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  KEY idx_payment_student (student_id, paid_on),
  CONSTRAINT fk_payment_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_allocations (                              -- "cargos afectados" de un pago
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_id   BIGINT UNSIGNED NOT NULL,
  charge_id    BIGINT UNSIGNED NOT NULL,
  amount       BIGINT       NOT NULL,
  KEY idx_alloc_charge (charge_id),
  CONSTRAINT fk_alloc_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_charge FOREIGN KEY (charge_id) REFERENCES charges(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checkouts (                                        -- intentos de pago en línea (Wompi / Mercado Pago)
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference    VARCHAR(64)  NOT NULL UNIQUE,                    -- referencia enviada a la pasarela
  provider     VARCHAR(20)  NOT NULL,                           -- wompi | mercadopago
  student_id   BIGINT UNSIGNED NOT NULL,
  amount       BIGINT       NOT NULL,
  charge_ids   JSON         NOT NULL,                           -- cobros que se pagan (con su valor al iniciar)
  status       ENUM('creado','pendiente','aprobado','rechazado','expirado','error') NOT NULL DEFAULT 'creado',
  provider_tx_id VARCHAR(80) NULL,
  provider_status VARCHAR(40) NULL,
  checkout_url VARCHAR(500) NULL,
  last_event   JSON         NULL,
  payment_id   BIGINT UNSIGNED NULL,                            -- pago creado al aprobarse (idempotente)
  created_by   VARCHAR(64)  NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_checkout_student (student_id, created_at),
  CONSTRAINT fk_checkout_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_checkout_payment FOREIGN KEY (payment_id) REFERENCES payments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE payments ADD CONSTRAINT fk_payment_checkout FOREIGN KEY (checkout_id) REFERENCES checkouts(id);

-- ───────────────────────── Caja (ingresos y egresos) ─────────────────────────
CREATE TABLE cash_boxes (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(60)  NOT NULL UNIQUE,
  active       TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cash_concepts (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind         ENUM('ingreso','egreso') NOT NULL,
  name         VARCHAR(80)  NOT NULL,
  description  VARCHAR(300) NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_cash_concept (kind, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cash_movements (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  box_id       SMALLINT UNSIGNED NOT NULL,
  kind         ENUM('ingreso','egreso') NOT NULL,
  concept_id   SMALLINT UNSIGNED NULL,
  amount       BIGINT       NOT NULL,
  occurred_on  DATE         NOT NULL,                           -- fecha de la operación
  description  VARCHAR(300) NULL,
  payment_id   BIGINT UNSIGNED NULL,                            -- ingreso generado por un pago
  created_by   VARCHAR(120) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP, -- fecha de registro
  legacy_ref   VARCHAR(64)  NULL UNIQUE,
  KEY idx_cash_day (occurred_on),
  CONSTRAINT fk_cash_box FOREIGN KEY (box_id) REFERENCES cash_boxes(id),
  CONSTRAINT fk_cash_concept FOREIGN KEY (concept_id) REFERENCES cash_concepts(id),
  CONSTRAINT fk_cash_payment FOREIGN KEY (payment_id) REFERENCES payments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Comunicación ─────────────────────────
CREATE TABLE messages (                                         -- bandeja de entrada de las familias
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subject      VARCHAR(160) NOT NULL,
  body         TEXT         NOT NULL,
  kind         ENUM('mensaje','actividad','circular','recordatorio') NOT NULL DEFAULT 'mensaje',
  audience     ENUM('todos','curso','estudiante') NOT NULL,
  audience_id  BIGINT UNSIGNED NULL,                            -- course_id o student_id
  due_on       DATE         NULL,                               -- para actividades
  send_email   TINYINT(1)   NOT NULL DEFAULT 0,
  created_by   VARCHAR(120) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE message_recipients (
  message_id   BIGINT UNSIGNED NOT NULL,
  student_id   BIGINT UNSIGNED NOT NULL,
  read_at      DATETIME     NULL,
  PRIMARY KEY (message_id, student_id),
  KEY idx_inbox (student_id, read_at),
  CONSTRAINT fk_mr_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_templates (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `key`        VARCHAR(48)  NOT NULL UNIQUE,                    -- payment_receipt, new_message, …
  name         VARCHAR(80)  NOT NULL,
  subject      VARCHAR(200) NOT NULL,
  body_html    MEDIUMTEXT   NOT NULL,                           -- con {{variables}}
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_outbox (                                     -- cola de envío (la procesa el cron)
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  to_email     VARCHAR(160) NOT NULL,
  to_name      VARCHAR(160) NULL,
  subject      VARCHAR(200) NOT NULL,
  body_html    MEDIUMTEXT   NOT NULL,
  template_key VARCHAR(48)  NULL,
  status       ENUM('pendiente','enviado','error') NOT NULL DEFAULT 'pendiente',
  attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_error   VARCHAR(500) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at      DATETIME     NULL,
  KEY idx_outbox_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE events (                                           -- calendario (público o interno)
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(160) NOT NULL,
  description  TEXT         NULL,
  starts_on    DATE         NOT NULL,
  ends_on      DATE         NOT NULL,
  starts_at    TIME         NULL,
  kind         VARCHAR(30)  NOT NULL DEFAULT 'evento',          -- festivo, vacaciones, celebración…
  visibility   ENUM('publico','privado') NOT NULL DEFAULT 'publico',
  course_id    BIGINT UNSIGNED NULL,
  created_by   VARCHAR(120) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_event_range (starts_on, ends_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Portal de familias ─────────────────────────
CREATE TABLE portal_accounts (                                  -- un usuario por estudiante
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id   BIGINT UNSIGNED NOT NULL UNIQUE,
  username     VARCHAR(40)  NOT NULL UNIQUE,                    -- el código del estudiante: GAB-0183
  password_hash VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  failed_logins TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME     NULL,
  last_login_at DATETIME    NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_portal_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
