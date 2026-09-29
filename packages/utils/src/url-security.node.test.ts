import { describe, expect, it } from "vitest";
import { isAllowedOAuthRedirectUri, isPrivateOrLoopbackHost } from "./url-security.node";

describe("isPrivateOrLoopbackHost", () => {
	it.each([
		"0.0.0.0",
		"10.0.0.1",
		"10.255.255.255",
		"100.64.0.1",
		"100.127.255.255",
		"127.0.0.1",
		"169.254.1.1",
		"172.16.0.1",
		"172.31.255.255",
		"192.0.0.1",
		"192.0.2.1",
		"192.88.99.1",
		"192.168.0.1",
		"192.168.255.255",
		"198.18.0.1",
		"198.19.255.255",
		"198.51.100.1",
		"203.0.113.1",
		"224.0.0.1",
		"240.0.0.1",
		"255.255.255.255",
	])("matches non-public/special-use IPv4 address %s", (address) => {
		expect(isPrivateOrLoopbackHost(address)).toBe(true);
	});

	it.each([
		"::",
		"::1",
		"::ffff:8.8.8.8",
		"::ffff:0808:0808",
		"64:ff9b::1",
		"64:ff9b:1::1",
		"100::1",
		"100:0:0:1::1",
		"2001::1",
		"2001:2::1",
		"2001:10::1",
		"2001:100::1",
		"2001:db8::1",
		"2002::1",
		"3fff::1",
		"5f00::1",
		"fc00::1",
		"fd12::1",
		"fe80::1",
		"fe81::1",
		"febf::1",
		"ff00::1",
		"ff02::1",
	])("matches non-public/special-use IPv6 address %s", (address) => {
		expect(isPrivateOrLoopbackHost(address)).toBe(true);
	});

	describe("loopback hostnames", () => {
		it("matches localhost", () => {
			expect(isPrivateOrLoopbackHost("localhost")).toBe(true);
			expect(isPrivateOrLoopbackHost("LOCALHOST")).toBe(true);
			expect(isPrivateOrLoopbackHost("api.localhost")).toBe(true);
		});

		it("matches bracketed IPv6 loopback [::1]", () => {
			expect(isPrivateOrLoopbackHost("[::1]")).toBe(true);
		});
	});

	describe("private IPv4 ranges", () => {
		it("does NOT match public IPs", () => {
			expect(isPrivateOrLoopbackHost("8.8.8.8")).toBe(false);
			expect(isPrivateOrLoopbackHost("1.1.1.1")).toBe(false);
			expect(isPrivateOrLoopbackHost("93.184.216.34")).toBe(false);
			expect(isPrivateOrLoopbackHost("192.31.196.1")).toBe(false);
			expect(isPrivateOrLoopbackHost("192.52.193.1")).toBe(false);
			expect(isPrivateOrLoopbackHost("192.175.48.1")).toBe(false);
		});
	});

	describe("private IPv6 ranges", () => {
		it("does NOT match global IPv6", () => {
			expect(isPrivateOrLoopbackHost("2606:4700:4700::1111")).toBe(false);
		});

		it("matches IPv4-mapped IPv6 private and loopback addresses", () => {
			expect(isPrivateOrLoopbackHost("::ffff:10.0.0.1")).toBe(true);
			expect(isPrivateOrLoopbackHost("::ffff:127.0.0.1")).toBe(true);
			expect(isPrivateOrLoopbackHost("::ffff:169.254.169.254")).toBe(true);
			expect(isPrivateOrLoopbackHost("[::ffff:192.168.1.1]")).toBe(true);
			expect(isPrivateOrLoopbackHost("::ffff:7f00:1")).toBe(true);
			expect(isPrivateOrLoopbackHost("::ffff:0a00:1")).toBe(true);
			expect(isPrivateOrLoopbackHost("[::ffff:7f00:1]")).toBe(true);
		});
	});

	describe("non-IP, non-loopback hostnames", () => {
		it("returns false for public domain", () => {
			expect(isPrivateOrLoopbackHost("example.com")).toBe(false);
		});
	});
});

describe("isAllowedOAuthRedirectUri", () => {
	const trustedOrigins = ["https://app.example.com"];

	it("returns false for malformed URI", () => {
		expect(isAllowedOAuthRedirectUri("nope", trustedOrigins)).toBe(false);
	});

	it("returns false when credentials present", () => {
		expect(isAllowedOAuthRedirectUri("https://u:p@app.example.com", trustedOrigins)).toBe(false);
	});

	it("returns false when fragment present", () => {
		expect(isAllowedOAuthRedirectUri("https://app.example.com/cb#x", trustedOrigins)).toBe(false);
	});

	it("rejects http for non-loopback hosts", () => {
		expect(isAllowedOAuthRedirectUri("http://example.com/cb", trustedOrigins)).toBe(false);
	});

	it("rejects non-https/non-http protocols", () => {
		expect(isAllowedOAuthRedirectUri("ftp://example.com/cb", trustedOrigins)).toBe(false);
	});

	it("allows a trusted origin on a private network, for LAN-only self-hosted deployments", () => {
		expect(isAllowedOAuthRedirectUri("https://192.168.1.5/cb", ["https://192.168.1.5"])).toBe(true);
	});

	it("allows public https hosts outside trusted origins, so dynamic client registration works", () => {
		expect(isAllowedOAuthRedirectUri("https://api.example.com/cb", trustedOrigins)).toBe(true);
		expect(isAllowedOAuthRedirectUri("https://claude.ai/api/mcp/auth_callback", trustedOrigins)).toBe(true);
	});
});
