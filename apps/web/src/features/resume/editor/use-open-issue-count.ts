import { useDeferredValue, useMemo } from "react";
import { lintResumeForAts } from "@reactive-resume/resume/ats";
import { useResumeData } from "@/features/resume/builder/draft";

/** Open Check issues (errors and warnings from the live checks) for the badge on the Check tab. */
export function useOpenIssueCount(): number {
	const data = useDeferredValue(useResumeData());

	return useMemo(() => {
		if (!data) return 0;
		const { counts } = lintResumeForAts(data);
		return counts.error + counts.warning;
	}, [data]);
}
