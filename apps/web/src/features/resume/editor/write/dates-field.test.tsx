// @vitest-environment happy-dom
import type { ResumeDates } from "@reactive-resume/schema/resume/dates";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { DatesField, readTypedDate } from "./dates-field";

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});

describe("readTypedDate", () => {
	it.each([
		["Mar 2022", "2022-03"],
		["03/2022", "2022-03"],
		["2022-03", "2022-03"],
		["2022", "2022"],
		["", null],
		["soon", undefined],
	])("reads %j as %j", (text, expected) => {
		expect(readTypedDate(text, "en-US")).toBe(expected);
	});
});

describe("DatesField", () => {
	const renderField = (dates: ResumeDates, onChange = vi.fn()) => {
		render(
			<I18nProvider i18n={i18n}>
				<DatesField dates={dates} locale="en-US" format="short" onChange={onChange} />
			</I18nProvider>,
		);
		return onChange;
	};

	it("saves a typed date and clears the review note", () => {
		const onChange = renderField({ start: "2016-06", end: "2018", present: false, raw: "Summer 2016 - 2018" });
		expect(screen.getByText(/We read "Summer 2016 - 2018"/)).toBeInTheDocument();

		fireEvent.change(screen.getByRole("textbox", { name: "Start" }), { target: { value: "Jul 2016" } });

		expect(onChange).toHaveBeenLastCalledWith({ start: "2016-07", end: "2018", present: false });
	});

	it("turns the end into Present and back", () => {
		const onChange = renderField({ start: "2020", end: "2022", present: false });
		fireEvent.click(screen.getByRole("switch"));
		expect(onChange).toHaveBeenLastCalledWith({ start: "2020", end: null, present: true });
	});

	it("says how to fix a date it can't read, after blur", () => {
		renderField({ start: null, end: null, present: false });
		const start = screen.getByRole("textbox", { name: "Start" });
		fireEvent.change(start, { target: { value: "someday" } });
		expect(screen.queryByText(/Use a month and year/)).not.toBeInTheDocument();
		fireEvent.blur(start);
		expect(screen.getByText(/Use a month and year/)).toBeInTheDocument();
	});
});
