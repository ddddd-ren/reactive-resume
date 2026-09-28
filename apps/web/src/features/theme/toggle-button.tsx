import { t } from "@lingui/core/macro";
import { startTransition, useCallback } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { Icon } from "@reactive-resume/ui/components/icon";
import { useTheme } from "./provider";

export function ThemeToggleButton(props: React.ComponentProps<typeof Button>) {
	const { resolvedTheme, toggleTheme } = useTheme();

	const onToggleTheme = useCallback(() => {
		startTransition(() => {
			toggleTheme();
		});
	}, [toggleTheme]);

	const ariaLabel = resolvedTheme === "dark" ? t`Switch to light theme` : t`Switch to dark theme`;

	return (
		<Button size="icon" variant="ghost" onClick={onToggleTheme} aria-label={ariaLabel} {...props}>
			<Icon name={resolvedTheme === "dark" ? "dark_mode" : "light_mode"} />
		</Button>
	);
}
