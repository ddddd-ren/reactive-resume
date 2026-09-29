import { describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	SMTP_HOST: undefined as string | undefined,
	SMTP_PORT: 587,
	SMTP_USER: undefined as string | undefined,
	SMTP_PASS: undefined as string | undefined,
	SMTP_FROM: undefined as string | undefined,
	SMTP_SECURE: false,
}));

const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail })));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));
vi.mock("nodemailer", () => ({
	default: { createTransport },
	createTransport,
}));
vi.mock("react-email", () => ({
	render: async (_node: unknown, opts?: { plainText?: boolean }) =>
		opts?.plainText ? "plain text body" : "<p>html body</p>",
}));

const { sendEmail } = await import("./transport");

const fakeReact = { $$typeof: Symbol.for("react.element") } as unknown as React.ReactElement;

const resetEnv = () => {
	envMock.SMTP_HOST = undefined;
	envMock.SMTP_USER = undefined;
	envMock.SMTP_PASS = undefined;
	envMock.SMTP_FROM = undefined;
	createTransport.mockClear();
	sendMail.mockClear();
};

describe("sendEmail", () => {
	it("skips sending and logs when SMTP is not configured (no host)", async () => {
		resetEnv();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		await sendEmail({ to: "a@b.com", subject: "hi", react: fakeReact });

		expect(infoSpy).toHaveBeenCalledWith(
			"SMTP not configured; skipping email send.",
			expect.objectContaining({ to: "a@b.com", subject: "hi" }),
		);
		expect(sendMail).not.toHaveBeenCalled();
		infoSpy.mockRestore();
	});

	it("sends via nodemailer when SMTP is fully configured", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";

		await sendEmail({ to: "a@b.com", subject: "hi", react: fakeReact });

		expect(createTransport).toHaveBeenCalledWith(
			expect.objectContaining({
				host: "smtp.example.com",
				port: 587,
				secure: false,
				auth: { user: "user", pass: "pass" },
			}),
		);
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "a@b.com",
				from: "noreply@example.com",
				subject: "hi",
				text: "plain text body",
			}),
		);
	});

	it("renders react element into both html and plain-text bodies", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";

		await sendEmail({ to: "a@b.com", subject: "hi", react: fakeReact });

		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				html: "<p>html body</p>",
				text: "plain text body",
			}),
		);
	});

	it("does not throw if the SMTP transport itself errors", async () => {
		resetEnv();
		envMock.SMTP_HOST = "smtp.example.com";
		envMock.SMTP_USER = "user";
		envMock.SMTP_PASS = "pass";
		envMock.SMTP_FROM = "noreply@example.com";
		sendMail.mockRejectedValueOnce(new Error("boom"));

		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(sendEmail({ to: "a@b.com", subject: "hi", react: fakeReact })).resolves.toBeUndefined();
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});
