import { describe, expect, it } from "vitest";
import { getSectionItemRows } from "./columns";

describe("getSectionItemRows", () => {
	it("groups items into rows of N columns", () => {
		expect(getSectionItemRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
	});
});
