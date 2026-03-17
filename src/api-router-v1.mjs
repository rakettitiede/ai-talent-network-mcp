import express from "express";

import { doSearch } from "./do-search.mjs";
import { doFetch } from "./do-fetch.mjs";
import { updateDatabase } from "./database.mjs";

/**
 * @openapi
 * components:
 *   schemas:
 *     SearchResult:
 *       type: object
 *       properties:
 *         results:
 *           type: array
 *           items:
 *             type: object
 *           description: Array of candidates results
 *         count:
 *           type: integer
 *           description: Number of candidates that match the query string
 *           example: 5
 *     Document:
 *       type: object
 *       description: Response from fetch endpoint for candidate or project
 *       properties:
 *         id:
 *           type: string
 *           description: Document ID (candidate:uuid or project:uuid)
 *           example: "candidate:cde02670-decc-4441-8823-bf62d4917dbc"
 *         title:
 *           type: string
 *           description: Human-readable title
 *           example: "Candidate: John Doe"
 *         text:
 *           type: object
 *           description: Full document content (structure varies by type)
 *           oneOf:
 *             - $ref: '#/components/schemas/CandidateText'
 *             - $ref: '#/components/schemas/ProjectText'
 *         url:
 *           type: string
 *           description: Link to Agileday profile
 *           example: "https://agileday.com/en-GB/spaces/people?drawer[]=Employee:id=uuid"
 *         metadata:
 *           type: object
 *           description: Additional metadata about the document
 *           properties:
 *             type:
 *               type: string
 *               enum: [candidate, project]
 *             employeeId:
 *               type: string
 *             projectId:
 *               type: string
 *             skillsCount:
 *               type: integer
 *             certificatesCount:
 *               type: integer
 *             projectsCount:
 *               type: integer
 *     CandidateText:
 *       type: object
 *       description: Candidate details
 *       properties:
 *         name:
 *           type: string
 *           example: "John Doe"
 *         description:
 *           type: string
 *           description: External profile description
 *         segment:
 *           type: string
 *           example: "EMPLOYEE"
 *         availability:
 *           type: string
 *           example: "Available now"
 *         skills:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               proficiency:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               motivation:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *         certificates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               issued:
 *                 type: string
 *         projects:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProjectHistory'
 *     ProjectText:
 *       type: object
 *       description: Project details
 *       properties:
 *         id:
 *           type: string
 *         employee_id:
 *           type: string
 *         company:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         role:
 *           type: string
 *         skills:
 *           type: string
 *         startDate:
 *           type: string
 *         endDate:
 *           type: string
 *         employeeName:
 *           type: string
 *     ProjectHistory:
 *       type: object
 *       properties:
 *         company:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         role:
 *           type: string
 *         skills:
 *           type: string
 *         startDate:
 *           type: string
 *         endDate:
 *           type: string
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Missing query parameter ?q="
 */

export const apiRouterV1 = express.Router();

/**
 * @openapi
 * /search:
 *   get:
 *     operationId: searchCandidates
 *     summary: Search for candidates
 *     description: Search for candidates using a query string
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query string
 *         example: "Professional in Frontend with knowledge in NodeJS React and OpenAPI Python"
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResult'
 *             examples:
 *               searchResults:
 *                 summary: Example search results with different availability statuses
 *                 value:
 *                   results:
 *                     - id: "candidate:cde02670-decc-4441-8823-bf62d4917dbc"
 *                       title: "John Doe (Frontend), Available now — matched by candidate name, profile description matches at 85%"
 *                       url: "https://agileday.com/profile/cde02670-decc-4441-8823-bf62d4917dbc"
 *                     - id: "project:3420d00b-9262-4ae0-afe5-f3d16963f3c0"
 *                       title: "John Doe (Frontend), Available now — history project matches at 90%: Built a modern e-commerce platform"
 *                       url: "https://agileday.com/profile/cde02670-decc-4441-8823-bf62d4917dbc"
 *                     - id: "candidate:abc12345-6789-0123-4567-890123456789"
 *                       title: "Jane Smith (Backend), Available after 2025-12-31 (current project: Nordea Investment Platform Phase 2) — matching skills with proficiency: Java, Spring Boot"
 *                       url: "https://agileday.com/profile/abc12345-6789-0123-4567-890123456789"
 *                     - id: "candidate:xyz98765-4321-0987-6543-210987654321"
 *                       title: "Alice Cooper (DevOps), Available after 2026-03-15 (current projects: Project A, Project B) — profile description matches at 88%"
 *                       url: "https://agileday.com/profile/xyz98765-4321-0987-6543-210987654321"
 *                     - id: "candidate:def67890-1234-5678-9012-345678901234"
 *                       title: "Bob Johnson (Fullstack), Currently unavailable (current project: Acme Corp Platform, no end date) — profile description matches at 92%"
 *                       url: "https://agileday.com/profile/def67890-1234-5678-9012-345678901234"
 *                     - id: "candidate:ghi11111-2222-3333-4444-555555555555"
 *                       title: "Charlie Brown (Backend), Currently unavailable (current projects: Project X, Project Y, no end date) — matching skills with proficiency: Python, Django"
 *                       url: "https://agileday.com/profile/ghi11111-2222-3333-4444-555555555555"
 *                   count: 6
 *       400:
 *         description: Missing or invalid query parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Search failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
apiRouterV1.get("/search", async (req, res) => {
	try {
		const q = String(req.query.q || "").trim();
		console.log(`💻 GET /search: ${q}`);
		if (!q) return res.status(400).json({ error: "Missing query parameter ?q=" });

		const { results } = await doSearch(q);
    console.log(`💯 results found: ${results.length}`);
		return res.json({ results, count: results.length });
	} catch (err) {
		console.error("GET /search error:", err);
		return res.status(500).json({ error: "Search failed" });
	}
});

/**
 * @openapi
 * /fetch:
 *   get:
 *     operationId: fetchCandidate
 *     summary: Fetch full information of a candidate or project by ID
 *     description: Retrieve a specific document using its ID
 *     tags: [Fetch]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Candidate or Project ID to fetch
 *         example: "candidate:cde02670-decc-4441-8823-bf62d4917dbc|project:3420d00b-9262-4ae0-afe5-f3d16963f3c0"
 *     responses:
 *       200:
 *         description: Candidate or Project retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *             examples:
 *               candidateResponse:
 *                 summary: Example candidate response
 *                 value:
 *                   id: "candidate:cde02670-decc-4441-8823-bf62d4917dbc"
 *                   title: "Candidate: John Doe"
 *                   text:
 *                     name: "John Doe"
 *                     description: "Experienced frontend developer with expertise in React and Node.js"
 *                     skills:
 *                       - name: "React"
 *                         proficiency: "Expert"
 *                       - name: "JavaScript"
 *                         proficiency: "Advanced"
 *                     certificates: []
 *                     projects: []
 *                     segment: "Frontend"
 *                     availability: "Available now"
 *                   url: "https://agileday.com/profile/cde02670-decc-4441-8823-bf62d4917dbc"
 *                   metadata:
 *                     type: "candidate"
 *                     employeeId: "cde02670-decc-4441-8823-bf62d4917dbc"
 *                     skillsCount: 4
 *                     certificatesCount: 1
 *                     projectsCount: 1
 *               projectResponse:
 *                 summary: Example project response
 *                 value:
 *                   id: "project:3420d00b-9262-4ae0-afe5-f3d16963f3c0"
 *                   title: "Project: Acme Corp - E-commerce Platform"
 *                   text:
 *                     id: "3420d00b-9262-4ae0-afe5-f3d16963f3c0"
 *                     employee_id: "cde02670-decc-4441-8823-bf62d4917dbc"
 *                     company: "Acme Corp"
 *                     title: "E-commerce Platform"
 *                     description: "Built a modern e-commerce platform using React and Node.js"
 *                     role: "Senior Frontend Developer"
 *                     skills: "React, Node.js, TypeScript, PostgreSQL"
 *                     startDate: "2023-01-15"
 *                     endDate: "2024-06-30"
 *                     visibleInCv: true
 *                     employeeName: "John Doe"
 *                   url: "https://agileday.com/profile/cde02670-decc-4441-8823-bf62d4917dbc"
 *                   metadata:
 *                     employee:
 *                       name: "John Doe"
 *                       description: "Experienced frontend developer with expertise in React and Node.js"
 *                       segment: "Frontend"
 *                       skills:
 *                         - name: "React"
 *                           proficiency: 5
 *                           motivation: 4
 *                         - name: "JavaScript"
 *                           proficiency: 5
 *                           motivation: 5
 *                       certificates:
 *                         - name: "AWS Certified Developer"
 *                           issued: "2022-03-15"
 *                       projects: []
 *                       availability: "Available now"
 *                     type: "project"
 *                     projectId: "3420d00b-9262-4ae0-afe5-f3d16963f3c0"
 *                     employeeId: "cde02670-decc-4441-8823-bf62d4917dbc"
 *       400:
 *         description: Missing or invalid ID parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Fetch failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
apiRouterV1.get("/fetch", async (req, res) => {
	try {
		const id = String(req.query.id || "").trim();
		console.log(`👷 GET /fetch: ${id}`);
		if (!id) return res.status(400).json({ error: "Missing query parameter ?id=" });

		const doc = await doFetch(id);
		return res.json(doc);
	} catch (err) {
		console.error("GET /fetch error:", err);
		return res.status(500).json({ error: "Fetch failed" });
	}
});

// Admin-only endpoint - not exposed in OpenAPI schema
apiRouterV1.post("/refresh", async (req, res) => {
	try {
		const { token } = req.body;
		console.log(`🎇 POST /refresh`);
		if (!token) {
			return res.status(400).json({ error: "Missing token" });
		}

		await updateDatabase(token);
		return res.json({ message: "Database refreshed and uploaded to GCS" });
	} catch (err) {
		console.error("POST /refresh error:", err);
		return res.status(500).json({ error: "Update failed" });
	}
});
