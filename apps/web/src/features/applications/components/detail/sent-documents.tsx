import type { Application } from "../../types";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, buttonVariants } from "@reactive-resume/ui/components/button";
import { Icon } from "@reactive-resume/ui/components/icon";
import { toast } from "@reactive-resume/ui/components/toast";
import { useDialogStore } from "@/dialogs/store";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { PIPELINE } from "../../stages";
import { useInvalidateApplications } from "../../use-application-actions";
import { FileAttachmentField } from "../file-attachment-field";

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** When the application was sent: its first stage at Applied or beyond. */
function sentOn(application: Application) {
	const applied = PIPELINE.indexOf("applied");
	const entry = [...application.activity]
		.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
		.find((item) => item.type === "stage" && PIPELINE.indexOf(item.stage) >= applied);
	return new Date(entry?.at ?? application.appliedAt);
}

type SentDocumentsProps = { application: Application; disabled: boolean };

/**
 * WHAT YOU SENT: the linked resume (opening the version that was sent, read-only, with a way back to the latest) and
 * the linked letter. Without them: Tailor a resume and Write a letter. Uploaded PDFs stay under "Attach a file".
 */
export function SentDocuments({ application, disabled }: SentDocumentsProps) {
	const { i18n } = useLingui();
	const navigate = useNavigate();
	const invalidate = useInvalidateApplications();
	const openDialog = useDialogStore((state) => state.openDialog);
	const { data: documents } = useQuery(orpc.documents.list.queryOptions({ input: { trashed: false } }));
	const [attaching, setAttaching] = useState(Boolean(application.resumeFileUrl || application.coverLetterUrl));

	const update = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => invalidate(application.id),
		onError: (error) =>
			toast.add({ type: "error", description: getOrpcErrorMessage(error, { fallback: t`Couldn't save.` }) }),
	});
	const createLetter = useMutation(orpc.coverLetters.create.mutationOptions());

	const resume = documents?.find((document) => document.type === "resume" && document.id === application.resumeId);
	const letter = documents?.find((document) => document.type === "letter" && document.id === application.coverLetterId);
	const date = sentOn(application).toLocaleDateString(i18n.locale, { month: "short", day: "numeric" });

	const writeLetter = async () => {
		try {
			const created = await createLetter.mutateAsync({
				name: t`Cover letter — ${application.company}`.slice(0, 100),
				recipient: `<p>${escapeHtml(t`Hiring team, ${application.company}`)}</p>`,
				applicationId: application.id,
				...(application.resumeId ? { resumeId: application.resumeId } : {}),
			});
			await update.mutateAsync({ id: application.id, coverLetterId: created.id });
			toast.add({ description: t`Letter created with the recipient filled in` });
			void navigate({ to: "/dashboard", search: { letter: created.id } });
		} catch (error) {
			toast.add({
				type: "error",
				description: getOrpcErrorMessage(error, { fallback: t`Couldn't create the letter.` }),
			});
		}
	};

	return (
		<section aria-labelledby="application-sent" className="grid gap-2">
			<h3 id="application-sent" className="font-semibold text-ink-3 text-xs uppercase">
				<Trans>What you sent</Trans>
			</h3>

			{application.resumeId && (
				<div className="flex items-center gap-2.5 rounded-xl border border-line p-3">
					<Icon name="description" className="shrink-0 text-ink-2" />
					<div className="grid min-w-0 flex-1">
						<span className="truncate font-medium text-sm">{resume?.name ?? t`Linked resume`}</span>
						<span className="text-ink-3 text-xs">
							{application.sentResumeVersionId ? (
								application.sentCheckScore !== null ? (
									<Trans>
										Version sent {date} · Check {application.sentCheckScore}
									</Trans>
								) : (
									<Trans>Version sent {date}</Trans>
								)
							) : (
								<Trans>Linked · not sent yet</Trans>
							)}
						</span>
					</div>
					<Link
						to="/builder/$resumeId"
						params={{ resumeId: application.resumeId }}
						search={application.sentResumeVersionId ? { version: application.sentResumeVersionId } : {}}
						className={buttonVariants({ size: "sm", variant: "secondary" })}
					>
						<Trans>Open</Trans>
					</Link>
				</div>
			)}

			{application.coverLetterId && (
				<div className="flex items-center gap-2.5 rounded-xl border border-line p-3">
					<Icon name="mail" className="shrink-0 text-ink-2" />
					<div className="grid min-w-0 flex-1">
						<span className="truncate font-medium text-sm">{letter?.name ?? t`Cover letter`}</span>
						<span className="text-ink-3 text-xs">
							<Trans>Cover letter</Trans>
						</span>
					</div>
					<Link
						to="/dashboard"
						search={{ letter: application.coverLetterId }}
						className={buttonVariants({ size: "sm", variant: "secondary" })}
					>
						<Trans>Open</Trans>
					</Link>
				</div>
			)}

			{(!application.resumeId || !application.coverLetterId) && (
				<div className="flex flex-wrap gap-1.5">
					{!application.resumeId && (
						<Button
							size="sm"
							disabled={disabled}
							onClick={() => openDialog("document.new", { step: "copy", applicationId: application.id })}
						>
							<Icon name="content_copy" size={16} />
							<Trans>Tailor a resume</Trans>
						</Button>
					)}
					{!application.coverLetterId && (
						<Button
							size="sm"
							variant="secondary"
							disabled={disabled || createLetter.isPending}
							onClick={() => void writeLetter()}
						>
							<Icon name="mail" size={16} />
							<Trans>Write a letter</Trans>
						</Button>
					)}
				</div>
			)}

			{attaching ? (
				<div className="grid gap-1.5">
					<FileAttachmentField
						value={
							application.resumeFileUrl
								? { url: application.resumeFileUrl, name: application.resumeFileName || t`Resume file` }
								: null
						}
						attachLabel={t`Attach a resume file (PDF)`}
						disabled={disabled || update.isPending}
						onChange={(value) =>
							update.mutate({
								id: application.id,
								resumeFileUrl: value?.url ?? null,
								resumeFileName: value?.name ?? null,
							})
						}
					/>
					<FileAttachmentField
						value={
							application.coverLetterUrl
								? { url: application.coverLetterUrl, name: application.coverLetterName || t`Cover letter file` }
								: null
						}
						attachLabel={t`Attach a cover letter file (PDF)`}
						disabled={disabled || update.isPending}
						onChange={(value) =>
							update.mutate({
								id: application.id,
								coverLetterUrl: value?.url ?? null,
								coverLetterName: value?.name ?? null,
							})
						}
					/>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setAttaching(true)}
					className="w-fit text-ink-3 text-xs underline underline-offset-2 hover:text-ink-2"
				>
					<Trans>Attach a file instead</Trans>
				</button>
			)}
		</section>
	);
}
