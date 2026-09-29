import { createHash, timingSafeEqual } from "node:crypto";
import { parseCookies } from "better-auth/cookies";
import { env } from "@reactive-resume/env/server";

const RESUME_ACCESS_COOKIE_PREFIX = "resume_access";
const RESUME_ACCESS_TTL_SECONDS = 60 * 10; // 10 minutes

const getResumeAccessCookieName = (resumeId: string) => `${RESUME_ACCESS_COOKIE_PREFIX}_${resumeId}`;

const signResumeAccessToken = (resumeId: string, passwordHash: string): string =>
	createHash("sha256").update(`${resumeId}:${passwordHash}`).digest("hex");

export const safeEquals = (value: string, expected: string) => {
	const valueBuffer = Buffer.from(value);
	const expectedBuffer = Buffer.from(expected);
	if (valueBuffer.length !== expectedBuffer.length) return false;
	return timingSafeEqual(valueBuffer, expectedBuffer);
};

export const hasResumeAccess = (requestHeaders: Headers, resumeId: string, passwordHash: string | null) => {
	if (!passwordHash) return false;
	const cookieName = getResumeAccessCookieName(resumeId);
	const cookieValue = parseCookies(requestHeaders.get("cookie") ?? "").get(cookieName);
	if (!cookieValue) return false;
	const expected = signResumeAccessToken(resumeId, passwordHash);
	return safeEquals(cookieValue, expected);
};

export const grantResumeAccess = (responseHeaders: Headers, resumeId: string, passwordHash: string) => {
	const value = `${getResumeAccessCookieName(resumeId)}=${signResumeAccessToken(resumeId, passwordHash)}`;
	const secure = env.APP_URL.startsWith("https") ? "; Secure" : "";
	responseHeaders.append(
		"Set-Cookie",
		`${value}; Path=/; Max-Age=${RESUME_ACCESS_TTL_SECONDS}; SameSite=Lax; HttpOnly${secure}`,
	);
};
