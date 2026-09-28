import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import manifest from "../icons/material-symbols-rounded.json";
import { iconNames } from "../icons/names";
import { Icon } from "./icon";

describe("Icon", () => {
	it("draws the glyph from data-icon, so its name is neither text nor an accessible name", () => {
		const { container } = render(
			<button type="button">
				<Icon name="search" />
				Search
			</button>,
		);
		const icon = container.querySelector('[data-slot="icon"]');
		expect(icon).toHaveAttribute("aria-hidden", "true");
		expect(icon).toHaveAttribute("data-icon", "search");
		expect(icon).toBeEmptyDOMElement();
		expect(container.querySelector("button")).toHaveTextContent(/^Search$/);
	});

	it("uses the filled glyph only when asked", () => {
		const { container } = render(<Icon name="description" filled />);
		expect(container.querySelector('[data-slot="icon"]')?.getAttribute("style")).toContain('"FILL" 1');
	});

	it("mirrors directional icons in right-to-left layouts", () => {
		const { container } = render(
			<>
				<Icon name="arrow_back" />
				<Icon name="search" />
			</>,
		);
		const [back, search] = container.querySelectorAll('[data-slot="icon"]');
		expect(back).toHaveClass("rtl:-scale-x-100");
		expect(search).not.toHaveClass("rtl:-scale-x-100");
	});
});

describe("Material Symbols subset", () => {
	it("was built from the current icon list (run `pnpm icons:build` after editing it)", () => {
		expect(manifest.names).toEqual([...iconNames].sort());
	});
});
