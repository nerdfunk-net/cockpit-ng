# Cockpit Network Management Frontend

A modern, Apple-inspired network management dashboard built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🍎 **Apple-inspired Design**: Clean, minimalist interface with subtle shadows and smooth animations
- 🔐 **JWT Authentication**: Secure login system with persistent sessions
- 📱 **Responsive Layout**: Desktop-first design with mobile compatibility
- 🎯 **Dashboard Overview**: Real-time statistics and recent activity
- 🧭 **Sidebar Navigation**: Collapsible navigation with organized sections
- ⚡ **Modern Stack**: Next.js 14 with App Router, TypeScript, and Shadcn/ui

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **Icons**: Lucide React
- **State Management**: Zustand
- **Authentication**: JWT with localStorage persistence

## Project Structure

```
src/
├── app/
│   ├── login/
│   │   └── page.tsx           # Login page
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Dashboard home
│   └── globals.css            # Global styles with Apple design system
├── components/
│   ├── ui/                    # Shadcn/ui components
│   ├── app-sidebar.tsx        # Main navigation sidebar
│   └── dashboard-layout.tsx   # Main layout wrapper
└── lib/
    ├── auth-store.ts          # Authentication state management
    └── utils.ts               # API utilities and helpers
```

## Navigation Structure

- **General**
  - 🏠 Home
- **Onboarding**
  - ➕ Onboard Device
  - 🔄 Sync Devices  
  - 🔍 Scan & Add
- **Configs**
  - 💾 Backup
  - 🔄 Compare
- **Ansible**
  - 📋 Inventory
- **Settings**
  - 🖥️ Nautobot
  - 📝 Templates
  - 🔀 Git Management
  - ⚡ Cache
  - 🔑 Credentials

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000)

## API Integration

The frontend is configured to work with the Cockpit backend running on port 8000:

- **Development**: Uses proxy configuration for seamless API calls
- **Production**: Configurable API base URL
- **Authentication**: JWT token automatically included in requests

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Backend Integration

This frontend is designed to work with the Cockpit backend. Ensure the backend is running on `http://localhost:8000` for development.

Key API endpoints:
- `/auth/login` - User authentication
- `/api/nautobot/*` - Nautobot integration
- `/api/settings/*` - Settings management
- `/api/templates/*` - Template management
- `/api/git/*` - Git operations
- `/api/git-repositories/*` - Git repository management
- `/api/file-compare/*` - File operations and comparison

## Design System

The application uses an Apple-inspired design system with:

- **Colors**: Neutral grays with blue accent colors
- **Typography**: System fonts (-apple-system, BlinkMacSystemFont)
- **Shadows**: Subtle Apple-style shadows
- **Animations**: Smooth transitions and hover effects
- **Glassmorphism**: Backdrop blur effects for modern UI

## Authentication Flow

1. User logs in through `/login` page
2. JWT token stored in localStorage with Zustand persistence
3. Protected routes automatically redirect to login if unauthenticated
4. Token included in all API requests
5. Automatic logout on token expiry

## Contributing

This is a hobby project focused on modern web development practices and Apple-inspired design.
