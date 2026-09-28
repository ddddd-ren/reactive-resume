// @vitest-environment happy-dom

import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";

type PdfViewerProps = {
	className?: string;
	data: ResumeData;
	publicResume?: { username: string; slug: string };
};

const publicResumeMock = vi.hoisted(() => ({
	flags: { disableSignups: false },
	onDownloadPDF: vi.fn(),
	PdfViewer: vi.fn<(_props: PdfViewerProps) => ReactNode>(() => null),
	useResumeExport: vi.fn(),
	resume: undefined as
		| undefined
		| {
				data: ResumeData;
				name: string;
				slug: string;
				showDownloadButtons?: boolean;
		  },
}));

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: publicResumeMock.resume }) }));
vi.mock("@tanstack/react-router", () => ({
	getRouteApi: () => ({
		useParams: () => ({ username: "amruth", slug: "sample" }),
		useRouteContext: () => ({ flags: publicResumeMock.flags }),
	}),
}));
vi.mock("./pdf-viewer", () => ({ PdfViewer: publicResumeMock.PdfViewer }));
vi.mock("./resume-reflow", () => ({ ResumeReflow: () => <div data-testid="reflow" /> }));
const breakpoint = vi.hoisted(() => ({ value: "desktop" }));
vi.mock("@reactive-resume/ui/hooks/use-breakpoint", () => ({ useBreakpoint: () => breakpoint.value }));
vi.mock("@/libs/orpc/client", () => ({
	orpc: { resume: { getBySlug: { queryOptions: () => ({ query: "resume" }) } } },
}));
vi.mock("@/features/resume/export/use-resume-export", () => ({
	useResumeExport: publicResumeMock.useResumeExport,
}));

const { PublicResumeRoute } = await import("./public-resume");

beforeAll(() => i18n.loadAndActivate({ locale: "en", messages: {} }));

beforeEach(() => {
	breakpoint.value = "desktop";
	publicResumeMock.flags.disableSignups = false;
	publicResumeMock.resume = { data: sampleResumeData, name: "Sample Resume", slug: "sample" };
	publicResumeMock.PdfViewer.mockClear();
	publicResumeMock.onDownloadPDF.mockClear();
	publicResumeMock.useResumeExport.mockReset();
	publicResumeMock.useResumeExport.mockReturnValue({
		onDownloadPDF: publicResumeMock.onDownloadPDF,
		isExporting: false,
	});
	publicResumeMock.PdfViewer.mockImplementation(({ className }) => (
		<div className={className} data-testid="pdf-viewer" />
	));
});

const renderPublicResumeRoute = () =>
	render(
		<I18nProvider i18n={i18n}>
			<PublicResumeRoute />
		</I18nProvider>,
	);

describe("PublicResumeRoute", () => {
	it("links the footer credit home when registration is enabled", () => {
		renderPublicResumeRoute();

		expect(screen.getByRole("link", { name: /Made with Reactive Resume/ })).toHaveAttribute("href", "/");
	});

	it("keeps the credit as plain text when registration is disabled", () => {
		publicResumeMock.flags.disableSignups = true;
		renderPublicResumeRoute();

		expect(screen.queryByRole("link", { name: /Made with Reactive Resume/ })).not.toBeInTheDocument();
		expect(screen.getByText(/Made with Reactive Resume/)).toBeInTheDocument();
		expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
	});

	it("leads with the owner's name and downloads from the bar", () => {
		renderPublicResumeRoute();
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(sampleResumeData.basics.name);
		expect(screen.getByRole("button", { name: /Copy link/ })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
		expect(publicResumeMock.onDownloadPDF).toHaveBeenCalledTimes(1);
	});

	it("hides Download when downloads are off, keeps the page, and blocks printing with a note", () => {
		publicResumeMock.resume = { data: sampleResumeData, name: "Sample", slug: "sample", showDownloadButtons: false };
		renderPublicResumeRoute();
		expect(screen.queryByRole("button", { name: "Download PDF" })).not.toBeInTheDocument();
		expect(screen.getByTestId("pdf-viewer")).toBeVisible();
		expect(screen.getByText("Printing is turned off for this resume.")).toHaveClass("print:block");
	});

	it("reflows on phones, with Download and Share pinned", () => {
		breakpoint.value = "mobile";
		renderPublicResumeRoute();
		expect(screen.getByTestId("reflow")).toBeInTheDocument();
		expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
	});

	it("passes exposed source data directly to the browser viewer and export fallback", () => {
		renderPublicResumeRoute();

		expect(publicResumeMock.PdfViewer).toHaveBeenCalledWith(
			expect.objectContaining({
				data: sampleResumeData,
				publicResume: { username: "amruth", slug: "sample" },
			}),
			undefined,
		);
		expect(publicResumeMock.useResumeExport).toHaveBeenCalledWith(publicResumeMock.resume, {
			publicResumePdf: { publicResume: { username: "amruth", slug: "sample" } },
		});
	});

	it("lets the public resume page grow to the full PDF length", () => {
		renderPublicResumeRoute();

		const viewerFrame = screen.getByTestId("pdf-viewer").parentElement;
		expect(viewerFrame).not.toHaveClass("min-h-0", "overflow-hidden", "h-svh", "max-h-svh");
	});
});

describe("PublicResumePage at root", () => {
	it("renders supplied identity and links to dashboard without slug route hooks", async () => {
		const { PublicResumePage } = await import("./public-resume");
		render(
			<I18nProvider i18n={i18n}>
				<PublicResumePage
					resume={publicResumeMock.resume}
					username="root-owner"
					slug="renamed"
					flags={publicResumeMock.flags}
					isRoot
				/>
			</I18nProvider>,
		);
		expect(screen.getByRole("link", { name: /Made with Reactive Resume/ })).toHaveAttribute("href", "/dashboard");
		expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(sampleResumeData.basics.name);
		expect(publicResumeMock.useResumeExport).toHaveBeenCalledWith(publicResumeMock.resume, {
			publicResumePdf: { publicResume: { username: "root-owner", slug: "renamed" } },
		});
	});
});
