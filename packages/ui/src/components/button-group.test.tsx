import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonGroup } from "./button-group";

describe("ButtonGroup", () => {
	it("renders a fieldset with data-slot='button-group'", () => {
		render(<ButtonGroup data-testid="g" />);
		const g = screen.getByTestId("g");
		expect(g.tagName).toBe("FIELDSET");
		expect(g).toHaveAttribute("data-slot", "button-group");
	});

	it("respects horizontal orientation (default)", () => {
		render(<ButtonGroup data-testid="g" orientation="horizontal" />);
		expect(screen.getByTestId("g")).toHaveAttribute("data-orientation", "horizontal");
	});

	it("respects vertical orientation", () => {
		render(<ButtonGroup data-testid="g" orientation="vertical" />);
		expect(screen.getByTestId("g")).toHaveAttribute("data-orientation", "vertical");
	});

	it("merges custom className", () => {
		render(<ButtonGroup data-testid="g" className="my-custom" />);
		expect(screen.getByTestId("g")).toHaveClass("my-custom");
	});
});
