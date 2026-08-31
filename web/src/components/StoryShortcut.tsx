/**
 * A bookmarklet rather than a normal link: Chrome runs it on the currently open story-board page,
 * then navigates that tab back to this app with the story URL safely URL-encoded.
 */
export default function StoryShortcut() {
  const appUrl = new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString();
  const bookmarklet = `javascript:(()=>{window.location.assign(${JSON.stringify(`${appUrl}?story=`)}+encodeURIComponent(window.location.href))})()`;

  return (
    <aside className="story-shortcut" aria-label="Story shortcut">
      <span>Often open stories in Chrome?</span>
      <a href={bookmarklet} draggable title="Drag this to Chrome's bookmarks bar">
        Drag “Open in Agento Rojo” to bookmarks
      </a>
    </aside>
  );
}
