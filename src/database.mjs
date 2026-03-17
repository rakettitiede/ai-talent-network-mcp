import Database from 'better-sqlite3';
import * as vec from "sqlite-vec";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { uploadDatabaseToGCS, getDatabasePath } from "./storage.mjs";
import { api } from './api.mjs';
import { embed } from './embeddings.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, '..', 'migrations');

function runMigrations(db) {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(sql);
  }
}

export function checkHealtDatabase() {
  const dbPath = getDatabasePath();
  console.log("🔎 Checking database...");
  if (fs.existsSync(dbPath) === false) {
    console.log("⛲ DB not found skipping database check");
    return;
  }

  const db = new Database(dbPath);
  vec.load(db);
  const employeesCount = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;
  console.log(`👷 ${employeesCount} employees found in the database!`);
  const projectsCount = db.prepare('SELECT COUNT(*) as count FROM project_history').get().count;
  console.log(`📁 ${projectsCount} projects found in the database!`);
  const vecEmployeesCount = db.prepare('SELECT COUNT(*) as count FROM vec_employees').get().count;
  console.log(`📤 ${vecEmployeesCount} employees descriptions vectors found!`);
  const vecProjectsCount = db.prepare('SELECT COUNT(*) as count FROM vec_projects').get().count;
  console.log(`⭕ ${vecProjectsCount} projects descriptions vectors found!`);
  const openingsCount = db.prepare('SELECT COUNT(*) as count FROM openings').get().count;
  console.log(`🎯 ${openingsCount} openings found in the database!`);
  db.close();
}

export async function updateDatabase(token) {
  const dbPath = getDatabasePath();
  console.log("🚚 Initializing database...");
  const db = new Database(dbPath);
  vec.load(db);
  runMigrations(db);

  const projectsRaw = await api({ path: "/api/v1/history_project", token });

  const openingsRaw = await api({ path: "/api/v1/opening", token });
  const openingsFiltered = openingsRaw.filter(o => o.contractees?.length > 0);

  const empsRaw = await api({ path: "/api/v1/employee", token });
  const empsFiltered = empsRaw.filter(
    (e) => e.disabled === false && e.skills?.length > 0 && e.name && e.externalDescription
  );

  console.log("🧩 Generating employee description, project descriptions embeddings...", empsFiltered.length);

  const employees = await Promise.all(
    empsFiltered.map(async (emp) => {
      const {
        id: originalId,
        externalDescription: description,
        skills,
        certificates
      } = emp;
      const id = `temp:${crypto.randomUUID().slice(0, 8)}`;
      const profileVec = await embed(description);
      const projectsFiltered = projectsRaw
        .filter(p => p.description && p.employeeId === originalId);

      const projects = await Promise.all(
        projectsFiltered.map(async (p) => {
          const projectVec = await embed(p.description);
          return {
            id: `temp:${crypto.randomUUID().slice(0, 8)}`,
            description: p.description,
            employeeId: id,
            projectVec
          };
        })
      );

      const openings = openingsFiltered.flatMap(opening =>
        opening.contractees
          .filter(contractee => contractee.id === originalId)
          .map(() => ({
            startDate: opening.startDate || opening.duration?.startDate,
            endDate: opening.endDate || opening.duration?.endDate,
            employeeId: id,
          }))
      );

      return {
        id,
        description,
        skills,
        certificates,
        profileVec,
        projects,
        openings,
      };
    })
  );

  console.log("✅ Employee descriptions, project descriptions embedded successfully!");

  const insertEmp = db.prepare(
    `INSERT OR IGNORE INTO employees (id, description) VALUES (?, ?)`
  );
  const insertVec = db.prepare(
    `INSERT INTO vec_employees (employee_id, embed) VALUES (?, ?)`
  );
  const insertSkill = db.prepare(
    `INSERT OR IGNORE INTO employee_skills (employee_id, name, proficiency, motivation) VALUES (?, ?, ?, ?)`
  );
  const insertCertificate = db.prepare(
    `INSERT OR IGNORE INTO employee_certificates (employee_id, name, issued) VALUES (?, ?, ?)`
  );
  const insertProject = db.prepare(
    `INSERT OR IGNORE INTO project_history (id, employee_id, description) VALUES (?, ?, ?)`
  );
  const insertProjectVec = db.prepare(
    `INSERT INTO vec_projects (project_id, embed) VALUES (?,?)`
  );

  const insertOpening = db.prepare(
    `INSERT OR IGNORE INTO openings (employee_id, start_date, end_date) VALUES (?, ?, ?)`
  );

  const insertMany = db.transaction((emps) => {
    for (const e of emps) {
      insertEmp.run(e.id, e.description);
      insertVec.run(e.id, e.profileVec);

      for (const skill of e.skills) {
        if (skill.proficiency <= 3 || skill.motivation <= 3 || skill.visibleInCv === false) {
          continue;
        }

        insertSkill.run(e.id, skill.name, skill.proficiency, skill.motivation);
      }

      for (const certificate of e.certificates ?? []) {
        insertCertificate.run(e.id, certificate.name, certificate.issued);
      }

      for (const p of e.projects ?? []) {
        insertProject.run(p.id, e.id, p.description);
        insertProjectVec.run(p.id, p.projectVec);
      }

      for (const o of e.openings ?? []) {
        insertOpening.run(o.employeeId, o.startDate, o.endDate);
      }
    }
  });

  insertMany(employees);

  console.log(`👷 ${employees.length} employees and his skills inserted into the database!`);

  const projectsTotal = db.prepare(`
		SELECT COUNT(*) as count FROM project_history;`
  ).get().count;

  const openingsTotal = db.prepare(`
    SELECT COUNT(*) as count from openings;`
  ).get().count;

  db.close();

  console.log(`💼 ${projectsTotal} projects in total!`);
  console.log(`🎯 ${openingsTotal} openings in total!`);

  await uploadDatabaseToGCS();

  console.log("📦 Synced updated database to GCS");
  console.log("✨ Database initialized successfully!");
}

export function searchEmployeeById(id) {
  const dbPath = getDatabasePath();
  const db = new Database(dbPath);
  const employeeExists = db.prepare(`
		SELECT COUNT(*) as count FROM employees e
		WHERE e.id = ?;`
  ).get(id).count > 0;

  if (!employeeExists) {
    db.close();
    return null;
  }

  const { description, availability } = db.prepare(`
    SELECT
      e.description,
      a.availability
    FROM employees e
    JOIN employee_availability a ON e.id = a.employee_id
		WHERE e.id = ?;`
  ).get(id);

  const skills = db.prepare(`
		SELECT name, proficiency, motivation FROM employee_skills s
		WHERE s.employee_id = ?;`
  ).all(id);

  db.close();

  return { description, skills, availability };
}

export function searchEmployeesBySkills(query) {
  const dbPath = getDatabasePath();
  const tokens = tokenizeQuery(query);
  const placeholders = tokens.map(() => '?').join(', ');
  const db = new Database(dbPath);
  const rows = db.prepare(`
		SELECT e.id,
					 group_concat(DISTINCT s.name || ' (' || s.proficiency || '/5)') AS skills,
					 COUNT(DISTINCT s.name) AS skillCount,
					 a.availability
		FROM employees e
		JOIN employee_skills s ON e.id = s.employee_id
		JOIN employee_availability a ON e.id = a.employee_id
		WHERE s.name IN (${placeholders})
		GROUP BY e.id, a.availability
		ORDER BY skillCount DESC;`
  ).all(tokens);
  db.close();
  return rows;
}

export async function findMatchingCandidates(query) {
  const descriptionStringVec = await embed(query);
  const dbPath = getDatabasePath();
  const db = new Database(dbPath);
  vec.load(db);
  const rows = db.prepare(`
		SELECT  e.id,
						v.distance AS distance_num,
						printf('%.3f', v.distance, 3) as distance,
            a.availability
		FROM vec_employees v
		JOIN employees e ON v.employee_id = e.id
    JOIN employee_availability a ON e.id = a.employee_id
		WHERE v.embed MATCH vec_f32(?)
			AND k = 10
      AND v.distance <= 0.5
		ORDER BY distance_num ASC
		LIMIT 10;`
  ).all(descriptionStringVec);

  db.close();
  return rows;
};

export async function findMatchingProjects(query) {
  const descriptionStringVec = await embed(query);
  const dbPath = getDatabasePath();
  const db = new Database(dbPath);
  vec.load(db);
  const rows = db.prepare(`
		SELECT  p.id,
            p.description,
						v.distance AS distance_num,
						printf('%.3f', v.distance, 3) as distance,
						a.availability
		FROM vec_projects v
			JOIN project_history p ON v.project_id = p.id
			JOIN employees e ON p.employee_id = e.id
			JOIN employee_availability a ON e.id = a.employee_id
		WHERE v.embed MATCH vec_f32(?)
			AND k = 10
		  AND v.distance <= 0.5
		ORDER BY distance_num ASC
		LIMIT 10;`
  ).all(descriptionStringVec);

  db.close();
  return rows;
}

/* Helper function to look up explicit skills */
function tokenizeQuery(query) {
  // split by anything not a letter/number
  const tokens = query.split(/[^a-z0-9#+.]+/).filter(Boolean);
  // de-duplicate
  const uniqTokens = [...new Set(tokens)];
  return uniqTokens;
}

export function searchProjectById(id) {
  const dbPath = getDatabasePath();
  const db = new Database(dbPath);
  const row = db.prepare(`
		SELECT	p.id,
						p.description,
						p.employee_id
    FROM project_history p
		WHERE p.id =?;`
  ).get(id);

  db.close();

  if (!row) {
    return null;
  }

  return row;
}
