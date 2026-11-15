export interface LemmyLoginResult {
  jwt: string;
  userId: number;
  username: string;
}

export interface LemmyPostResult {
  postId: number;
  postUrl: string;
}

function normalizeInstance(instanceUrl: string): string {
  let url = instanceUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

export async function lemmyLogin(
  instanceUrl: string,
  usernameOrEmail: string,
  password: string
): Promise<LemmyLoginResult> {
  const base = normalizeInstance(instanceUrl);
  const res = await fetch(`${base}/api/v3/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
    signal: AbortSignal.timeout(20_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.jwt) {
    throw new Error(
      `Lemmy login failed (${res.status}): ${data.error ?? data.message ?? "check username/password"}`
    );
  }

  return {
    jwt: data.jwt,
    userId: data.user_id ?? 0,
    username: data.username ?? usernameOrEmail,
  };
}

export async function lemmyFindCommunity(
  instanceUrl: string,
  jwt: string,
  communityName: string
): Promise<number> {
  const base = normalizeInstance(instanceUrl);
  const name = communityName.replace(/^.*\//, "").trim();
  const res = await fetch(
    `${base}/api/v3/community?name=${encodeURIComponent(name)}`,
    {
      headers: { Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(15_000),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.community_view?.community?.id) {
    throw new Error(
      `Lemmy community "${name}" not found on ${base}. Check the name and that the community exists.`
    );
  }
  return data.community_view.community.id;
}

export async function lemmyCreatePost(
  instanceUrl: string,
  jwt: string,
  input: {
    title: string;
    body: string;
    communityId: number;
    url?: string;
  }
): Promise<LemmyPostResult> {
  const base = normalizeInstance(instanceUrl);
  const res = await fetch(`${base}/api/v3/post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      name: input.title,
      body: input.body,
      community_id: input.communityId,
      url: input.url,
      auth: jwt,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.post_view?.post?.id) {
    throw new Error(
      `Lemmy post failed (${res.status}): ${data.error ?? data.message ?? "unknown"}`
    );
  }

  const post = data.post_view.post;
  return {
    postId: post.id,
    postUrl: post.ap_id ?? `${base}/post/${post.id}`,
  };
}

export async function lemmyAutoPost(input: {
  instanceUrl: string;
  username: string;
  password: string;
  community: string;
  title: string;
  body: string;
  url?: string;
}): Promise<LemmyPostResult & { jwt: string }> {
  const login = await lemmyLogin(input.instanceUrl, input.username, input.password);
  const communityId = await lemmyFindCommunity(
    input.instanceUrl,
    login.jwt,
    input.community
  );
  const post = await lemmyCreatePost(input.instanceUrl, login.jwt, {
    title: input.title,
    body: input.body,
    communityId,
    url: input.url,
  });
  return { ...post, jwt: login.jwt };
}