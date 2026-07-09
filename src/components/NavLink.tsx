import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}

export const NavLink: React.FC<NavLinkProps> = ({ to, icon: Icon, label, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'nav-item',
        isActive ? 'nav-item-active' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
