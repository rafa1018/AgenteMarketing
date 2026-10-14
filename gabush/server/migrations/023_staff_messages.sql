-- Mensajes al personal (docentes, auxiliares…): los envía la rectora / administración; cada persona los lee en
-- «Mi bandeja» del panel (y le llegan como notificación si las activó). Se sabe quién lo leyó y cuándo.
CREATE TABLE staff_messages (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subject      VARCHAR(160) NOT NULL,
  body         TEXT         NOT NULL,
  audience     VARCHAR(160) NOT NULL,                           -- «Todo el personal», «Docentes», «Miss Yasmin, Miss Imary»
  sender_id    VARCHAR(64)  NOT NULL,                           -- usuario del panel que lo envió
  sender_name  VARCHAR(120) NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff_msg_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE staff_message_recipients (
  message_id   BIGINT UNSIGNED NOT NULL,
  user_id      VARCHAR(64)  NOT NULL,                           -- usuario del panel (users.json)
  user_name    VARCHAR(120) NOT NULL,
  read_at      DATETIME     NULL,
  PRIMARY KEY (message_id, user_id),
  KEY idx_staff_inbox (user_id, read_at),
  CONSTRAINT fk_staff_msg FOREIGN KEY (message_id) REFERENCES staff_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
