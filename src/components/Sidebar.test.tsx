import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import React from 'react';

// Mock the utils and store
vi.mock('../lib/store', () => ({
  store: {
    theme: 'light',
    token: 'test-token',
  },
  User: {}
}));

describe('Sidebar Navigation Hierarchy', () => {
  const adminUser = {
    id: '1',
    username: 'admin',
    fullName: 'Admin User',
    password: 'password',
    role: 'admin' as const,
    active: true,
    createdAt: new Date().toISOString()
  };

  const renderSidebar = (user) => {
    return render(
      <BrowserRouter>
        <Sidebar user={user} onLogout={vi.fn()} />
      </BrowserRouter>
    );
  };

  it('renders all required main categories and sub-tabs for admin', () => {
    renderSidebar(adminUser);

    // Verify main categories exist
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Upload Receipts')).toBeDefined();
    expect(screen.getByText('History')).toBeDefined();
    expect(screen.getByText('Analytics')).toBeDefined();

    // Verify Admin Control Section Headers
    expect(screen.getByText('Admin Control')).toBeDefined();
    expect(screen.getByText('Admin Panel')).toBeDefined();

    // Verify sub-sections
    expect(screen.getByText('Management')).toBeDefined();
    expect(screen.getByText('User Management')).toBeDefined();
    expect(screen.getByText('Approvals')).toBeDefined();

    expect(screen.getByText('Configuration')).toBeDefined();
    expect(screen.getByText('System Settings')).toBeDefined();

    expect(screen.getByText('Data & Reports')).toBeDefined();
    expect(screen.getByText('Activity Logs')).toBeDefined();
    expect(screen.getByText('Export Data')).toBeDefined();
  });
});
