import { Trans } from "@lingui/react/macro";
import { Button } from "@reactive-resume/ui/components/button";
import { Icon } from "@reactive-resume/ui/components/icon";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@reactive-resume/ui/components/sheet";
import { useEditorStore } from "@/features/resume/editor/store";
import { SharingSectionBuilder } from "../-sidebar/right/sections/sharing";
import { StatisticsSectionBuilder } from "../-sidebar/right/sections/statistics";
import { BareSectionChrome } from "../-sidebar/right/shared/section-base";

/** The public link, its statistics and every download format. History joins this sheet in M5. */
export function ShareSheet() {
	const open = useEditorStore((state) => state.shareOpen);
	const setOpen = useEditorStore((state) => state.setShareOpen);
	const setDownloadOpen = useEditorStore((state) => state.setDownloadOpen);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[440px]">
				<SheetHeader>
					<SheetTitle>
						<Trans>Share & export</Trans>
					</SheetTitle>
				</SheetHeader>
				<div className="space-y-8 px-6 pb-8">
					<BareSectionChrome>
						<SharingSectionBuilder />
						<StatisticsSectionBuilder />
					</BareSectionChrome>

					<Button
						variant="secondary"
						className="w-full gap-1.5"
						onClick={() => {
							setOpen(false);
							setDownloadOpen(true);
						}}
					>
						<Icon name="download" />
						<Trans>More download formats…</Trans>
					</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
}
