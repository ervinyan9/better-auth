import { betterFetch } from "@better-fetch/fetch";
import type { OAuthProvider, ProviderOptions } from "../oauth2";
import {
	createAuthorizationURL,
	refreshAccessToken,
	validateAuthorizationCode,
} from "../oauth2";

export interface GithubProfile {
	login: string;
	id: string;
	node_id: string;
	avatar_url: string;
	gravatar_id: string;
	url: string;
	html_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	starred_url: string;
	subscriptions_url: string;
	organizations_url: string;
	repos_url: string;
	events_url: string;
	received_events_url: string;
	type: string;
	site_admin: boolean;
	name: string;
	company: string;
	blog: string;
	location: string;
	email: string;
	hireable: boolean;
	bio: string;
	twitter_username: string;
	public_repos: string;
	public_gists: string;
	followers: string;
	following: string;
	created_at: string;
	updated_at: string;
	private_gists: string;
	total_private_repos: string;
	owned_private_repos: string;
	disk_usage: string;
	collaborators: string;
	two_factor_authentication: boolean;
	plan: {
		name: string;
		space: string;
		private_repos: string;
		collaborators: string;
	};
}

export interface GithubOptions extends ProviderOptions<GithubProfile> {
	tokenEndpointUrl?: string
	refreshTokenUrl?: string
    userInfoUrl?: string
}
export const github = (options: GithubOptions) => {
	const tokenEndpoint = options.tokenEndpointUrl ?? "https://github.com/login/oauth/access_token";
    const userInfoUrl = options.userInfoUrl ?? "https://api.github.com/user";
    const refreshTokenUrl = options.refreshTokenUrl ?? "https://github.com/login/oauth/token";
	return {
		id: "github",
		name: "GitHub",
		createAuthorizationURL({ state, scopes, loginHint, redirectURI }) {
			const _scopes = options.disableDefaultScope
				? []
				: ["read:user", "user:email"];
			options.scope && _scopes.push(...options.scope);
			scopes && _scopes.push(...scopes);
			return createAuthorizationURL({
				id: "github",
				options,
				authorizationEndpoint: "https://github.com/login/oauth/authorize",
				scopes: _scopes,
				state,
				redirectURI,
				loginHint,
				prompt: options.prompt,
			});
		},
		validateAuthorizationCode: async ({ code, redirectURI }) => {
			return validateAuthorizationCode({
				code,
				redirectURI,
				options,
				tokenEndpoint,
			});
		},
		refreshAccessToken: options.refreshAccessToken
			? options.refreshAccessToken
			: async (refreshToken) => {
					return refreshAccessToken({
						refreshToken,
						options: {
							clientId: options.clientId,
							clientKey: options.clientKey,
							clientSecret: options.clientSecret,
						},
						tokenEndpoint: refreshTokenUrl,
					});
				},
		async getUserInfo(token) {
			if (options.getUserInfo) {
				return options.getUserInfo(token);
			}
			const { data: profile, error } = await betterFetch<GithubProfile>(
				userInfoUrl,
				{
					headers: {
						"User-Agent": "better-auth",
						authorization: `Bearer ${token.accessToken}`,
					},
				},
			);
			if (error) {
				return null;
			}
			const { data: emails } = await betterFetch<
				{
					email: string;
					primary: boolean;
					verified: boolean;
					visibility: "public" | "private";
				}[]
			>("https://api.github.com/user/emails", {
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
					"User-Agent": "better-auth",
				},
			});

			if (!profile.email && emails) {
				profile.email = (emails.find((e) => e.primary) ?? emails[0])
					?.email as string;
			}
			const emailVerified =
				emails?.find((e) => e.email === profile.email)?.verified ?? false;

			const userMap = await options.mapProfileToUser?.(profile);
			return {
				user: {
					id: profile.id.toString(),
					name: profile.name || profile.login,
					email: profile.email,
					image: profile.avatar_url,
					emailVerified,
					...userMap,
				},
				data: profile,
			};
		},
		options,
	} satisfies OAuthProvider<GithubProfile>;
};
