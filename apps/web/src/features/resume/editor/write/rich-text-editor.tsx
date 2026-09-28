import type { IconName } from "@reactive-resume/ui/components/icon";
import type { Editor } from "@tiptap/react";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@reactive-resume/ui/components/icon";
import { cn } from "@reactive-resume/utils/style";
import { hasUnsupportedTableMarkup, richInputExtensions } from "@/components/input/rich-input";
import { usePrompt } from "@/hooks/use-prompt";

type ToolbarAction = {
	icon: IconName;
	label: string;
	isActive?: (editor: Editor) => boolean;
	run: (editor: Editor) => void;
};

/**
 * Bold, Italic, Link, then lists and Clear formatting. Formatting the toolbar doesn't offer (headings,
 * colours, alignment…) still loads and prints; Clear formatting removes it.
 */
function useToolbarActions(): ToolbarAction[] {
	const prompt = usePrompt();

	return [
		{
			icon: "format_bold",
			label: t`Bold`,
			isActive: (editor) => editor.isActive("bold"),
			run: (editor) => editor.chain().focus().toggleBold().run(),
		},
		{
			icon: "format_italic",
			label: t`Italic`,
			isActive: (editor) => editor.isActive("italic"),
			run: (editor) => editor.chain().focus().toggleItalic().run(),
		},
		{
			icon: "link",
			label: t`Link`,
			isActive: (editor) => editor.isActive("link"),
			run: async (editor) => {
				const current = (editor.getAttributes("link").href as string | undefined) ?? "";
				const href = await prompt(t`Link address`, {
					defaultValue: current || "https://",
					description: t`Leave it empty to remove the link.`,
				});
				if (href === null) return editor.commands.focus();
				const chain = editor.chain().focus().extendMarkRange("link");
				if (!href.trim() || href.trim() === "https://") chain.unsetLink().run();
				else chain.setLink({ href: href.trim() }).run();
			},
		},
		{
			icon: "format_list_bulleted",
			label: t`Bulleted list`,
			isActive: (editor) => editor.isActive("bulletList"),
			run: (editor) => editor.chain().focus().toggleBulletList().run(),
		},
		{
			icon: "format_list_numbered",
			label: t`Numbered list`,
			isActive: (editor) => editor.isActive("orderedList"),
			run: (editor) => editor.chain().focus().toggleOrderedList().run(),
		},
		{
			icon: "format_clear",
			label: t`Clear formatting`,
			run: (editor) => editor.chain().focus().clearNodes().unsetAllMarks().unsetTextAlign().run(),
		},
	];
}

type RichTextEditorProps = {
	/** Accessible name of the text box. */
	label: string;
	value: string;
	onChange: (html: string) => void;
	/** Guidance under the text while editing, e.g. "2–3 sentences reads best". */
	hint?: ReactNode;
	disabled?: boolean;
	className?: string;
};

/**
 * Rich text for descriptions: the toolbar and footer show while the text has focus, the toolbar never
 * takes focus from it, and Markdown shortcuts work ("- " starts a list, "**bold**").
 */
export function RichTextEditor({ label, value, onChange, hint, disabled = false, className }: RichTextEditorProps) {
	const [focused, setFocused] = useState(false);
	const actions = useToolbarActions();
	const readOnlyTable = useMemo(() => hasUnsupportedTableMarkup(value), [value]);

	const editor = useEditor({
		extensions: richInputExtensions,
		content: value,
		editable: !disabled && !readOnlyTable,
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		editorProps: {
			attributes: {
				"aria-label": label,
				"aria-multiline": "true",
				role: "textbox",
				spellcheck: "true",
				class: cn(
					"wysiwyg max-h-[360px] min-h-[88px] overflow-y-auto px-3 py-2 text-sm outline-none",
					"[&_[data-resume-whitespace=preserve]]:whitespace-pre-wrap",
				),
			},
		},
		onUpdate: ({ editor }) => onChange(editor.getHTML()),
		onFocus: () => setFocused(true),
		onBlur: () => setFocused(false),
	});

	const state = useEditorState({
		editor,
		selector: ({ editor }) =>
			editor
				? { characters: editor.getText().length, active: actions.map((action) => action.isActive?.(editor) ?? false) }
				: { characters: 0, active: [] as boolean[] },
	});

	// Undo, the page and the assistant change the text from outside; keep the editor in step.
	useEffect(() => {
		if (!editor || editor.getHTML() === value) return;
		editor.commands.setContent(value, { emitUpdate: false });
	}, [editor, value]);

	useEffect(() => {
		editor?.setEditable(!disabled && !readOnlyTable, false);
	}, [editor, disabled, readOnlyTable]);

	return (
		<div
			className={cn(
				"rounded-lg border border-line-2 bg-raised transition-[border-color,box-shadow] duration-quick",
				focused && "border-accent shadow-[0_0_0_3px_var(--accent-soft)]",
				disabled && "bg-sunken",
				className,
			)}
		>
			{focused && !readOnlyTable && (
				<div role="toolbar" aria-label={t`Formatting`} className="flex gap-0.5 border-line border-b px-1.5 py-1">
					{actions.map((action, index) => (
						<button
							key={action.icon}
							type="button"
							aria-label={action.label}
							aria-pressed={action.isActive ? (state?.active[index] ?? false) : undefined}
							title={action.label}
							// Keep the caret in the text while formatting.
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => editor && void action.run(editor)}
							className={cn(
								"flex size-8 items-center justify-center rounded-md text-ink-2 transition-colors duration-quick hover:bg-hover",
								state?.active[index] && "bg-accent-soft text-accent-text",
								index === 3 && "ms-1.5",
							)}
						>
							<Icon name={action.icon} />
						</button>
					))}
				</div>
			)}

			{readOnlyTable && (
				<p role="status" className="border-line border-b px-3 py-2 text-ink-2 text-xs">
					<Trans>
						Original table formatting is preserved. This content is read-only because it cannot be edited safely.
					</Trans>
				</p>
			)}

			<EditorContent editor={editor} />

			{focused && (
				<div className="flex items-center justify-between gap-3 border-line border-t px-3 py-1.5 text-ink-3 text-xs">
					<span>{hint ?? <Trans>Markdown shortcuts on</Trans>}</span>
					<span className="font-mono">
						<Plural value={state?.characters ?? 0} one="# character" other="# characters" />
					</span>
				</div>
			)}
		</div>
	);
}
