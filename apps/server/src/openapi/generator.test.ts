import { describe, expect, it, vi } from "vitest";
import { createResumeDataJsonSchema } from "@reactive-resume/schema/resume/json-schema";

// Spec generation reads procedure contracts without executing authentication. Keep the
// provider's resource seeding out of this unit test; real OAuth initialization is covered
// by the opt-in PostgreSQL integration suite after migrations run.
vi.mock("@reactive-resume/auth/config", () => ({ auth: {}, verifyOAuthToken: vi.fn() }));

type GeneratedSpecView = {
	components?: { schemas?: Record<string, unknown> };
	paths?: Record<
		string,
		Record<
			string,
			{
				requestBody?: {
					content?: Record<string, { schema?: unknown }>;
				};
			}
		>
	>;
};

// Building the spec walks every router and resume JSON schema, which costs seconds. It is
// deterministic and every test here only reads it, so generate it once for the whole file —
// regenerating per test made the first case time out under a loaded machine.
let specPromise: ReturnType<typeof generateOnce> | undefined;

async function generateOnce() {
	const { generateOpenApiSpec } = await import("./generator");
	return generateOpenApiSpec({
		appUrl: "https://rxresu.me",
		version: "9.8.7",
	});
}

function generateSpec() {
	specPromise ??= generateOnce();
	return specPromise;
}

function getRequestSchema(spec: GeneratedSpecView, path: string, method: string) {
	return spec.paths?.[path]?.[method]?.requestBody?.content?.["application/json"]?.schema;
}

function containsImpossibleSchema(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(containsImpossibleSchema);
	if (typeof value !== "object" || value === null) return false;
	const object = value as Record<string, unknown>;
	const negated = object.not;
	if (typeof negated === "object" && negated !== null && Object.keys(negated).length === 0) {
		return true;
	}
	return Object.values(object).some(containsImpossibleSchema);
}

function findImpossibleRequestSchemas(spec: GeneratedSpecView) {
	const impossibleRequests: string[] = [];
	for (const [path, operations] of Object.entries(spec.paths ?? {})) {
		for (const [method, operation] of Object.entries(operations)) {
			for (const [mediaType, content] of Object.entries(operation.requestBody?.content ?? {})) {
				if (containsImpossibleSchema(content.schema)) {
					impossibleRequests.push(`${method.toUpperCase()} ${path} (${mediaType})`);
				}
			}
		}
	}
	return impossibleRequests;
}

describe("generateOpenApiSpec", () => {
	it("keeps instance homepage resolution out of the public API", async () => {
		const spec = (await generateSpec()) as GeneratedSpecView;
		expect(spec.paths).not.toHaveProperty("/resume/getRoot");
	}, 15_000);
	it("uses the canonical input-side ResumeData schema in update requests", async () => {
		const spec = (await generateSpec()) as GeneratedSpecView;
		const { $schema: _dialect, ...canonicalInputSchema } = createResumeDataJsonSchema();

		expect(spec.components?.schemas?.ResumeData).toEqual(canonicalInputSchema);
		expect(getRequestSchema(spec, "/resumes/{id}", "put")).toMatchObject({
			properties: {
				data: { $ref: "#/components/schemas/ResumeData" },
			},
		});
	}, 15_000);

	it("does not publish impossible request schemas", async () => {
		const spec = (await generateSpec()) as GeneratedSpecView;

		expect(findImpossibleRequestSchemas(spec)).toEqual([]);
	});
});
