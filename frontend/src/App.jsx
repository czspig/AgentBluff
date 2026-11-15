import React from "react";
import HomePage from "./pages/HomePage.jsx";
import WatchPage from "./pages/WatchPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ReplayPage from "./pages/ReplayPage.jsx";

const routes = {
  "": HomePage,
  watch: WatchPage,
  profile: ProfilePage,
  replay: ReplayPage,
};

// "#/watch/12" -> { section: "watch", param: "12" }
function parseHash() {
  const [section = "", param = null] = window.location.hash.replace(/^#\/?/, "").split("/");
  return routes[section] ? { section, param } : { section: "", param: null };
}

export default function App() {
  const [route, setRoute] = React.useState(parseHash);

  React.useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const Page = routes[route.section];
  return <Page activeRoute={`/${route.section}`} param={route.param} key={`${route.section}/${route.param}`} />;
}
