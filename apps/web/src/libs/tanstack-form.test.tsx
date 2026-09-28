// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useAppForm } from "./tanstack-form";

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

function TestForm() {
	const form = useAppForm({
		defaultValues: {
			website: { url: "https://example.com", label: "Example", inlineLink: false },
		},
	});

	return (
		<I18nProvider i18n={i18n}>
			<form.AppField
				name="website"
				validators={{ onChange: ({ value }) => (value.url ? undefined : "Website is required") }}
			>
				{(field) => <field.WebsiteField label="Website" hideLabelButton formItemClassName="website-field" />}
			</form.AppField>
		</I18nProvider>
	);
}

describe("registered resume fields", () => {
	it("preserves labels, layout classes, attributes, values, and errors", async () => {
		const user = userEvent.setup();
		const { container } = render(<TestForm />);

		expect(screen.getByText("Website")).toBeInTheDocument();
		expect(container.querySelector(".website-field")).toBeInTheDocument();
		const website = screen.getByRole("textbox", { name: "Website" });
		expect(website).toHaveValue("example.com");
		expect(screen.getByLabelText("Website")).toBe(website);
		expect(container.querySelector(".website-field button")).not.toBeInTheDocument();
		await user.click(screen.getByText("Website", { selector: "label" }));
		expect(website).toHaveFocus();

		await user.clear(website);

		expect(screen.getByText("Website is required")).toBeInTheDocument();
	});
});
