import { NavLink } from 'react-router-dom';

function Sidebar(): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">PCReady</div>

      <nav className="sidebar__nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
          }
        >
          Dashboard
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;