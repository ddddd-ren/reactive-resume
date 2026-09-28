import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import manifest from "../icons/material-symbols-rounded.json";
import { iconNames } from "../icons/names";
import { Icon } from "./icon";

describe("Icon", () => {
	it("is hidden from assistive tech and translation, so ligature text never becomes a name", () => {
		const { container } = render(<Icon name="search" />);
		const icon = container.querySelector('[data-slot="icon"]');
		expect(icon).toHaveAttribute("aria-hidden", "true");
		expect(icon).toHaveAttribute("translate", "no");
		expect(icon).toHaveTextContent("search");
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
