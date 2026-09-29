// @vitest-environment happy-dom
import type { PdfAtsReport, PdfFinding } from "@reactive-resume/resume/ats-pdf";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { parseResumeData } from "@reactive-resume/schema/resume/data";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { useEditorStore } from "../store";
import { CheckPageLayer } from "./page-layer";

const current = vi.hoisted(() => ({ data: undefined as unknown }));

vi.mock("./use-check", () => ({
	useCheck: () => ({ data: current.data, report: { findings: [] }, issues: [] }),
}));
vi.mock("./actions", () => ({ scrollToIssue: vi.fn(), useCheckActions: () => ({ fix: vi.fn() }) }));

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});

afterEach(() => {
	cleanup();
	useEditorStore.getState().reset();
});

const finding = (page: number): PdfFinding => ({
	code: "REVERSED_DATE_RANGE",
	severity: "warning",
	category: "dates",
	evidence: { snippet: "2024 – 2019", page, box: { x: 60, y: 200, width: 120, height: 12 } },
});

const report = (findings: PdfFinding[]) => ({ findings, tips: [] }) as unknown as PdfAtsReport;

const renderLayer = (pageIndex = 0) =>
	render(
		<I18nProvider i18n={i18n}>
			<div style={{ position: "relative", width: 600, height: 800 }}>
				<CheckPageLayer pageIndex={pageIndex} pageMap={{ pages: [{ width: 600, height: 800 }], nodes: [] }} />
			</div>
		</I18nProvider>,
	);

describe("CheckPageLayer: the deep check's findings", () => {
	it("pins a finding where the exported PDF shows it, and opens the report from the pin", () => {
		const data: ResumeData = parseResumeData(structuredClone(sampleResumeData));
		current.data = data;
		useEditorStore.getState().setExportCheck({ report: report([finding(1)]), data });
		renderLayer();

		const pin = screen.getByRole("button", { name: /^Exported PDF: / });
		expect(pin.style.top).toContain(`${(200 / 800) * 100}%`);

		fireEvent.click(pin);
		expect(useEditorStore.getState().exportReportOpen).toBe(true);
	});

	it("pins nothing on other pages, or once the resume has changed since the check ran", () => {
		const data: ResumeData = parseResumeData(structuredClone(sampleResumeData));
		current.data = data;
		useEditorStore.getState().setExportCheck({ report: report([finding(2)]), data });
		renderLayer(0);
		expect(screen.queryByRole("button", { name: /^Exported PDF: / })).toBeNull();
		cleanup();

		useEditorStore.getState().setExportCheck({ report: report([finding(1)]), data });
		current.data = structuredClone(data);
		renderLayer(0);
		expect(screen.queryByRole("button", { name: /^Exported PDF: / })).toBeNull();
	});
});
