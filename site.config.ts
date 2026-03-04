import siteConfig, { providers } from "./src/utils/config";

const env = import.meta.env ?? {};

const config = siteConfig({
	title: "MareDevi's Blog",
	prologue: "ポケットの中指立て続け\n駆け抜け 一抜け\nバイバイ",
	author: {
		name: "MareDevi",
		email: "me@maredevi.moe",
		link: "https://www.maredevi.moe"
	},
	description: "A place to record my thoughts and share my knowledge.",
	copyright: {
		type: "CC BY-NC-ND 4.0",
		year: "2026"
	},
	i18n: {
		locales: ["en", "zh-cn", "ja"],
		defaultLocale: "zh-cn"
	},
	pagination: {
		note: 15,
		jotting: 24
	},
	heatmap: {
		unit: "day",
		weeks: 20
	},
	feed: {
		section: "*",
		limit: 20
	},
	comment: {
		"max-length": 500,
		"hide-deleted": true,
		history: true
	},
	latest: "*"
});

const monolocale = Number(config.i18n.locales.length) === 1;

const turnstile = env.CLOUDFLARE_TURNSTILE_SECRET_KEY ? env.CLOUDFLARE_TURNSTILE_SITE_KEY : undefined;

const push = env.VAPID_PRIVATE_KEY ? env.VAPID_PUBLIC_KEY : undefined;

const email = Boolean(env.EMAIL_FROM);

const oauth = providers([
	{ name: "GitHub", logo: "simple-icons--github", clientID: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
	{ name: "Google", logo: "simple-icons--google", clientID: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
	{ name: "X", logo: "simple-icons--x", clientID: env.TWITTER_CLIENT_ID, clientSecret: env.TWITTER_CLIENT_SECRET }
]);

export { turnstile, oauth, monolocale, push, email };

export default config;
