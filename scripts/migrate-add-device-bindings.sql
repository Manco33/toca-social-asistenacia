-- Add device binding fields to empleados and create device_attempts table
ALTER TABLE empleados
  ADD COLUMN device_id VARCHAR(255) NULL AFTER usuario,
  ADD COLUMN device_label VARCHAR(255) NULL AFTER device_id,
  ADD COLUMN device_bound_at DATETIME NULL AFTER device_label;

CREATE TABLE IF NOT EXISTS device_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  device_label VARCHAR(255) DEFAULT NULL,
  device_owner_usuario VARCHAR(255) DEFAULT NULL,
  attempted_usuario VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved TINYINT(1) NOT NULL DEFAULT 0,
  resolved_by VARCHAR(255) DEFAULT NULL,
  resolved_at DATETIME DEFAULT NULL
);
