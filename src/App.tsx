import React, { useReducer } from 'react';
import { NavBar } from './components/NavBar';
import { Footer } from './components/Footer';
import CurlPlayground from "./components/CurlPlayground";
import { appReducer, initialState } from './state/reducer';
import './index.css';

const App: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <div className="app-container">
      {/* Navigation */}
      <NavBar onReset={() => dispatch({ type: 'CLEAR_ALL' })} />

      <main className="main-content">
        {/* Playground (handles input, parsed view, code preview, results) */}
        <CurlPlayground/>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
