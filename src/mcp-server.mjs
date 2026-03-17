import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { doSearch } from "./do-search.mjs";
import { doFetch } from "./do-fetch.mjs";
import { SERVER_NAME, SERVER_VERSION } from "./constants.mjs";

const server = new McpServer({
	name: SERVER_NAME,
	version: SERVER_VERSION,
});

server.registerTool(
	"search",
	{
		title: "Search",
		description: "Search candidates by skills and introduction by keyword, or projects by description",
		inputSchema: { query: z.string().min(1) },
	},
	async ({ query }) => {
		try {
			const { results } = await doSearch(query);
			return { content: [{ type: "text", text: JSON.stringify({ results }) }] };
		} catch (error) {
			console.error("Search error:", error);
			return { content: [{ type: "text", text: JSON.stringify({ results: [] }) }] };
		}
	}
);

server.registerTool(
	"fetch",
	{
		title: "Fetch",
		description: "Fetch a full record by ID returned from search",
		inputSchema: { id: z.string().min(1) },
	},
	async ({ id }) => {
		const doc = await doFetch(id);
		return { content: [{ type: "text", text: JSON.stringify(doc) }] };
	}
);

export { server };
