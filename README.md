# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
```
File Organization🎨 UI Components

AppLayout.tsx - Main layout wrapper
NavBar.tsx - Navigation with theme toggle
Footer.tsx - Footer component
accordion.tsx - Collapsible sections UI
button.tsx - Button component
card.tsx - Card container component
dialog.tsx - Modal dialog component
loading.tsx - Loading spinner
theme-provider.tsx - Dark/light theme provider
ErrorBoundary.tsx - Error handling wrapper
🔧 Feature Components (cURL Parsing)

CurlPlayground.tsx - Main playground container
ParsedResultCard.tsx - Displays parsed results
CurlFilterDialog.tsx - Filter dialog (will be replaced)
RequestEditor.tsx - Request editor (separate feature)
ResponseViewer.tsx - Response viewer (separate feature)
🌐 API Layer

apiClient.ts - Axios instance with interceptors
curl.ts (in api folder) - cURL parsing API calls
🛠️ Utilities & Helpers

utils.ts - cn() utility for className merging
curl.ts (in utils folder) - Data cleaning, filtering, normalization
🔌 Hooks

useCurlParser.ts - Custom hook for cURL parsing logic
📘 Types

curl.ts (in types folder) - TypeScript interfaces
📄 Pages

Home.tsx - Landing page
Playground.tsx - Playground page wrapper
⚙️ Configuration

App.tsx - App router
main.tsx - App entry point
index.css - Global styles & theme variables
```