import { Fragment } from "react";
import { Dialog } from "@reactive-resume/ui/components/dialog";
import { renderDialog } from "./renderers";
import { useDialogStore } from "./store";

export function DialogManager() {
	const { open, activeDialog, openCount, onOpenChange } = useDialogStore();

	const DialogContent = renderDialog(activeDialog);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<Fragment key={openCount}>{DialogContent}</Fragment>
		</Dialog>
	);
}
