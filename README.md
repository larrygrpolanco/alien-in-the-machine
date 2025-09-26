# Alien in the Machine

A tactical SvelteKit game where marines hunt an alien predator aboard a spaceship, while a director subtly manipulates the environment to create tension.

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your OpenRouter API key
4. Run development server: `npm run dev`

## API Key Security

This project uses OpenRouter (via OpenAI-compatible API) for AI agent decision making. The API key is now securely handled **server-side only**:

### Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key (server-side only)
  - **Never** use `VITE_` prefix for API keys - this exposes them to browser bundles
  - Server-side endpoints access `process.env.OPENROUTER_API_KEY`
  - Client-side code uses fetch to `/api/llm` endpoint

### Security Implementation

1. **Server-side LLM endpoint**: `src/routes/api/llm/+server.ts`
   - Handles all OpenAI API calls securely
   - Uses `process.env.OPENROUTER_API_KEY` (not exposed to browser)
   - Includes mock mode for testing (no API key needed)

2. **Client-side abstraction**: `src/lib/services/llmClient.ts`
   - Removed direct OpenAI imports and client-side API key usage
   - Uses `fetch('/api/llm')` to call server endpoint
   - Maintains same interface for dependent services

3. **Testing mocks**: `vitest-setup-client.ts`
   - Intercepts `/api/llm` fetch calls in browser tests
   - Returns scripted mock responses based on prompt keywords
   - Ensures tests run without server or API key

### Why Server-Side?

- **Security**: API keys never reach browser, preventing exposure to users/attackers
- **Rate limiting**: Server can implement caching and rate limiting
- **Consistency**: Mock mode works in both development and testing
- **Best practice**: Follows OpenAI/OpenRouter security recommendations

### Development Workflow

1. **Local development**: Uses real API calls via server endpoint
2. **Browser testing**: Uses mocks (no API calls)
3. **Production**: Secure server-side API calls only

### Troubleshooting

- **Missing API key**: Set `OPENROUTER_API_KEY` in `.env`
- **Browser errors**: Ensure no `VITE_` prefixed API keys in `.env`
- **Test failures**: Mocks handle all prompt scenarios (search, move, report, cover)
- **Rate limits**: Server endpoint includes 5-second timeout and error handling

## Running Tests

```bash
# Unit tests (node environment)
npm run test:unit

# Integration tests (browser environment with mocks)
npm run test:integration

# All tests
npm run test
```

The integration tests use browser mocks to simulate LLM responses without API calls, ensuring fast and reliable testing.

## Production Deployment

When deploying:

1. Set `OPENROUTER_API_KEY` as environment variable on your hosting platform
2. Ensure `.env` is **not** committed to version control
3. Use `.env.example` as template for team members