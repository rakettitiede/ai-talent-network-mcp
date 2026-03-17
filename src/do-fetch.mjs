import { searchEmployeeById, searchProjectById } from "./database.mjs";
import { RAKETTITIEDE_WEBSITE as url } from "./constants.mjs";

export async function doFetch(id) {
	let doc = { id, title: "Not found", text: "", url: "", metadata: {} };

	try {
		if (id.startsWith("candidate:")) {
			const actualId = id.slice(10);
			const candidate = searchEmployeeById(actualId);

      if (candidate === null) {
        return doc;
      }

			doc = {
				id,
        title: "Candidate found",
				text: {
          description: candidate.description,
          skills: candidate.skills,
          availability: candidate.availability,
        },
        url,
				metadata: {
					type: "candidate",
					skillsCount: candidate.skills.length,
				},
			};
		}

		if (id.startsWith("project:")) {
			const actualId = id.slice(8);
			const project = searchProjectById(actualId);
      if (project === null) {
        return doc;
      }

			const candidate = searchEmployeeById(project.employee_id);

			doc = {
				id,
        title: "Candidate found by project",
				text: {
          description: candidate.description,
          skills: candidate.skills,
          availability: candidate.availability,
        },
        url,
				metadata: {
					type: "project",
          project: project.description,
          skillsCount: candidate.skills.length,
				},
			};
		}
	} catch (error) {
		console.error("Fetch error:", error);
		doc.text = `Error fetching document: ${error.message}`;
	}

	return doc;
}


