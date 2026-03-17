import express from "express";

import { doSearch } from "./do-search.mjs";
import { doFetch } from "./do-fetch.mjs";
import { updateDatabase } from "./database.mjs";

/**
 * @openapi
 * components:
 *   schemas:
 *     SearchResultItem:
 *       type: object
 *       description: A single search result — anonymized, no personal data
 *       properties:
 *         id:
 *           type: string
 *           description: Candidate or project ID — uses rotating temporary identifiers (temp:xxxxxxxx) generated per database refresh
 *           example: "candidate:temp:a1b2c3d4"
 *         title:
 *           type: string
 *           description: "Availability status followed by match reason(s), separated by em dash (—)"
 *           example: "Available now — matching skills with proficiency: React, TypeScript"
 *         url:
 *           type: string
 *           description: Link to Rakettitiede website for follow-up contact
 *           example: "https://www.rakettitiede.com"
 *     SearchResult:
 *       type: object
 *       properties:
 *         results:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SearchResultItem'
 *         count:
 *           type: integer
 *           description: Number of results returned
 *           example: 3
 *     Skill:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "React"
 *         proficiency:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           example: 4
 *         motivation:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *     CandidateText:
 *       type: object
 *       description: Anonymized candidate profile — no personal data
 *       properties:
 *         description:
 *           type: string
 *           description: Anonymized professional profile description
 *           example: "Experienced fullstack developer specializing in React, Node.js, and cloud solutions."
 *         skills:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Skill'
 *         availability:
 *           type: string
 *           description: "Current availability: 'Available now', 'Available after YYYY-MM-DD (current project: name)', or 'Currently unavailable (current project: name, no end date)'"
 *           example: "Available now"
 *     Document:
 *       type: object
 *       description: Full anonymized candidate or project document
 *       properties:
 *         id:
 *           type: string
 *           description: Document ID (candidate:uuid or project:uuid)
 *           example: "candidate:temp:a1b2c3d4"
 *         title:
 *           type: string
 *           description: "'Candidate found' or 'Candidate found by project'"
 *           example: "Candidate found"
 *         text:
 *           $ref: '#/components/schemas/CandidateText'
 *         url:
 *           type: string
 *           description: Link to Rakettitiede website for follow-up contact
 *           example: "https://www.rakettitiede.com"
 *         metadata:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [candidate, project]
 *               example: "candidate"
 *             skillsCount:
 *               type: integer
 *               example: 5
 *             project:
 *               type: string
 *               description: Project description (only present when type is 'project')
 *               example: "Built a real-time monitoring dashboard using React and GraphQL."
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
 *     summary: Search for anonymized candidates
 *     description: >
 *       Search for candidates by skill, role, or description. Returns anonymized results only —
 *       no names, emails, or personal data. Results include availability status and match reasons.
 *       Title format: "<availability> — <reason(s)>"
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (skills, role, or description)
 *         example: "React TypeScript frontend developer"
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResult'
 *             examples:
 *               searchResults:
 *                 summary: Example search results
 *                 value:
 *                   results:
 *                     - id: "candidate:temp:a1b2c3d4"
 *                       title: "Available now — matching skills with proficiency: React, TypeScript"
 *                       url: "https://www.rakettitiede.com"
 *                     - id: "candidate:temp:b2c3d4e5"
 *                       title: "Available after 2026-12-31 (current project: Microservices Platform) — profile description matches at 88%"
 *                       url: "https://www.rakettitiede.com"
 *                     - id: "project:temp:c3d4e5f6"
 *                       title: "Currently unavailable (current project: Analytics Platform, no end date) — history project matches at 82%: Built a real-time data pipeline using React and GraphQL."
 *                       url: "https://www.rakettitiede.com"
 *                   count: 3
 *       400:
 *         description: Missing or empty query parameter
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
 *     summary: Fetch full anonymized candidate or project document
 *     description: >
 *       Retrieve a full anonymized candidate profile or project document by ID.
 *       No personal data is returned — only skills, availability, and anonymized descriptions.
 *     tags: [Fetch]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID from search results (candidate:uuid or project:uuid)
 *         example: "candidate:temp:a1b2c3d4"
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *             examples:
 *               candidateResponse:
 *                 summary: Candidate document
 *                 value:
 *                   id: "candidate:temp:a1b2c3d4"
 *                   title: "Candidate found"
 *                   text:
 *                     description: "Experienced fullstack developer specializing in React, Node.js, and cloud solutions."
 *                     skills:
 *                       - name: "React"
 *                         proficiency: 5
 *                         motivation: 5
 *                       - name: "TypeScript"
 *                         proficiency: 4
 *                         motivation: 4
 *                     availability: "Available now"
 *                   url: "https://www.rakettitiede.com"
 *                   metadata:
 *                     type: "candidate"
 *                     skillsCount: 5
 *               projectResponse:
 *                 summary: Project document (candidate found via project history)
 *                 value:
 *                   id: "project:temp:c3d4e5f6"
 *                   title: "Candidate found by project"
 *                   text:
 *                     description: "Experienced DevOps engineer specializing in cloud infrastructure and CI/CD pipelines."
 *                     skills:
 *                       - name: "Kubernetes"
 *                         proficiency: 4
 *                         motivation: 5
 *                       - name: "Docker"
 *                         proficiency: 5
 *                         motivation: 5
 *                     availability: "Available after 2026-06-30 (current project: Cloud Migration)"
 *                   url: "https://www.rakettitiede.com"
 *                   metadata:
 *                     type: "project"
 *                     skillsCount: 4
 *                     project: "Migrated legacy infrastructure to GCP using Kubernetes and Terraform."
 *               notFound:
 *                 summary: Document not found
 *                 value:
 *                   id: "candidate:00000000-0000-0000-0000-000000000000"
 *                   title: "Not found"
 *                   text: ""
 *                   url: ""
 *                   metadata: {}
 *       400:
 *         description: Missing or invalid id parameter
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
