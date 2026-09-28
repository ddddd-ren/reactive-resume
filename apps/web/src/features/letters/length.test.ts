import { describe, expect, it } from "vitest";
import { countWords, letterLength } from "./length";

describe("letter length", () => {
	it("counts the words of the body's text, not its markup", () => {
		expect(countWords("")).toBe(0);
		expect(countWords("<p></p><p>&nbsp;</p>")).toBe(0);
		expect(countWords("<p>I'm applying for the <strong>Senior</strong> role.</p><p>Thanks,<br />Jordan</p>")).toBe(8);
	});

	it("is short below 180 words, comfortable up to 320 and long after", () => {
		expect(letterLength(0)).toBe("empty");
		expect(letterLength(179)).toBe("short");
		expect(letterLength(180)).toBe("comfortable");
		expect(letterLength(320)).toBe("comfortable");
		expect(letterLength(321)).toBe("long");
	});
});
