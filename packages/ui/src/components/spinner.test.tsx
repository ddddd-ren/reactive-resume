import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./spinner";

describe("Spinner", () => {
	it("renders with role='status' for screen readers", () => {
		render(<Spinner />);
		expect(screen.getByRole("status")).toBeInTheDocument();
	});

	it("has accessible label 'Loading'", () => {
		render(<Spinner />);
		expect(screen.getByLabelText("Loading")).toBeInTheDocument();
	});

	it("merges custom className", () => {
		render(<Spinner className="my-spinner" />);
		expect(screen.getByRole("status")).toHaveClass("my-spinner");
	});

	it("applies animate-spin by default", () => {
		render(<Spinner />);
		expect(screen.getByRole("status")).toHaveClass("animate-spin");
	});

	it("draws with the current text color, so it inherits from the button or text around it", () => {
		render(<Spinner />);
		expect(screen.getByRole("status")).toHaveClass("border-current");
	});
});
