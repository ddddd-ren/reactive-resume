import { Trans } from "@lingui/react/macro";
import { Alert, AlertDescription, AlertTitle } from "@reactive-resume/ui/components/alert";
import { Button } from "@reactive-resume/ui/components/button";
import { Icon } from "@reactive-resume/ui/components/icon";

export type LegacyStylesheetBannerProps = {
	disabled: boolean;
	onActivate(): void;
};

export function LegacyStylesheetBanner({ disabled, onActivate }: LegacyStylesheetBannerProps) {
	return (
		<Alert>
			<Icon name="info" size={16} />
			<AlertTitle>
				<Trans>Converted stylesheet draft</Trans>
			</AlertTitle>
			<AlertDescription className="space-y-3">
				<p>
					<Trans>Your legacy styles stay active until you activate this Semantic CSS draft.</Trans>
				</p>
				<Button type="button" size="sm" disabled={disabled} onClick={onActivate}>
					<Trans>Activate Semantic CSS</Trans>
					<Icon name="arrow_forward" size={16} />
				</Button>
			</AlertDescription>
		</Alert>
	);
}
