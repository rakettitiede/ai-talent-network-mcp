PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;

DROP INDEX IF EXISTS idx_employee_skills_employee_id;
DROP INDEX IF EXISTS idx_skill;
DROP INDEX IF EXISTS idx_certificate;
DROP INDEX IF EXISTS idx_project_history_employee_id;
DROP INDEX IF EXISTS idx_openings_employee_id;
DROP INDEX IF EXISTS idx_openings_dates;

DROP VIEW IF EXISTS employee_availability;

DROP TABLE IF EXISTS project_history;
DROP TABLE IF EXISTS employee_certificates;
DROP TABLE IF EXISTS employee_skills;
DROP TABLE IF EXISTS openings;
DROP TABLE IF EXISTS vec_employees;
DROP TABLE IF EXISTS vec_projects;
DROP TABLE IF EXISTS employees;

COMMIT;

PRAGMA foreign_keys=ON;

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  description TEXT
);

CREATE VIRTUAL TABLE vec_employees USING vec0(
  employee_id TEXT PRIMARY KEY,
  embed FLOAT[1536] distance_metric=cosine
);

CREATE TABLE employee_skills (
  employee_id TEXT REFERENCES employees(id),
  name TEXT COLLATE NOCASE,
  proficiency INTEGER,
  motivation INTEGER
);

CREATE TABLE employee_certificates (
  employee_id TEXT REFERENCES employees(id),
  name TEXT COLLATE NOCASE,
  issued TEXT
);

CREATE TABLE project_history (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  description TEXT
);

CREATE VIRTUAL TABLE vec_projects USING vec0(
  project_id TEXT PRIMARY KEY,
  embed FLOAT[1536] distance_metric=cosine
);

CREATE TABLE openings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES employees(id),
  start_date TEXT,
  end_date TEXT
);

CREATE INDEX idx_employee_skills_employee_id ON employee_skills (employee_id);
CREATE INDEX idx_skill ON employee_skills (name);
CREATE INDEX idx_certificate ON employee_certificates (name);
CREATE INDEX idx_project_history_employee_id ON project_history (employee_id);
CREATE INDEX idx_openings_employee_id ON openings(employee_id);
CREATE INDEX idx_openings_dates ON openings(start_date, end_date);

CREATE VIEW employee_availability AS
SELECT
  e.id AS employee_id,
  CASE
    WHEN COUNT(o.id) = 0 THEN 'Available now'
    WHEN MAX(o.end_date) IS NOT NULL THEN 'Available after ' || MAX(o.end_date)
    ELSE 'Currently unavailable'
  END AS availability
FROM employees e
LEFT JOIN openings o
  ON e.id = o.employee_id
  AND o.start_date <= date('now')
  AND (o.end_date IS NULL OR o.end_date >= date('now'))
GROUP BY e.id;
