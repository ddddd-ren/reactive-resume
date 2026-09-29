import type { PdfWorkerRequest, PdfWorkerResponse } from "./pdf-document";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";

const mocks = vi.hoisted(() => ({ renderHere: vi.fn() }));
vi.mock("@reactive-resume/pdf/browser", () => ({ createResumePdfBlob: mocks.renderHere }));
vi.mock("@/libs/resume/section-title-locale", () => ({ createSectionTitleResolverForLocale: async () => () => "" }));

const pageMap = { pages: [{ width: 595, height: 842 }], nodes: [] };

/** Stands in for the browser's Worker: `reply` decides what it sends back for each request. */
function stubWorker(reply: (request: PdfWorkerRequest, worker: EventTarget) => void) {
	class FakeWorker extends EventTarget {
		postMessage(request: PdfWorkerRequest) {
			queueMicrotask(() => reply(request, this));
		}
		terminate() {}
	}
	vi.stubGlobal("Worker", FakeWorker);
}

const respond = (worker: EventTarget, data: PdfWorkerResponse) =>
	worker.dispatchEvent(new MessageEvent("message", { data }));

beforeEach(() => {
	vi.resetModules();
	mocks.renderHere.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createResumePdfBlob", () => {
	it("renders in the worker and hands back its PDF and page map", async () => {
		const blob = new Blob(["%PDF"], { type: "application/pdf" });
		stubWorker((request, worker) => respond(worker, { id: request.id, blob, pageMap }));
		const { createResumePdfBlob } = await import("./pdf-document");
		const onPageMap = vi.fn();

		await expect(createResumePdfBlob(sampleResumeData, undefined, undefined, { onPageMap })).resolves.toBe(blob);
		expect(onPageMap).toHaveBeenCalledWith(pageMap);
		expect(mocks.renderHere).not.toHaveBeenCalled();
	});

	it("passes on the worker's failure, so callers can fall back to the server's PDF", async () => {
		stubWorker((request, worker) => respond(worker, { id: request.id, error: "Fonts could not be loaded: Inter" }));
		const { createResumePdfBlob } = await import("./pdf-document");

		await expect(createResumePdfBlob(sampleResumeData)).rejects.toThrow("Fonts could not be loaded: Inter");
	});

	it("renders on the main thread when the worker can't start", async () => {
		const blob = new Blob(["%PDF"], { type: "application/pdf" });
		mocks.renderHere.mockImplementation(({ onPageMap }) => {
			onPageMap(pageMap);
			return Promise.resolve(blob);
		});
		stubWorker((_request, worker) => worker.dispatchEvent(new Event("error")));
		const { createResumePdfBlob } = await import("./pdf-document");
		const onPageMap = vi.fn();

		await expect(createResumePdfBlob(sampleResumeData, undefined, undefined, { onPageMap })).resolves.toBe(blob);
		expect(onPageMap).toHaveBeenCalledWith(pageMap);
		// Later renders skip the broken worker.
		await createResumePdfBlob(sampleResumeData);
		expect(mocks.renderHere).toHaveBeenCalledTimes(2);
	});
});
