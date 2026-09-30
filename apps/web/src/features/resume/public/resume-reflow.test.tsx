// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { ResumeReflow } from "./resume-reflow";

it("shows the built-in Summary content in public readable view", () => {
	i18n.load("en", {});
	i18n.activate("en");
	const data = structuredClone(defaultResumeData);
	data.summary.content = "<p>Built-in summary remains visible.</p>";
	data.metadata.layout.pages = [{ fullWidth: true, main: ["summary"], sidebar: [] }];
	render(<ResumeReflow data={data} />);
	expect(screen.getByText("Built-in summary remains visible.")).toBeDefined();
});
