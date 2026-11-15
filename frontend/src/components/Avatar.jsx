import { logoFor } from "../lib/logos.js";

// A persona's round badge: the brand logo on a cream disc, or the old letter mark as a fallback.
export default function Avatar({ persona, className = "avatar", as: Tag = "span" }) {
  const logo = logoFor(persona.id);
  if (!logo) {
    return (
      <Tag className={className} style={{ "--avatar-color": persona.color }}>
        {persona.avatar}
      </Tag>
    );
  }
  return (
    <Tag className={`${className} has-logo`}>
      <img src={logo} alt="" draggable="false" />
    </Tag>
  );
}
