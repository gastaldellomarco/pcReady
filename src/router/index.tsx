import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/guards/ProtectedRoute';
import { RoleRoute } from '../components/guards/RoleRoute';
import { ReadOnlyRoute } from '../components/guards/ReadOnlyRoute';
import { WriteAccessRoute } from '../components/guards/WriteAccessRoute';
import { AppShell } from '../components/layout/AppShell';
import LoginPage from '../pages/LoginPage';
import SignUpPage from '../pages/SignUpPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';
import DashboardPage from '../pages/DashboardPage';
import ReadOnlyDashboardPage from '../pages/ReadOnlyDashboardPage';
import AdminPage from '../pages/AdminPage';
import TechPage from '../pages/TechPage';
import DocsPage from '../pages/DocsPage';
import TicketsPage from '../pages/TicketsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignUpPage />,
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: '/docs',
            element: <DocsPage />,
          },
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            element: <ReadOnlyRoute />,
            children: [
              {
                path: '/dashboard/read-only',
                element: <ReadOnlyDashboardPage />,
              },
            ],
          },
          {
            element: <RoleRoute allowedRoles={['admin']} />,
            children: [
              {
                path: '/admin',
                element: <AdminPage />,
              },
            ],
          },
          {
            element: <RoleRoute allowedRoles={['admin', 'tech']} />,
            children: [
              {
                path: '/tech',
                element: <TechPage />,
              },
            ],
          },
          {
            element: <WriteAccessRoute />,
            children: [
              {
                path: '/tickets',
                element: <TicketsPage />,
              },
              {
                path: '/tickets/new',
                element: <TicketsPage />,
              },
              {
                path: '/tickets/:id/edit',
                element: <TicketsPage />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);