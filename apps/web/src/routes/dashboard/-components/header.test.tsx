// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListIcon } from "@phosphor-icons/react";
import { DashboardHeader } from "./header";

const renderHeader = (props: Partial<React.ComponentProps<typeof DashboardHeader>> = {}) =>
	render(<DashboardHeader title="Resumes" icon={ListIcon} {...props} />);

describe("DashboardHeader", () => {
	it("renders the title as an h1", () => {
		renderHeader();
		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading.textContent).toBe("Resumes");
	});

	it("renders the supplied icon as an SVG", () => {
		const { container } = renderHeader();
		expect(container.querySelector("svg")).not.toBeNull();
	});

	it("merges custom className into the wrapper", () => {
		const { container } = renderHeader({ className: "custom-class" });
		const wrapper = container.querySelector(".custom-class");
		expect(wrapper).not.toBeNull();
	});
});
