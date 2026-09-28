import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl, SegmentedControlItem } from "./segmented-control";

describe("SegmentedControl", () => {
	it("is a radio group whose options can be chosen by pointer and arrow keys", async () => {
		const onValueChange = vi.fn();
		render(
			<SegmentedControl aria-label="Density" defaultValue="normal" onValueChange={onValueChange}>
				<SegmentedControlItem value="compact">Compact</SegmentedControlItem>
				<SegmentedControlItem value="normal">Normal</SegmentedControlItem>
				<SegmentedControlItem value="roomy">Roomy</SegmentedControlItem>
			</SegmentedControl>,
		);

		expect(screen.getByRole("radiogroup", { name: "Density" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "Normal" })).toHaveAttribute("aria-checked", "true");

		await userEvent.click(screen.getByRole("radio", { name: "Compact" }));
		expect(onValueChange).toHaveBeenLastCalledWith("compact", expect.anything());

		await userEvent.keyboard("{ArrowRight}");
		expect(onValueChange).toHaveBeenLastCalledWith("normal", expect.anything());
	});
});
