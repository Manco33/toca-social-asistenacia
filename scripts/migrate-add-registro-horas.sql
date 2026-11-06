-- Migration: create registro_horas table
CREATE TABLE IF NOT EXISTS registro_horas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL,
    horas_trabajadas DECIMAL(5,2) DEFAULT 0,
    horas_extras DECIMAL(5,2) DEFAULT 0,
    FOREIGN KEY (usuario) REFERENCES empleados(usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);
