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

  const empsRaw = await api({ path: "/api/v1/employee", token });
  const empsFiltered = empsRaw.filter(
    (e) => e.disabled === false && e.skills?.length > 0 && e.name && e.externalDescription
  );

  console.log("🧩 Generating employee description embeddings...", empsFiltered.length);

  const employees = await Promise.all(
    empsFiltered.map(async (e) => {
      const profileVec = await embed(e.externalDescription);
      return { ...e, profileVec };
    })
  );

  console.log("✅ Employee descriptions embedded successfully!");

  const projectsRaw = await api({ path: "/api/v1/history_project", token });
  const projectsFiltered = projectsRaw
    .filter(p => p.description && empsFiltered.some(e => e.id === p.employeeId));

  console.log("🧩 Generating project description embeddings...", projectsFiltered.length);

  const projects = await Promise.all(
    projectsFiltered.map(async (p) => {
      const projectVec = await embed(p.description);
      return { ...p, projectVec };
    })
  );

  console.log("✅ Project descriptions embedded successfully!");

  const openingsRaw = await api({ path: "/api/v1/opening", token });

  const openingsFiltered = openingsRaw.filter(o => o.contractees?.length > 0);

  const openings = openingsFiltered.flatMap(opening =>
    opening.contractees.map(contractee => ({
      id: `${opening.id}-${contractee.id}`,
      startDate: opening.startDate || opening.duration?.startDate,
      endDate: opening.endDate || opening.duration?.endDate,
      employeeId: contractee.id,
      projectName: opening.projectlikeName,
      projectId: opening.projectlikeId
    }))
  ).filter(o => empsFiltered.some(e => e.id === o.employeeId));

  console.log(`\n👥 Total consultant-opening records (after flatMap): ${openings.length}`);

  const insertEmp = db.prepare(
    `INSERT OR IGNORE INTO employees (id, description, segment) VALUES (?, ?, ?, ?)`
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
    `INSERT OR IGNORE INTO project_history (id, employee_id, company, title, description, role, skills, startDate, endDate, visibleInCv) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertProjectVec = db.prepare(
    `INSERT INTO vec_projects (project_id, embed) VALUES (?,?)`
  );

  const insertOpening = db.prepare(
    `INSERT OR IGNORE INTO openings (id, employee_id, start_date, end_date, project_name, project_id) VALUES (?, ?, ?, ?, ?, ?)`
  );

  const insertMany = db.transaction((emps) => {
    for (const e of emps) {
      const name = `${e.firstName.trim()} ${e.lastName.trim()}`;
      const segment = e.segment.toUpperCase();
      insertEmp.run(e.id, name, e.externalDescription, segment);
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

      const employeeProjects = projects.filter(p => p.employeeId === e.id);
      for (const p of employeeProjects) {
        insertProject.run(p.id, e.id, p.company, p.title, p.description, p.role, p.skills, p.startDate, p.endDate, p.visibleInCv ? 1 : 0);
        insertProjectVec.run(p.id, p.projectVec);
      }

      const employeeOpenings = openings.filter(o => o.employeeId === e.id);
      for (const o of employeeOpenings) {
        insertOpening.run(o.id, o.employeeId, o.startDate, o.endDate, o.projectName, o.projectId);
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

  const { name, description, segment, availability } = db.prepare(`
    SELECT
      e.*,
      a.availability
    FROM employees e
    JOIN employee_availability a ON e.id = a.employee_id
		WHERE e.id = ?;`
  ).get(id);

  const skills = db.prepare(`
		SELECT name, proficiency, motivation FROM employee_skills s
		WHERE s.employee_id = ?;`
  ).all(id);

  const certificates = db.prepare(`
		SELECT name, issued FROM employee_certificates c
    WHERE c.employee_id = ?;`
  ).all(id);

  const projects = db.prepare(`
		SELECT company, title, description, role, skills, startDate, endDate FROM project_history p
		WHERE p.employee_id = ?;`
  ).all(id);

  db.close();

  return { name, description, segment, skills, certificates, projects, availability };
}

export function searchByName(query) {
  const dbPath = getDatabasePath();
  const db = new Database(dbPath);
  const rows = db.prepare(`
    SELECT 
      e.*,
      a.availability
    FROM employees e
    JOIN employee_availability a ON e.id = a.employee_id
		WHERE instr(?, lower(e.name)) > 0
		OR instr(lower(e.name),?) > 0;`
  ).all(query, query);
  db.close();
  return rows;
}

export function searchEmployeesBySkills(query) {
  const dbPath = getDatabasePath();
  const tokens = tokenizeQuery(query);
  const placeholders = tokens.map(() => '?').join(', ');
  const db = new Database(dbPath);
  const rows = db.prepare(`
		SELECT e.id, 
					 e.name, 
					 e.segment,
					 group_concat(DISTINCT s.name || ' (' || s.proficiency || '/5)') AS skills,
					 COUNT(DISTINCT s.name) AS skillCount,
					 a.availability
		FROM employees e
		JOIN employee_skills s ON e.id = s.employee_id
		JOIN employee_availability a ON e.id = a.employee_id
		WHERE s.name IN (${placeholders})
		GROUP BY e.id, e.name, e.segment, a.availability
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
		SELECT	e.*,
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
		SELECT	p.id,
            p.employee_id as employeeId,
            p.description,
						e.name,
						e.segment,
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
		SELECT	p.*,
						e.name as employeeName
    FROM project_history p
		JOIN employees e ON p.employee_id = e.id
		WHERE p.id =?;`
  ).get(id);

  db.close();

  if (!row) {
    return null;
  }

  return row;
}
