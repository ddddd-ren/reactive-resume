import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NativeSelect } from "./native-select";

describe("NativeSelect", () => {
	it("keeps the platform select, so keyboard and screen reader behaviour stay native", async () => {
		render(
			<NativeSelect aria-label="Sort" defaultValue="edited">
				<option value="edited">Last edited</option>
				<option value="name">Name</option>
			</NativeSelect>,
		);
		const select = screen.getByRole("combobox", { name: "Sort" });
		await userEvent.selectOptions(select, "name");
		expect(select).toHaveValue("name");
	});
});
