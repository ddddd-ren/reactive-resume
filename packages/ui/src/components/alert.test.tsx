import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "./alert";

describe("Alert", () => {
	it("announces only errors", () => {
		render(<Alert variant="error">Couldn't reach OpenAI.</Alert>);
		expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach OpenAI.");
	});

	it("keeps static guidance out of the live region", () => {
		render(<Alert variant="info">Job match uses the posting from Lumen Health.</Alert>);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByText("Job match uses the posting from Lumen Health.")).toHaveAttribute("data-slot", "alert");
	});

	it("merges custom className", () => {
		render(<Alert className="my-class">x</Alert>);
		expect(screen.getByText("x")).toHaveClass("my-class");
	});
});

describe("AlertTitle", () => {
	it("renders children", () => {
		render(<AlertTitle>Title</AlertTitle>);
		expect(screen.getByText("Title")).toBeInTheDocument();
	});

	it("applies data-slot='alert-title'", () => {
		render(<AlertTitle>x</AlertTitle>);
		expect(screen.getByText("x")).toHaveAttribute("data-slot", "alert-title");
	});
});

describe("AlertDescription", () => {
	it("renders children", () => {
		render(<AlertDescription>Description text</AlertDescription>);
		expect(screen.getByText("Description text")).toBeInTheDocument();
	});

	it("applies data-slot='alert-description'", () => {
		render(<AlertDescription>x</AlertDescription>);
		expect(screen.getByText("x")).toHaveAttribute("data-slot", "alert-description");
	});
});

describe("Alert composition", () => {});
