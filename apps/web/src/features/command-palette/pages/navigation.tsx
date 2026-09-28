import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	BriefcaseIcon,
	GearIcon,
	HouseSimpleIcon,
	KeyIcon,
	OpenAiLogoIcon,
	PlusIcon,
	ReadCvLogoIcon,
	SealCheckIcon,
	ShieldCheckIcon,
	TrashIcon,
	UserCircleIcon,
	UserGearIcon,
} from "@phosphor-icons/react";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { CommandItem } from "@reactive-resume/ui/components/command";
import { useDialogStore } from "@/dialogs/store";
import { useCommandPaletteStore } from "../store";
import { BaseCommandGroup } from "./base";

export function NavigationCommandGroup() {
	const navigate = useNavigate();
	const { session } = useRouteContext({ strict: false });
	const reset = useCommandPaletteStore((state) => state.reset);
	const pushPage = useCommandPaletteStore((state) => state.pushPage);

	const onNavigate = async (path: string) => {
		await navigate({ to: path });
		reset();
	};

	return (
		<>
			<BaseCommandGroup heading={<Trans>Go to…</Trans>}>
				<CommandItem keywords={[t`Home`]} value="navigation.home" onSelect={() => onNavigate("/")}>
					<HouseSimpleIcon />
					<Trans>Home</Trans>
				</CommandItem>

				<CommandItem
					disabled={!session}
					keywords={[t`Documents`, t`Resumes`, t`Cover letters`]}
					value="navigation.documents"
					onSelect={() => onNavigate("/dashboard")}
				>
					<ReadCvLogoIcon />
					<Trans>Documents</Trans>
				</CommandItem>

				<CommandItem
					disabled={!session}
					keywords={[t`New document`, t`Create`, t`Import`]}
					value="navigation.documents.new"
					onSelect={() => {
						reset();
						useDialogStore.getState().openDialog("document.new", undefined);
					}}
				>
					<PlusIcon />
					<Trans>New document</Trans>
				</CommandItem>

				<CommandItem
					disabled={!session}
					keywords={[t`Trash`, t`Deleted`]}
					value="navigation.trash"
					onSelect={() => onNavigate("/dashboard/trash")}
				>
					<TrashIcon />
					<Trans>Trash</Trans>
				</CommandItem>

				<CommandItem
					keywords={[t`ATS Checker`, t`Check a PDF`]}
					value="navigation.ats-checker"
					onSelect={() => onNavigate("/ats-checker")}
				>
					<SealCheckIcon />
					<Trans>ATS Checker</Trans>
				</CommandItem>

				<CommandItem
					disabled={!session}
					keywords={[t`Applications`, t`Jobs`]}
					value="navigation.applications"
					onSelect={() => onNavigate("/dashboard/applications")}
				>
					<BriefcaseIcon />
					<Trans>Applications</Trans>
				</CommandItem>

				<CommandItem
					disabled={!session}
					keywords={[t`New Application`, t`Add application`, t`Job`]}
					value="navigation.applications.new"
					onSelect={async () => {
						await navigate({ to: "/dashboard/applications", search: { create: true } });
						reset();
					}}
				>
					<PlusIcon />
					<Trans>New Application</Trans>
				</CommandItem>

				<CommandItem
					disabled={!session}
					keywords={[t`Settings`]}
					value="navigation.settings"
					onSelect={() => pushPage("settings")}
				>
					<GearIcon />
					<Trans>Settings</Trans>
				</CommandItem>
			</BaseCommandGroup>

			<BaseCommandGroup page="settings" heading={<Trans>Settings</Trans>}>
				<CommandItem
					keywords={[t`Profile`]}
					value="navigation.settings.profile"
					onSelect={() => onNavigate("/dashboard/settings/profile")}
				>
					<UserCircleIcon />
					<Trans>Profile</Trans>
				</CommandItem>

				<CommandItem
					keywords={[t`Preferences`]}
					value="navigation.settings.preferences"
					onSelect={() => onNavigate("/dashboard/settings/preferences")}
				>
					<GearIcon />
					<Trans>Preferences</Trans>
				</CommandItem>

				<CommandItem
					keywords={[t`Authentication`]}
					value="navigation.settings.authentication"
					onSelect={() => onNavigate("/dashboard/settings/authentication")}
				>
					<ShieldCheckIcon />
					<Trans>Authentication</Trans>
				</CommandItem>

				<CommandItem
					keywords={[t`API Keys`]}
					value="navigation.settings.api-keys"
					onSelect={() => onNavigate("/dashboard/settings/api-keys")}
				>
					<KeyIcon />
					<Trans>API Keys</Trans>
				</CommandItem>

				<CommandItem
					keywords={[t`Integrations`, t`Artificial Intelligence`]}
					value="navigation.settings.integrations"
					onSelect={() => onNavigate("/dashboard/settings/integrations")}
				>
					<OpenAiLogoIcon />
					<Trans>Integrations</Trans>
				</CommandItem>

				<CommandItem
					keywords={[t`Account`, t`Export Data`, t`Delete Account`]}
					value="navigation.settings.account"
					onSelect={() => onNavigate("/dashboard/settings/account")}
				>
					<UserGearIcon />
					<Trans>Account</Trans>
				</CommandItem>
			</BaseCommandGroup>
		</>
	);
}
