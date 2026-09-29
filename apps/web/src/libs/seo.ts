import { t } from "@lingui/core/macro";
import { getLocaleAlternates, isLocale, localizedUrl } from "@reactive-resume/utils/locale";

const appName = "Reactive Resume";
const repositoryUrl = "https://github.com/reactive-resume/reactive-resume";

type JsonLd = Record<string, unknown>;

export const getCanonicalRootUrl = (origin: string): string => new URL("/", origin).href;

export const createNoindexFollowMeta = () => ({ name: "robots", content: "noindex, follow" });

type ResumeSocialMetaOptions = {
	canonicalUrl: string;
	title: string;
	description: string;
	imageUrl: string;
};

export const createResumeSocialMeta = ({ canonicalUrl, title, description, imageUrl }: ResumeSocialMetaOptions) => [
	{ property: "og:type", content: "profile" },
	{ property: "og:title", content: title },
	{ property: "og:description", content: description },
	{ property: "og:url", content: canonicalUrl },
	{ property: "og:image", content: imageUrl },
	// X only reads these as `name`, not `property`
	{ name: "twitter:card", content: "summary_large_image" },
	{ name: "twitter:url", content: canonicalUrl },
	{ name: "twitter:title", content: title },
	{ name: "twitter:description", content: description },
	{ name: "twitter:image", content: imageUrl },
];

const serializeJsonLdForScript = (data: JsonLd) =>
	JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (character) => {
		switch (character) {
			case "<":
				return "\\u003C";
			case ">":
				return "\\u003E";
			case "&":
				return "\\u0026";
			case "\u2028":
				return "\\u2028";
			case "\u2029":
				return "\\u2029";
			default:
				return character;
		}
	});

const createStructuredDataScript = (id: string, data: JsonLd) => ({
	id,
	type: "application/ld+json",
	children: serializeJsonLdForScript(data),
});

const getRootStructuredData = (canonicalUrl: string): JsonLd[] => [
	{
		"@type": "WebSite",
		name: appName,
		url: canonicalUrl,
	},
	{
		"@type": ["SoftwareApplication", "WebApplication"],
		name: appName,
		url: canonicalUrl,
		description:
			"Reactive Resume is a free and open-source resume builder that makes it easy to create, update, and share your resume.",
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web",
		isAccessibleForFree: true,
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		},
		codeRepository: repositoryUrl,
	},
	{
		"@type": "Project",
		name: appName,
		url: canonicalUrl,
		sameAs: [repositoryUrl],
	},
];

export const createRootStructuredDataScript = (canonicalUrl: string) =>
	createStructuredDataScript("reactive-resume-structured-data", {
		"@context": "https://schema.org",
		"@graph": getRootStructuredData(canonicalUrl),
	});

/** The homepage's title and description in the active locale. The prerendered page and the route share them. */
export const getHomepageMeta = () => ({
	title: `${appName} — ${t`A free and open-source resume builder`}`,
	description: t`Free, open-source resume builder. Create, update, and share your resume, with no ads and no paywall.`,
});

/** The homepage's canonical link and hreflang alternates. A `?locale=` address is canonical for its own language. */
export const createHomepageLinks = (origin: string, locale: unknown) => [
	{ rel: "canonical", href: localizedUrl(getCanonicalRootUrl(origin), isLocale(locale) ? locale : undefined) },
	...getLocaleAlternates(getCanonicalRootUrl(origin)).map(({ hreflang, href }) => ({
		rel: "alternate",
		hrefLang: hreflang,
		href,
	})),
];
