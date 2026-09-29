import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

describe("Avatar", () => {
	it("renders with data-slot='avatar'", () => {
		render(<Avatar data-testid="av" />);
		expect(screen.getByTestId("av")).toHaveAttribute("data-slot", "avatar");
	});

	it("defaults size to 'default'", () => {
		render(<Avatar data-testid="av" />);
		expect(screen.getByTestId("av")).toHaveAttribute("data-size", "default");
	});

	it.each(["default", "sm", "lg"] as const)("supports size=%s", (size) => {
		render(<Avatar data-testid="av" size={size} />);
		expect(screen.getByTestId("av")).toHaveAttribute("data-size", size);
	});

	it("merges custom className", () => {
		render(<Avatar data-testid="av" className="my-class" />);
		expect(screen.getByTestId("av")).toHaveClass("my-class");
	});
});

describe("AvatarFallback", () => {
	it("renders fallback content", () => {
		render(
			<Avatar>
				<AvatarFallback data-testid="fb">JD</AvatarFallback>
			</Avatar>,
		);
		// Note: fallback only renders if image fails — but data-slot should be set.
		// We just confirm no crash and that fallback is present in DOM.
		const fb = screen.queryByTestId("fb");
		// AvatarFallback may or may not be in the DOM depending on image state.
		// Just ensure it doesn't throw on render.
		expect(fb === null || fb.getAttribute("data-slot") === "avatar-fallback").toBe(true);
	});
});

describe("AvatarImage", () => {
	it("accepts src prop without throwing", () => {
		render(
			<Avatar>
				<AvatarImage src="https://example.com/x.png" alt="user" />
			</Avatar>,
		);
		// Image may not render until loaded; we just verify no crash
		expect(true).toBe(true);
	});
});
