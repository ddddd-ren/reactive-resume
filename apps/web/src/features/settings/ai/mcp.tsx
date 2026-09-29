import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import { Button } from "@reactive-resume/ui/components/button";
import { SettingsSection } from "../section";

export function McpSection() {
	const address = `${window.location.origin}/mcp`;
	const [copied, setCopied] = useState(false);
	const [, copy] = useCopyToClipboard();

	return (
		<SettingsSection
			title={<Trans>MCP server</Trans>}
			description={
				<Trans>Let AI clients like Claude or Cursor read and edit your resumes, using an API key above.</Trans>
			}
		>
			<div className="flex h-[38px] items-center rounded-lg border border-line-2 bg-raised ps-3 pe-1.5 font-medium font-mono text-[13px]">
				<span className="min-w-0 flex-1 truncate">{address}</span>
				<Button
					size="sm"
					variant="secondary"
					aria-live="polite"
					onClick={async () => {
						await copy(address);
						setCopied(true);
						setTimeout(() => setCopied(false), 2000);
					}}
				>
					{copied ? <Trans>Copied</Trans> : <Trans>Copy</Trans>}
				</Button>
			</div>
			<a
				href="https://docs.rxresu.me/guides/using-the-mcp-server"
				target="_blank"
				rel="noopener noreferrer"
				className="w-fit text-ink-2 text-sm underline underline-offset-2"
			>
				<Trans>Setup guide</Trans>
			</a>
		</SettingsSection>
	);
}
