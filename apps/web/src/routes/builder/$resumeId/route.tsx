import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import z from "zod";
import { useBuilderResumeUpdateSubscription, useResumeCleanup, useResumeStore } from "@/features/resume/builder/draft";
import { EDITOR_MODES } from "@/features/resume/editor/store";
import { orpc } from "@/libs/orpc/client";
import { createNoindexFollowMeta } from "@/libs/seo";
import { EditorShell } from "./-components/editor-shell";

const searchSchema = z.object({
	// Write is the default and stays out of the URL.
	mode: z.enum(EDITOR_MODES).optional().catch(undefined),
});

export const Route = createFileRoute("/builder/$resumeId")({
	component: RouteComponent,
	validateSearch: searchSchema,
	beforeLoad: ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
		return { session: context.session };
	},
	loader: async ({ params, context }) => {
		const resume = await context.queryClient.ensureQueryData(
			orpc.resume.getById.queryOptions({ input: { id: params.resumeId } }),
		);

		return { name: resume.name };
	},
	head: ({ loaderData }) => ({
		meta: loaderData
			? [{ title: `${loaderData.name} - Reactive Resume` }, createNoindexFollowMeta()]
			: [createNoindexFollowMeta()],
	}),
});

function RouteComponent() {
	const { resumeId } = Route.useParams();
	const { data: resume } = useSuspenseQuery(orpc.resume.getById.queryOptions({ input: { id: resumeId } }));
	const initializeResumeStore = useResumeStore((state) => state.initialize);
	const mergeResumeMetadata = useResumeStore((state) => state.mergeResumeMetadata);
	const isReady = useResumeStore((state) => state.isReady);
	const initializedResumeId = useResumeStore((state) => state.resumeId);
	const isInitialized = isReady && initializedResumeId === resumeId;

	useResumeCleanup();
	useBuilderResumeUpdateSubscription();

	useEffect(() => {
		if (isInitialized) return;
		initializeResumeStore(resume);
	}, [initializeResumeStore, isInitialized, resume]);

	useEffect(() => {
		mergeResumeMetadata(resume);
	}, [
		mergeResumeMetadata,
		resume.id,
		resume.name,
		resume.slug,
		resume.tags,
		resume.isLocked,
		resume.isPublic,
		resume.showDownloadButtons,
		resume.hasPassword,
		resume.updatedAt,
		resume,
	]);

	if (!isInitialized) return null;

	return <EditorShell />;
}
