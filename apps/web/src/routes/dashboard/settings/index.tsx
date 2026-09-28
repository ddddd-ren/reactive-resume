import { createFileRoute, redirect } from "@tanstack/react-router";
import { SettingsRoot } from "@/features/settings/root";

// Phones (below 640px) get the three-row root; wider screens open Account, with the pages beside it.
export const Route = createFileRoute("/dashboard/settings/")({
	beforeLoad: () => {
		if (window.matchMedia("(min-width: 640px)").matches)
			throw redirect({ to: "/dashboard/settings/account", replace: true });
	},
	component: SettingsRoot,
});
