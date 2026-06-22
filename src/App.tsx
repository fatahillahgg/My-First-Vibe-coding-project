import type { ReactNode } from "react";
import { NavLink, Outlet, Route, Routes } from "react-router-dom";
import { InboxWorkspace } from "./features/inbox/InboxWorkspace";
import { TodayWorkspace } from "./features/today/TodayWorkspace";
import { FocusWorkspace } from "./features/focus/FocusWorkspace";
import { ReviewWorkspace } from "./features/review/ReviewWorkspace";
import { SettingsWorkspace } from "./features/settings/SettingsWorkspace";

type IconName = "today" | "inbox" | "focus" | "review" | "settings";

const navigation: ReadonlyArray<{ label: string; path: string; icon: IconName }> = [
  { label: "Today", path: "/", icon: "today" },
  { label: "Inbox", path: "/inbox", icon: "inbox" },
  { label: "Focus", path: "/focus", icon: "focus" },
  { label: "Review", path: "/review", icon: "review" },
];

const iconPaths: Record<IconName, ReactNode> = {
  today: <path d="M5 8.5h14M8 3v3m8-3v3M6.5 5h11A1.5 1.5 0 0 1 19 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-12A1.5 1.5 0 0 1 6.5 5Z" />,
  inbox: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Zm0 9h4l1.5 2h5l1.5-2h4" />,
  focus: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 1.75M9 1h6" />,
  review: <path d="M7 4h10m-9.5 4h9M7 12h6m-6 4h4M5.5 2h13A1.5 1.5 0 0 1 20 3.5v17L17 18l-3 2.5-3-2.5-3 2.5L4 18V3.5A1.5 1.5 0 0 1 5.5 2Z" />,
  settings: <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Zm7.2-1.15 1.3 1-.2.6-1.8 3.1-.6.2-1.55-.65a7.8 7.8 0 0 1-1.45.85l-.2 1.65-.5.4h-4.4l-.5-.4-.2-1.65a7.8 7.8 0 0 1-1.45-.85L6.1 19l-.6-.2-1.8-3.1-.2-.6 1.3-1a8.6 8.6 0 0 1 0-1.7l-1.3-1 .2-.6 1.8-3.1.6-.2 1.55.65A7.8 7.8 0 0 1 9.1 7.3l.2-1.65.5-.4h4.4l.5.4.2 1.65c.52.23 1 .51 1.45.85l1.55-.65.6.2 1.8 3.1.2.6-1.3 1a8.6 8.6 0 0 1 0 1.7Z" />,
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
      {iconPaths[name]}
    </svg>
  );
}

function AppLayout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <NavLink className="brand" to="/" aria-label="Momentum home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>momentum</span>
        </NavLink>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              end={item.path === "/"}
              key={item.path}
              to={item.path}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>Make room for<br />what matters.</p>
          <NavLink className="settings-link" to="/settings">
            <Icon name="settings" />
            <span>Settings</span>
          </NavLink>
        </div>
      </aside>

      <div className="workspace">
        <header className="mobile-header">
          <NavLink className="brand" to="/" aria-label="Momentum home">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span>momentum</span>
          </NavLink>
          <NavLink className="icon-button" to="/settings" aria-label="Settings">
            <Icon name="settings" />
          </NavLink>
        </header>
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
    </header>
  );
}

function TodayPage() {
  return <TodayWorkspace />;
}

function InboxPage() {
  return (
    <div className="page">
      <PageHeading eyebrow="Capture" title="Inbox" description="A quiet landing place for every task before you decide when it matters." />
      <InboxWorkspace />
    </div>
  );
}

function FocusPage() {
  return (
    <div className="page">
      <PageHeading eyebrow="One thing at a time" title="Focus" description="A protected space for the task in front of you—and nothing else." />
      <FocusWorkspace />
    </div>
  );
}

function ReviewPage() {
  return (
    <div className="page">
      <PageHeading eyebrow="Close the loop" title="Daily review" description="Notice what moved, carry forward what matters, then let the day be done." />
      <ReviewWorkspace />
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="page settings-page">
      <PageHeading eyebrow="Your space" title="Settings" description="Shape Momentum around the way you prefer to work." />
      <SettingsWorkspace />
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="page">
      <PageHeading eyebrow="404" title="This path wandered off." description="The page you’re looking for isn’t part of today’s plan." />
      <NavLink className="button" to="/">Return to Today</NavLink>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="focus" element={<FocusPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
