import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconButton } from "./icon-button";
import { TooltipProvider } from "./tooltip";

describe("IconButton", () => {
	it("is named by its label, not by the icon's ligature text", () => {
		render(
			<TooltipProvider>
				<IconButton icon="undo" label="Undo" shortcut="⌘Z" />
			</TooltipProvider>,
		);
		expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /undo undo/i })).not.toBeInTheDocument();
	});
});
