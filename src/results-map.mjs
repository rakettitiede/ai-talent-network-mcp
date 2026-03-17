import { RAKETTITIEDE_WEBSITE as url } from "./constants.mjs";

export class ResultsMap {
	constructor() {
		this.map = new Map();
	}

	add({ id, reason, availability }) {
		const existingMatch = this.map.get(id);

		if (existingMatch) {
			this.map.set(id, {
				id,
				reasons: existingMatch.reasons.concat(reason),
        availability: existingMatch.availability || availability,
			});

			return;
		}

		this.map.set(id, {
			id,
			reasons: [reason],
      availability,
		});
	}

	values() {
		return [...this.map.values()].map(({
			id,
			reasons,
      availability,
		}) => ({
			id,
			title: `${availability} — ${reasons.join(', ')}`,
      url,
		}));
	}
}

