import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Kbd } from "./kbd";

describe("Kbd", () => {
	it("renders as a <kbd> element with data-slot='kbd'", () => {
		render(<Kbd data-testid="k">Ctrl</Kbd>);
		const k = screen.getByTestId("k");
		expect(k.tagName).toBe("KBD");
		expect(k).toHaveAttribute("data-slot", "kbd");
	});

	it("renders the key text", () => {
		render(<Kbd>⌘ K</Kbd>);
		expect(screen.getByText("⌘ K")).toBeInTheDocument();
	});

	it("merges custom className", () => {
		render(
			<Kbd data-testid="k" className="my-class">
				x
			</Kbd>,
		);
		expect(screen.getByTestId("k")).toHaveClass("my-class");
	});
});
