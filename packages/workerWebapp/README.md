# Mindburn Aletheia Worker Web App

A Telegram Mini App for workers to participate in content verification tasks on the Mindburn Aletheia platform.

## Features

- Task discovery and management
- Content verification interfaces
- TON wallet integration
- Worker profile and statistics
- Payment history and withdrawals

## Tech Stack

- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Axios for API requests
- Telegram Mini App SDK integration

## Getting Started

### Prerequisites

- Node.js 18 or later
- pnpm package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mindburn/aletheia.git
cd aletheia/packages/worker-webapp
```

2. Install dependencies:
```bash
pnpm install
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Update the environment variables in `.env`:
```
VITE_API_ENDPOINT=http://localhost:4000
```

### Development

Start the development server:
```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Building for Production

Build the app:
```bash
pnpm build
```

Preview the production build:
```bash
pnpm preview
```

## Project Structure

```
src/
  ├── components/     # Reusable UI components
  ├── contexts/       # React contexts
  ├── hooks/          # Custom React hooks
  ├── pages/          # Page components
  ├── services/       # API and other services
  ├── types/          # TypeScript types and interfaces
  ├── utils/          # Utility functions
  ├── App.tsx         # Main app component
  └── main.tsx        # Entry point
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
