import React from "react";
import { api, streamGame } from "./api.js";
import { buildState } from "./gameState.js";

// Loads a game and, while it is running, follows its live event stream.
export function useGame(id, { live = true } = {}) {
  const [game, setGame] = React.useState(null);
  const [events, setEvents] = React.useState([]);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    let unsubscribe = () => {};
    setGame(null);
    setEvents([]);
    setError(null);

    api
      .game(id)
      .then((data) => {
        if (cancelled) return;
        const { events: initial, ...meta } = data;
        setGame(meta);
        setEvents(initial);
        if (live && meta.status === "running") {
          const after = initial.at(-1)?.seq ?? 0;
          unsubscribe = streamGame(id, after, {
            onEvent: (event) =>
              setEvents((prev) => (prev.length && prev.at(-1).seq >= event.seq ? prev : [...prev, event])),
            // Reload once at the end to pick up the final status (finished / aborted).
            onClosed: () => api.game(id).then(({ events: _e, ...m }) => !cancelled && setGame(m)).catch(() => {}),
          });
        }
      })
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id, live]);

  const state = React.useMemo(() => buildState(game, events), [game, events]);
  return { state, loading: !game && !error, error };
}

export function useApi(loader, deps = []) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    loader()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}

// Starts a new game, or explains why it can't (rate limits) and offers the live one.
export function useStartGame() {
  const [state, setState] = React.useState({ busy: false, message: "", liveGameId: null });
  const start = React.useCallback(async () => {
    setState({ busy: true, message: "", liveGameId: null });
    try {
      const { id } = await api.startGame();
      window.location.hash = `#/watch/${id}`;
      setState({ busy: false, message: "", liveGameId: null });
    } catch (error) {
      setState({ busy: false, message: error.message, liveGameId: error.body?.liveGameId ?? null });
    }
  }, []);
  return { ...state, start };
}
