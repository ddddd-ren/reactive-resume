import { resolveUserFromRequestHeaders } from "@reactive-resume/api/context";

export class AuthError extends Error {
	constructor() {
		super("Unauthorized");
	}
}

export async function authenticateRequest(request: Request): Promise<void> {
	// MCP accepts API keys and bearer tokens; share their priority and validation with its oRPC tools.
	const headers = new Headers(request.headers);
	headers.delete("cookie");
	if (await resolveUserFromRequestHeaders(headers)) return;
	throw new AuthError();
}
