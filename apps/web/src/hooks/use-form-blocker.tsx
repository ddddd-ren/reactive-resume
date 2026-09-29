import type { AnyFormApi } from "@tanstack/react-form";
import { t } from "@lingui/core/macro";
import { useStore } from "@tanstack/react-form";
import { useEffect, useRef } from "react";
import { useDialogStore } from "@/dialogs/store";
import { useConfirm } from "@/hooks/use-confirm";

interface UseFormBlockerOptions {
	shouldBlock?: () => boolean;
}

export function useFormBlocker(form: Pick<AnyFormApi, "store">, options?: UseFormBlockerOptions) {
	const confirm = useConfirm();
	const closeDialog = useDialogStore((state) => state.closeDialog);
	const setOnBeforeClose = useDialogStore((state) => state.setOnBeforeClose);

	const isDirty = useStore(form.store, (state) => state.isDirty);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const shouldBlockRef = useRef(options?.shouldBlock);

	useEffect(() => {
		shouldBlockRef.current = options?.shouldBlock;
	}, [options?.shouldBlock]);

	const shouldBlock = () => {
		if (shouldBlockRef.current) return shouldBlockRef.current();
		return isDirty && !isSubmitting;
	};

	const confirmClose = () => {
		if (!shouldBlock()) return true;

		return confirm(t`Are you sure you want to close this dialog?`, {
			description: t`You have unsaved changes that will be lost.`,
			confirmText: t`Leave`,
			cancelText: t`Stay`,
		});
	};

	const requestClose = async () => {
		const confirmed = await confirmClose();
		if (!confirmed) return;

		closeDialog();
	};

	useEffect(() => {
		setOnBeforeClose(confirmClose);
		return () => setOnBeforeClose(null);
	}, [confirmClose, setOnBeforeClose]);

	return { requestClose };
}
