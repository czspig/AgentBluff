const links = [
  { label: "观战", href: "#/watch", route: "/watch" },
  { label: "复盘", href: "#/replay", route: "/replay" },
  { label: "选手", href: "#/profile", route: "/profile" },
];

// Editorial nav shared by the light pages (home, replay, profile).
export default function TopNav({ activeRoute = "/", onRules }) {
  return (
    <header className="site-nav">
      <a className="site-logo" href="#/" aria-label="Agentbluff 首页">
        <i aria-hidden="true">✧</i>Agentbluff
      </a>
      <nav aria-label="主导航">
        {links.map((link) => (
          <a key={link.label} className={activeRoute === link.route ? "is-active" : ""} href={link.href}>
            {link.label}
          </a>
        ))}
        {onRules ? (
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onRules();
              document.getElementById("home-rules")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            玩法
          </a>
        ) : null}
      </nav>
    </header>
  );
}
