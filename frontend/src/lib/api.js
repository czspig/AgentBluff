async function request(path, options) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `请求失败（${response.status}）`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export const api = {
  meta: () => request("/api/meta"),
  personas: () => request("/api/personas"),
  persona: (id) => request(`/api/personas/${id}`),
  games: () => request("/api/games"),
  liveGame: () => request("/api/games/live"),
  game: (id) => request(`/api/games/${id}`),
  startGame: () => request("/api/games", { method: "POST" }),
};

// Subscribes to a game's live event stream. Returns an unsubscribe function.
export function streamGame(id, after, { onEvent, onClosed }) {
  const source = new EventSource(`/api/games/${id}/stream?after=${after}`);
  source.onmessage = (message) => onEvent(JSON.parse(message.data));
  source.addEventListener("closed", () => {
    source.close();
    onClosed?.();
  });
  // EventSource reconnects on its own and resends Last-Event-ID, so errors need no handling here.
  return () => source.close();
}
