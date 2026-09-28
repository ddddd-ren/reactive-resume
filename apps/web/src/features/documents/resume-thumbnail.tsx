import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { RefObject } from "react";
import type { ResumeThumbnailSize } from "@/features/resume/preview/resume-thumbnail.shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@reactive-resume/ui/components/icon";
import { createResumePdfBlob } from "@/features/resume/export/pdf-document";
import { createPdfFirstPageImageUrl, releaseThumbnailUrls } from "@/features/resume/preview/pdf-thumbnail";
import { getResumeThumbnailCacheKey, getResumeThumbnailSize } from "@/features/resume/preview/resume-thumbnail.shared";
import { orpc } from "@/libs/orpc/client";

type ThumbnailState = { status: "error" | "idle" | "loading" } | { status: "ready"; url: string };

type ResumeThumbnailProps = {
	resume: { id: string; updatedAt: Date };
};

const throwIfAborted = (signal: AbortSignal) => {
	if (signal.aborted) throw new DOMException("Thumbnail generation aborted.", "AbortError");
};

const THUMBNAIL_CACHE_TIME = 5 * 60 * 1000;
const createResumeThumbnailUrl = async (data: ResumeData, size: ResumeThumbnailSize, signal: AbortSignal) => {
	const pdf = await createResumePdfBlob(data);
	throwIfAborted(signal);

	const url = await createPdfFirstPageImageUrl(pdf, size, signal);

	if (signal.aborted) {
		URL.revokeObjectURL(url);
		throwIfAborted(signal);
	}

	return url;
};

function useThumbnailSize(containerRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
	const [size, setSize] = useState<ResumeThumbnailSize>({ width: 0, height: 0 });

	useEffect(() => {
		const container = containerRef.current;
		if (!enabled || !container) return;
		let measured = { width: container.clientWidth, height: container.clientHeight };
		let timeout: ReturnType<typeof setTimeout>;
		let media: MediaQueryList;
		const syncSize = () => {
			clearTimeout(timeout);
			// Coalesce sidebar animations and continuous viewport resizing.
			timeout = setTimeout(() => {
				if (measured.width <= 0 || measured.height <= 0) return;
				const next = getResumeThumbnailSize(measured, window.devicePixelRatio);
				setSize((current) => {
					if (current.width >= next.width && current.height >= next.height) return current;
					return { width: Math.max(current.width, next.width), height: Math.max(current.height, next.height) };
				});
			}, 150);
		};
		const watchPixelRatio = () => {
			media?.removeEventListener("change", watchPixelRatio);
			media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
			media.addEventListener("change", watchPixelRatio);
			syncSize();
		};
		const observer = new ResizeObserver((entries) => {
			measured = entries?.[0]?.contentRect ?? { width: container.clientWidth, height: container.clientHeight };
			syncSize();
		});
		observer.observe(container);
		watchPixelRatio();

		return () => {
			clearTimeout(timeout);
			observer.disconnect();
			media.removeEventListener("change", watchPixelRatio);
		};
	}, [containerRef, enabled]);

	return size;
}

function useResumeThumbnail(
	data: ResumeData | undefined,
	cacheKey: string,
	size: ResumeThumbnailSize,
	enabled: boolean,
): ThumbnailState {
	const queryClient = useQueryClient();

	useEffect(() => {
		releaseThumbnailUrls(queryClient, "resume-thumbnail");
	}, [queryClient]);

	useEffect(() => {
		const queryCache = queryClient.getQueryCache();
		const resumePrefix = `${cacheKey.slice(0, cacheKey.lastIndexOf(":"))}:`;

		for (const query of queryCache.findAll({ queryKey: ["resume-thumbnail"] })) {
			const queryCacheKey = query.queryKey[1];
			if (typeof queryCacheKey === "string" && queryCacheKey.startsWith(resumePrefix) && queryCacheKey !== cacheKey) {
				queryCache.remove(query);
			}
		}
	}, [cacheKey, queryClient]);

	const {
		data: thumbnailData,
		error: thumbnailError,
		isError: thumbnailIsError,
	} = useQuery({
		queryKey: ["resume-thumbnail", cacheKey, size.width, size.height],
		queryFn: ({ signal }) => {
			if (!data) throw new Error("Resume data is required to generate a thumbnail.");
			return createResumeThumbnailUrl(data, size, signal);
		},
		enabled: Boolean(enabled && data && size.width && size.height),
		placeholderData: (previous, query) => (query?.queryKey[1] === cacheKey ? previous : undefined),
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: THUMBNAIL_CACHE_TIME,
	});
	const previousThumbnailData = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (thumbnailError) console.error("Failed to generate resume thumbnail", thumbnailError);
	}, [thumbnailError]);

	useEffect(() => {
		const previousUrl = previousThumbnailData.current;
		if (previousUrl && previousUrl !== thumbnailData) {
			const previousQuery = queryClient
				.getQueryCache()
				.findAll({ queryKey: ["resume-thumbnail"] })
				.find((query) => query.state.data === previousUrl);
			if (previousQuery) queryClient.getQueryCache().remove(previousQuery);
		}
		previousThumbnailData.current = thumbnailData;
	}, [queryClient, thumbnailData]);

	if (!data || !cacheKey) return { status: "idle" };
	if (thumbnailIsError) return { status: "error" };
	if (thumbnailData) return { status: "ready", url: thumbnailData };

	return { status: "loading" };
}

/** The resume's first page, rendered once it scrolls near view and cached until it changes. */
export function ResumeThumbnail({ resume }: ResumeThumbnailProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const isInView = useInView(containerRef, { amount: 0.1, margin: "240px" });
	const size = useThumbnailSize(containerRef, isInView);
	const { data: resumeData, isError: resumeIsError } = useQuery({
		...orpc.resume.getById.queryOptions({ input: { id: resume.id } }),
		enabled: isInView,
	});
	const thumbnail = useResumeThumbnail(
		resumeData?.data,
		getResumeThumbnailCacheKey(resume.id, resume.updatedAt),
		size,
		isInView,
	);
	const hasFailed = resumeIsError || thumbnail.status === "error";

	return (
		<div ref={containerRef} className="relative size-full overflow-hidden bg-white">
			{thumbnail.status === "ready" ? (
				<div
					aria-hidden
					className="absolute inset-0 bg-center bg-contain bg-white bg-no-repeat"
					style={{ backgroundImage: `url(${thumbnail.url})` }}
				/>
			) : hasFailed ? (
				<div className="absolute inset-0 flex items-center justify-center text-ink-3">
					<Icon name="description" size={24} />
				</div>
			) : (
				// Loading: a sunken placeholder at the page's real size, so nothing jumps.
				<div className="absolute inset-0 animate-pulse bg-sunken" />
			)}
		</div>
	);
}
