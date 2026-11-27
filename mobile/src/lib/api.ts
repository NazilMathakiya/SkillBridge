
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is missing. Check your mobile/.env file.",
  );
}

// Socket.IO is mounted on the server root, not under /api.
export const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export type ApiUser = {
  _id: string;
  name: string;
  email: string;
  bio?: string;
  skillsToTeach: string[];
  skillsToLearn: string[];
};

export type AuthResponse = {
  success: boolean;
  message: string;
  token: string;
  user: ApiUser;
};

export type ProfileResponse = {
  success: boolean;
  user: ApiUser;
};

export type UpdateProfileResponse = {
  success: boolean;
  message: string;
  user: ApiUser;
};

export type MatchUser = {
  user: ApiUser;
  matchingSkills: string[];
};

export type MatchesResponse = {
  success: boolean;
  count: number;
  matches: MatchUser[];
};

export type ExchangeRequest = {
  _id: string;
  sender: string | ApiUser;
  receiver: string | ApiUser;
  offeredSkill: string;
  wantedSkill: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

export type ExchangeRequestsResponse = {
  success: boolean;
  count: number;
  requests: ExchangeRequest[];
};

export type CreateRequestResponse = {
  success: boolean;
  message: string;
  request: ExchangeRequest;
};

export type ChatParticipant = {
  _id: string;
  name: string;
};

export type ChatExchange = {
  _id: string;
  sender: ChatParticipant | string;
  receiver: ChatParticipant | string;
  offeredSkill: string;
  wantedSkill: string;
  status: "pending" | "accepted" | "rejected";
};

export type ChatItem = {
  _id: string;
  participants: (ChatParticipant | string)[];
  exchangeRequest: ChatExchange | string;
  lastMessage: string;
  lastMessageAt?: string;
  updatedAt?: string;
};

export type ChatsResponse = {
  success: boolean;
  count: number;
  chats: ChatItem[];
};

export type ChatMessage = {
  _id: string;
  chat: string;
  sender: ChatParticipant | string;
  text: string;
  createdAt: string;
  updatedAt?: string;
};

export type ChatMessagesResponse = {
  success: boolean;
  count: number;
  messages: ChatMessage[];
};

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? "Something went wrong.");
  }

  return data as T;
}

export function registerUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: data,
  });
}

export function loginUser(data: {
  email: string;
  password: string;
}) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: data,
  });
}

export function getMyProfile(token: string) {
  return apiRequest<ProfileResponse>("/profile/me", {
    token,
  });
}

export function updateMyProfile(
  token: string,
  data: {
    name: string;
    bio: string;
    skillsToTeach: string[];
    skillsToLearn: string[];
  },
) {
  return apiRequest<UpdateProfileResponse>("/profile/me", {
    method: "PUT",
    token,
    body: data,
  });
}

export function getMyMatches(token: string) {
  return apiRequest<MatchesResponse>("/users/matches", {
    token,
  });
}

export function getSentRequests(token: string) {
  return apiRequest<ExchangeRequestsResponse>(
    "/exchange-requests/sent",
    { token },
  );
}

export function createExchangeRequest(
  token: string,
  data: {
    receiverId: string;
    offeredSkill: string;
    wantedSkill: string;
  },
) {
  return apiRequest<CreateRequestResponse>(
    "/exchange-requests",
    {
      method: "POST",
      token,
      body: data,
    },
  );
}
