import { describe, expect, it } from "vitest";
import { getNetworkIcon } from "./icons";

describe("getNetworkIcon", () => {
	it("returns 'star' default when network is undefined", () => {
		expect(getNetworkIcon()).toBe("star");
	});

	it("returns 'star' default when network is empty string", () => {
		expect(getNetworkIcon("")).toBe("star");
	});

	it("returns 'star' default when no match found", () => {
		expect(getNetworkIcon("unknown-network")).toBe("star");
	});

	it("matches case-insensitively", () => {
		expect(getNetworkIcon("GitHub")).toBe("github-logo");
		expect(getNetworkIcon("LINKEDIN")).toBe("linkedin-logo");
	});

	it("matches GitHub", () => {
		expect(getNetworkIcon("github")).toBe("github-logo");
	});

	it("matches LinkedIn", () => {
		expect(getNetworkIcon("linkedin")).toBe("linkedin-logo");
	});

	it("matches Twitter and X variants", () => {
		expect(getNetworkIcon("twitter")).toBe("twitter-logo");
		expect(getNetworkIcon("x")).toBe("twitter-logo");
		expect(getNetworkIcon("x.com")).toBe("twitter-logo");
	});

	it("matches Facebook", () => {
		expect(getNetworkIcon("facebook")).toBe("facebook-logo");
	});

	it("matches Instagram", () => {
		expect(getNetworkIcon("instagram")).toBe("instagram-logo");
	});

	it("matches YouTube", () => {
		expect(getNetworkIcon("youtube")).toBe("youtube-logo");
	});

	it("matches Stack Overflow variants", () => {
		expect(getNetworkIcon("stackoverflow")).toBe("stack-overflow-logo");
		expect(getNetworkIcon("stack-overflow")).toBe("stack-overflow-logo");
	});

	it("matches Medium", () => {
		expect(getNetworkIcon("medium")).toBe("medium-logo");
	});

	it("matches Dev.to variants to 'code'", () => {
		expect(getNetworkIcon("dev.to")).toBe("code");
		expect(getNetworkIcon("devto")).toBe("code");
	});

	it("matches Dribbble", () => {
		expect(getNetworkIcon("dribbble")).toBe("dribbble-logo");
	});

	it("matches Behance", () => {
		expect(getNetworkIcon("behance")).toBe("behance-logo");
	});

	it("matches GitLab to 'git-branch'", () => {
		expect(getNetworkIcon("gitlab")).toBe("git-branch");
	});

	it("matches Bitbucket and CodePen to 'code'", () => {
		expect(getNetworkIcon("bitbucket")).toBe("code");
		expect(getNetworkIcon("codepen")).toBe("code");
	});

	it("matches a network named inside a longer label", () => {
		expect(getNetworkIcon("My GitHub Profile")).toBe("github-logo");
	});

	it.each(["Xing", "Dropbox", "Stack Exchange", "Mixcloud", "Fox"])("does not give %s the X logo", (network) => {
		expect(getNetworkIcon(network)).not.toBe("twitter-logo");
	});
});
