import React from 'react';
import './App.css';

function App() {
  return (
    <div className="container">
      <header>
        <h1>MindMap & Whiteboard Collaboration Tool</h1>
        <p>Powered by LTI 1.3 for Moodle</p>
      </header>
      <main>
        <section className="info">
          <h2>Welcome!</h2>
          <p>This is the starting point for your collaborative MindMap and Whiteboard editor.</p>
          <ul>
            <li>✨ Real-time Collaboration with Yjs CRDT</li>
            <li>🧠 MindMap Editor</li>
            <li>🎨 Whiteboard Drawing</li>
            <li>🔐 Secure LTI 1.3 Authentication</li>
            <li>💾 Persistent Storage on All-Inkl MySQL</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;
