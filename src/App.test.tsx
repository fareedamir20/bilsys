import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './App';
import React from 'react';

const TestComponent = () => <div>Protected Content</div>;
const DashboardComponent = () => <div>Dashboard</div>;
const LoginComponent = () => <div>Login</div>;

describe('Role-Based Access Control (RBAC) - ProtectedRoute', () => {
  const adminUser = { id: '1', role: 'admin' as const, fullName: 'Admin', username: 'admin' } as any;
  const normalUser = { id: '2', role: 'user' as const, fullName: 'User', username: 'user' } as any;

  it('redirects to login (root /) if user is not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/" element={<LoginComponent />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute user={null}>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Protected Content')).toBeNull();
    expect(screen.getByText('Login')).toBeDefined();
  });

  it('allows access to admin-only route for admin users', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardComponent />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute user={adminUser} adminOnly>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('redirects normal user from admin-only route to dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardComponent />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute user={normalUser} adminOnly>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Protected Content')).toBeNull();
    expect(screen.getByText('Dashboard')).toBeDefined();
  });

  it('allows access to user-only route for normal users', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardComponent />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute user={normalUser} userOnly>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('redirects admin user from user-only route to dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardComponent />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute user={adminUser} userOnly>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Protected Content')).toBeNull();
    expect(screen.getByText('Dashboard')).toBeDefined();
  });
});
