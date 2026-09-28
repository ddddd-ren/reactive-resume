import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useId, useRef, useState } from "react";
import { useCopyToClipboard, useDebounceValue } from "usehooks-ts";
import { Button, buttonVariants } from "@reactive-resume/ui/components/button";
import { Icon } from "@reactive-resume/ui/components/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@reactive-resume/ui/components/popover";
import { Separator } from "@reactive-resume/ui/components/separator";
import { SwitchRow } from "@reactive-resume/ui/components/switch";
import { toast } from "@reactive-resume/ui/components/toast";
import { cn } from "@reactive-resume/utils/style";
import { useCurrentResume, usePatchResume } from "@/features/resume/builder/draft";
import { ResumePasswordDialog } from "@/features/resume/builder/password-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/libs/auth/client";
import { orpc } from "@/libs/orpc/client";
import { formatTimeSince, summarizeViews } from "./format";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COPIED_MS = 2000;

const errorMessage = (error: unknown) =>
	error instanceof ORPCError ? error.message : t`Something went wrong. Please try again.`;

/**
 * Link: the public switch, the address with its live check, copy, downloads for visitors, open, QR code and
 * the password, then views and downloads. Private is the default; turning the link off keeps the address.
 */
export function LinkTab() {
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const { data: session } = authClient.useSession();
	const { mutateAsync: updateResume, isPending } = useMutation(orpc.resume.update.mutationOptions());
	const isPublic = resume.isPublic ?? false;
	const url = `${window.location.origin}/${session?.user.username ?? ""}/${resume.slug}`;

	const setPublic = async (checked: boolean) => {
		try {
			const updated = await updateResume({ id: resume.id, isPublic: checked });
			patchResume((draft) => {
				draft.isPublic = updated.isPublic;
			});
			toast.add({ description: checked ? t`Link is live` : t`Link turned off. The address is kept` });
		} catch (error) {
			toast.add({ type: "error", description: errorMessage(error) });
		}
	};

	const setVisitorDownloads = async (checked: boolean) => {
		try {
			const updated = await updateResume({ id: resume.id, showDownloadButtons: checked });
			patchResume((draft) => {
				draft.showDownloadButtons = updated.showDownloadButtons;
			});
		} catch (error) {
			toast.add({ type: "error", description: errorMessage(error) });
		}
	};

	return (
		<div className="grid gap-[18px]">
			<SwitchRow
				checked={isPublic}
				disabled={isPending || resume.isLocked}
				onCheckedChange={(checked) => void setPublic(checked)}
				label={<span className="font-semibold">{t`Public link`}</span>}
				description={
					isPublic
						? t`On. Anyone with the link can view. It isn't listed or indexed by search engines.`
						: t`Off. Only you can see this resume.`
				}
				className="items-start rounded-xl border border-line p-3.5 transition-colors duration-standard data-checked:border-accent data-checked:bg-accent-soft"
			/>

			<AddressField url={url} username={session?.user.username ?? ""} />

			{isPublic && (
				<div className="grid gap-3">
					<SwitchRow
						checked={resume.showDownloadButtons !== false}
						disabled={isPending || resume.isLocked}
						onCheckedChange={(checked) => void setVisitorDownloads(checked)}
						label={t`Visitors can download the PDF`}
						className="py-0"
					/>
					<PasswordRow />
					<div className="flex flex-wrap gap-2">
						<a
							href={url}
							target="_blank"
							rel="noopener"
							className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1.5" })}
						>
							<Icon name="open_in_new" size={18} />
							<Trans>Open public page</Trans>
						</a>
						<QrCodeButton url={url} />
					</div>
				</div>
			)}

			<Separator />
			<ViewsAndDownloads isPublic={isPublic} />
		</div>
	);
}

type AddressFieldProps = { url: string; username: string };

/** The address, checked as you type (300 ms). The old one stays live until the new one is valid and saved. */
function AddressField({ url, username }: AddressFieldProps) {
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const id = useId();
	const isPublic = resume.isPublic ?? false;
	const [slug, setSlug] = useState(resume.slug);
	const [debouncedSlug] = useDebounceValue(slug, 300);
	const [copied, setCopied] = useState(false);
	const [, copyToClipboard] = useCopyToClipboard();
	const copiedTimer = useRef<number>(undefined);
	const { mutateAsync: updateResume } = useMutation(orpc.resume.update.mutationOptions());

	const changed = slug !== resume.slug;
	const wellFormed = SLUG_PATTERN.test(slug);
	const check = useQuery({
		...orpc.resume.checkSlug.queryOptions({ input: { resumeId: resume.id, slug: debouncedSlug } }),
		enabled: isPublic && changed && wellFormed && debouncedSlug === slug,
	});
	const result = debouncedSlug === slug ? check.data : undefined;

	// Save as soon as a new address checks out; until then the current one keeps working.
	const saving = useRef<string | null>(null);
	useEffect(() => {
		if (result?.status !== "available" || saving.current === slug) return;
		saving.current = slug;
		updateResume({ id: resume.id, slug })
			.then((updated) =>
				patchResume((draft) => {
					draft.slug = updated.slug;
				}),
			)
			.catch((error: unknown) => toast.add({ type: "error", description: errorMessage(error) }))
			.finally(() => {
				saving.current = null;
			});
	}, [result?.status, slug, resume.id, updateResume, patchResume]);

	// A save here, another tab or a restore can change the address; the field follows it.
	useEffect(() => setSlug(resume.slug), [resume.slug]);

	const invalid = isPublic && (!slug || !wellFormed || result?.status === "taken");
	const message = !isPublic
		? t`Turn on the link to choose an address.`
		: !slug
			? t`Add an address.`
			: !wellFormed
				? t`Use lowercase letters, numbers and single dashes.`
				: !changed
					? t`Live at ${url.replace(/^https?:\/\//, "")}`
					: result?.status === "taken"
						? null
						: result?.status === "available"
							? t`Available · ${window.location.host}/${username}/${slug}`
							: t`Checking…`;

	const copy = async () => {
		await copyToClipboard(url);
		setCopied(true);
		window.clearTimeout(copiedTimer.current);
		copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
		toast.add({ description: t`Link copied` });
	};

	const canShare = typeof navigator.share === "function";

	return (
		<div className={cn("grid gap-1.5 transition-opacity duration-standard", !isPublic && "opacity-45")}>
			<label htmlFor={id} className="font-medium text-ink-2 text-xs">
				<Trans>Address</Trans>
			</label>
			<div className="flex gap-1.5">
				<div
					className={cn(
						"flex h-[38px] min-w-0 flex-1 items-center overflow-hidden rounded-lg border bg-raised transition-colors duration-quick focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft",
						invalid ? "border-danger" : "border-line-2",
					)}
				>
					{/* A long host or username truncates, so the part being edited stays visible. */}
					<span className="max-w-[55%] truncate ps-2.5 font-medium font-mono text-[13px] text-ink-3" dir="ltr">
						{window.location.host}/{username}/
					</span>
					<input
						id={id}
						value={slug}
						disabled={!isPublic || resume.isLocked}
						spellCheck={false}
						aria-invalid={invalid}
						aria-describedby={`${id}-message`}
						onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"))}
						className="h-full min-w-0 flex-1 bg-transparent pe-1.5 font-medium font-mono text-[13px] text-ink outline-none"
					/>
					{isPublic && slug && (
						<Icon
							name={invalid ? "error" : "check_circle"}
							size={18}
							className={cn("me-2.5", invalid ? "text-danger-text" : "text-accent-text")}
						/>
					)}
				</div>
				<Button variant="secondary" className="h-[38px] gap-1.5" disabled={!isPublic || changed} onClick={copy}>
					<Icon name={copied ? "check" : "content_copy"} size={18} />
					{copied ? <Trans>Copied</Trans> : <Trans>Copy</Trans>}
				</Button>
			</div>
			<p
				id={`${id}-message`}
				role="status"
				className={cn("break-all text-xs leading-4", invalid ? "text-danger-text" : "text-ink-3")}
			>
				{result?.status === "taken" ? (
					<>
						{result.takenBy ? (
							<Trans>You already use this for “{result.takenBy}”.</Trans>
						) : (
							<Trans>Another of your resumes uses this address.</Trans>
						)}{" "}
						{result.suggestion && (
							<button
								type="button"
								className="font-medium text-ink underline underline-offset-2"
								onClick={() => setSlug(result.suggestion ?? slug)}
							>
								<Trans>Try {result.suggestion}</Trans>
							</button>
						)}
					</>
				) : (
					message
				)}
			</p>
			{isPublic && canShare && (
				<Button
					variant="secondary"
					className="pointer-fine:hidden w-fit gap-1.5"
					onClick={() => void navigator.share({ title: resume.name, url }).catch(() => undefined)}
				>
					<Icon name="ios_share" size={18} />
					<Trans>Share via…</Trans>
				</Button>
			)}
		</div>
	);
}

/** Q3a: visitors enter a password before they see the resume. */
function PasswordRow() {
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const confirm = useConfirm();
	const [dialogOpen, setDialogOpen] = useState(false);
	const { mutateAsync: setPassword } = useMutation(orpc.resume.setPassword.mutationOptions());
	const { mutateAsync: removePassword } = useMutation(orpc.resume.removePassword.mutationOptions());

	const turnOff = async () => {
		const confirmed = await confirm(t`Remove the password?`, {
			description: t`Anyone with the link will be able to view your resume.`,
			confirmText: t`Remove`,
		});
		if (!confirmed) return;
		try {
			await removePassword({ id: resume.id });
			patchResume((draft) => {
				draft.hasPassword = false;
			});
			toast.add({ description: t`Password removed` });
		} catch (error) {
			toast.add({ type: "error", description: errorMessage(error) });
		}
	};

	return (
		<>
			<SwitchRow
				checked={resume.hasPassword ?? false}
				disabled={resume.isLocked}
				onCheckedChange={(checked) => (checked ? setDialogOpen(true) : void turnOff())}
				label={t`Require a password`}
				description={
					resume.hasPassword
						? t`Visitors enter it before they see the resume. Share it only with people you trust.`
						: undefined
				}
				className="py-0"
			/>
			{dialogOpen && (
				<ResumePasswordDialog
					onClose={() => setDialogOpen(false)}
					onSubmit={async (password) => {
						await setPassword({ id: resume.id, password });
						patchResume((draft) => {
							draft.hasPassword = true;
						});
						toast.add({ description: t`Password set` });
					}}
				/>
			)}
		</>
	);
}

function QrCodeButton({ url }: { url: string }) {
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button variant="ghost" size="sm" className="gap-1.5">
						<Icon name="qr_code_2" size={18} />
						<Trans>QR code</Trans>
					</Button>
				}
			/>
			<PopoverContent className="w-auto p-4">
				<QRCodeSVG value={url} size={176} marginSize={2} title={t`QR code for ${url}`} />
			</PopoverContent>
		</Popover>
	);
}

/** Only the owner sees these; counts are anonymous and kept for 90 days. */
function ViewsAndDownloads({ isPublic }: { isPublic: boolean }) {
	const resume = useCurrentResume();
	const { i18n } = useLingui();
	const { data: statistics } = useQuery(orpc.resume.statistics.getById.queryOptions({ input: { id: resume.id } }));
	const { data: daily } = useQuery({
		...orpc.resume.statistics.getDailyById.queryOptions({ input: { id: resume.id, days: 30 } }),
		enabled: isPublic,
	});
	const summary = summarizeViews(daily ?? []);
	const lastView = statistics?.lastViewedAt ? formatTimeSince(statistics.lastViewedAt, i18n.locale) : "—";
	const firstDay = daily?.[0]?.date;

	return (
		<section aria-labelledby="share-stats-title" className="grid gap-3">
			<div className="flex items-baseline justify-between">
				<h3 id="share-stats-title" className="font-semibold text-sm">
					<Trans>Views and downloads</Trans>
				</h3>
				<span className="text-ink-3 text-xs">
					<Trans>Only you see these</Trans>
				</span>
			</div>

			{isPublic ? (
				<>
					<dl className="grid grid-cols-3 gap-2.5">
						<Stat value={summary.views} label={t`views · 30 days`} />
						<Stat value={summary.downloads} label={t`downloads`} />
						<Stat value={lastView} label={t`since last view`} />
					</dl>
					<div
						role="img"
						aria-label={t`Daily views over 30 days, peak ${summary.peak}`}
						className="flex h-14 items-end gap-[3px] pt-1"
					>
						{summary.bars.map((bar) => (
							<span
								key={bar.date}
								className="flex-1 rounded-t-[2px] bg-line-2"
								style={{ height: `${Math.max(6, Math.round(bar.height * 100))}%` }}
							/>
						))}
					</div>
					<div className="flex justify-between font-medium font-mono text-[11px] text-ink-3">
						<span>
							{firstDay
								? new Date(`${firstDay}T00:00:00`).toLocaleDateString(i18n.locale, { month: "short", day: "numeric" })
								: ""}
						</span>
						<span>
							<Trans>Today</Trans>
						</span>
					</div>
				</>
			) : (
				<p className="text-[13px] text-ink-2 leading-[19px]">
					<Trans>
						Turn on the public link to count views and downloads. Counts are anonymous and kept for 90 days.
					</Trans>
				</p>
			)}
		</section>
	);
}

function Stat({ value, label }: { value: number | string; label: string }) {
	return (
		<div className="flex flex-col-reverse gap-0.5">
			<dt className="text-ink-3 text-xs">{label}</dt>
			<dd className="font-display font-medium text-[26px] leading-[30px]">{value}</dd>
		</div>
	);
}
