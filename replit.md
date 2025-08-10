# Overview

This is a real estate investment analysis platform focused on Dubai properties. The application provides interactive mapping capabilities with property visualization, investment scoring, amenity analysis, and valuation tools. Users can explore properties on an interactive map, analyze investment potential through various metrics, and assess location-based amenities to make informed real estate decisions.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built with React and TypeScript using Vite as the build tool. The application follows a component-based architecture with:

- **UI Framework**: shadcn/ui components built on Radix UI primitives for consistent, accessible design
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **State Management**: React hooks for local state, TanStack Query for server state management
- **Routing**: React Router for client-side navigation
- **Map Integration**: Mapbox GL JS for interactive mapping with custom overlays, drawing tools, and directions

## Backend Architecture

The backend uses Express.js with TypeScript in a minimalist setup:

- **Server Framework**: Express.js with middleware for JSON parsing and request logging
- **API Structure**: RESTful API with routes prefixed under `/api`
- **Storage Interface**: Abstracted storage layer with in-memory implementation as default
- **Development Setup**: Hot reloading with Vite integration for seamless development

## Data Storage Solutions

The application uses a flexible storage architecture:

- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (specifically Neon) configured via environment variables
- **Schema Management**: Shared schema definitions between frontend and backend
- **Migration Strategy**: Drizzle Kit for database migrations and schema changes
- **Development Storage**: In-memory storage implementation for rapid prototyping

## Authentication and Authorization

Currently implements a basic user system with:

- **User Management**: Username/password based authentication structure
- **Data Validation**: Zod schemas for input validation and type safety
- **Session Handling**: Prepared for session-based authentication (connect-pg-simple dependency present)

## Map and Location Services

Comprehensive mapping functionality built around Mapbox:

- **Interactive Maps**: Property visualization with custom markers and overlays
- **Geocoding**: Location search and address resolution via Mapbox Geocoding API
- **Routing**: Directions and isochrone analysis for travel time calculations
- **Drawing Tools**: Polygon drawing for area selection and analysis
- **Amenity Discovery**: Location-based search for nearby services and facilities

## Real Estate Analysis Features

- **Property Scoring**: Investment score calculation based on multiple metrics
- **Market Data**: Price trends, rental yields, and valuation analytics
- **Amenity Analysis**: Proximity scoring for schools, transportation, shopping, and services
- **Area Comparison**: Zone-based analysis with neighborhood insights
- **Interactive Visualizations**: Charts and gauges for data presentation using Recharts

# External Dependencies

## Map Services
- **Mapbox GL JS**: Core mapping functionality, geocoding, and routing services
- **Mapbox Directions API**: Route calculation and navigation
- **Mapbox Isochrone API**: Travel time analysis

## Database Services
- **Neon Database**: PostgreSQL hosting service
- **Drizzle ORM**: Database operations and migrations

## UI and Styling
- **Radix UI**: Primitive components for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide Icons**: Icon library for consistent iconography

## Development Tools
- **Vite**: Build tool and development server
- **TanStack Query**: Server state management and caching
- **Recharts**: Data visualization library for charts and graphs

## Form and Validation
- **React Hook Form**: Form state management
- **Zod**: Runtime type validation and schema definition

## Utility Libraries
- **class-variance-authority**: Component variant management
- **clsx & tailwind-merge**: Conditional className utilities
- **nanoid**: Unique ID generation