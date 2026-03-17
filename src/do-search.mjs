import { findMatchingCandidates, searchEmployeesBySkills, findMatchingProjects } from "./database.mjs";
import { ResultsMap } from "./results-map.mjs";

export async function doSearch(query) {
  const results = new ResultsMap();
  const q = String(query?.toLowerCase() ?? "").replace(/\s+/g, ' ').trim();

  if (!q) {
    return { results: [], count: 0 };
  }

  const descriptionMatches = await findMatchingCandidates(q);

  descriptionMatches.forEach(({ id, distance, availability }) => {
    const percent = `${Math.round((1 - distance) * 100)}%`;
    results.add({ id: `candidate:${id}`, reason: `profile description matches at ${percent}`, availability });
  });

  const skillMatches = searchEmployeesBySkills(q);

  skillMatches.forEach(({ id, skills, skillCount, availability }) => {
    results.add({ id: `candidate:${id}`, reason: `matching skills with proficiency: ${skills}`, skillCount, availability });
  });

  const projectMatches = await findMatchingProjects(q);
  projectMatches.forEach(({ id, description, distance, availability }) => {
    const percent = `${Math.round((1 - distance) * 100)}%`;
    results.add({ id: `project:${id}`, reason: `history project matches at ${percent}:  ${description}`, availability });
  });

  return { results: results.values() };
}
